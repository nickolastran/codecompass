import os
from pathlib import Path
from dotenv import load_dotenv, find_dotenv

from langchain_chroma import Chroma
from ollama import chat, ChatResponse

from .core.code_indexing import CodeIndexer
from .prompt_query import RAG_PROMPT
from .vectorization.process_graph import index_graph_into_vectors, node_text, _to_fs_path, _get_handler_for_file
from .lsp.lsp_edges import build_span_index, add_imports_edges, add_calls_edges, _uri_to_path
from .lsp.lsp_manager import LSPManager
from .core.graph_model import NodeLabel
from .languages.language_config import ENABLED_LANGUAGES
load_dotenv(find_dotenv(usecwd=True))

ALLOWED_LABELS = {NodeLabel.CLASS, NodeLabel.FUNCTION, NodeLabel.METHOD}

def assemble_context_from_seeds_and_neighbors(KG, seed_docs, neighbor_ids, *, max_chars=8000) -> str:
    """
    Build the final context string:
      - seeds first (what the vector search returned)
      - then graph neighbors (k-hop expansion)
    """
    # Build parent lookup for methods (used for both seeds and neighbors)
    child_to_parent = {}
    for edge in KG.edges:
        if edge.type.value == "CONTAINS":
            parent_node = KG.nodes.get(edge.src)
            if parent_node and parent_node.label.value == "class":
                child_to_parent[edge.dst] = parent_node.name

    parts = []
    total = 0

    # 1) Seed docs (already come with text + metadata)
    for d in seed_docs:
        label = d.metadata.get('label', 'def')
        name = d.metadata.get('name', '?')

        # Format header with parent class for methods
        if label == 'method':
            parent_class = d.metadata.get('parent_class') or child_to_parent.get(d.metadata.get('node_id'))
            if parent_class:
                header = f"# method {name} from class {parent_class}\n"
            else:
                header = f"# method {name}\n"
        elif label == 'class':
            header = f"# class {name} (header: variables + constructor)\n"
        else:
            header = f"# {label} {name}\n"

        # Display 1-indexed line numbers (internal storage is 0-indexed)
        start_display = d.metadata.get('start_line')
        end_display = d.metadata.get('end_line')
        if start_display is not None:
            start_display = start_display + 1
        if end_display is not None:
            end_display = end_display + 1
        header += f"({d.metadata.get('path','?')}:{start_display or '?'}-{end_display or '?'})\n"
        chunk = header + d.page_content + "\n\n"
        if total + len(chunk) > max_chars:
            break
        parts.append(chunk)
        total += len(chunk)

    # 2) Graph neighbors (fetch text on demand from the KG)
    for nid in neighbor_ids:
        n = KG.nodes.get(nid)
        if not n:
            continue

        label = getattr(n.label, "value", str(n.label))

        # For classes, extract header only (not full class body)
        if label == 'class':
            try:
                fs_path = _to_fs_path(n.path)
                file_content = Path(fs_path).read_text(encoding="utf-8")
                handler = _get_handler_for_file(fs_path, ENABLED_LANGUAGES)
                if handler:
                    txt = handler.extract_class_header(n, file_content)
                else:
                    txt = None
                if not txt:
                    # Fallback: use just class signature
                    txt = node_text(n).split('\n')[0]
            except Exception:
                continue
            header = f"# class {n.name} (header: variables + constructor)\n"
        else:
            # For functions/methods, get full code
            try:
                txt = node_text(n)  # reads slice based on path + start_line/end_line
            except Exception:
                continue

            # Format header with parent class for methods
            if label == 'method':
                parent_class = child_to_parent.get(nid)
                if parent_class:
                    header = f"# method {n.name} from class {parent_class}\n"
                else:
                    header = f"# method {n.name}\n"
            else:
                header = f"# {label} {n.name}\n"

        # Display 1-indexed line numbers (internal storage is 0-indexed)
        start_display = n.start_line + 1 if n.start_line is not None else '?'
        end_display = n.end_line + 1 if n.end_line is not None else '?'
        header += f"({n.path}:{start_display}-{end_display})\n"
        chunk = header + txt + "\n\n"
        if total + len(chunk) > max_chars:
            break
        parts.append(chunk)
        total += len(chunk)

    return "".join(parts)


def graphrag_context(KG, vectorstore: Chroma, query: str, *, k_seeds=2, hops=2, max_neighbors=50, max_chars=8000, repo_id: str, user_id:str,debug=False):
    """
        Vector seeds -> k-hop graph expansion -> assemble context.
        Returns: 
            context (str): All code chunks put into a single context string  
            filepaths_list (List[str]): All the filepaths of the files from which the chunks are taken
            linenums_list (List[str]): Exact Line numbers of each chunk
    """

    # 1) Vector search for seeds (keep scores if you want to debug)
    seeds = vectorstore.similarity_search_with_relevance_scores(
        query=query,
        k=k_seeds,
        filter={"repo_id": repo_id}
    )
    seed_docs = [doc for (doc, _score) in seeds]
    seed_ids = [doc.metadata["node_id"] for (doc, _score) in seeds]

    chunks_list = [doc.page_content for doc in seed_docs]

    filepaths_list = [doc.metadata["path"] for doc in seed_docs]

    linenums_list = [(doc.metadata["start_line"], doc.metadata["end_line"]) for doc in seed_docs]


    if debug:
        print(f"\n  [GRAPHRAG DEBUG] Query: {query}")
        print(f"  [GRAPHRAG DEBUG] Vector search returned {len(seed_ids)} seeds:")
        for i, (doc, score) in enumerate(seeds):
            node = KG.nodes.get(doc.metadata["node_id"])
            if node:
                print(f"    {i+1}. {node.label.value} {node.name} (score: {score:.3f}) - {node.path}")
         

    # 2) Expand in the KG (both directions). Filter to definition nodes.
    neighbor_ids = KG.khop(
        seeds=seed_ids,
        hops=hops,
        allowed=ALLOWED_LABELS
    )
    # Remove the seeds themselves and cap
    seed_set = set(seed_ids)
    neighbor_ids = [nid for nid in neighbor_ids if nid not in seed_set][:max_neighbors]

    if debug:
        all_khop_results = [nid for nid in neighbor_ids if nid not in seed_set]
        print(f"  [GRAPHRAG DEBUG] k-hop expansion found {len(neighbor_ids)} neighbors (total: {len(all_khop_results)}, capped to: {max_neighbors}):")
        # Group by file for clarity
        by_file = {}
        for nid in neighbor_ids:
            node = KG.nodes.get(nid)
            if node:
                file_key = node.path.split('/')[-1] if '/' in node.path else node.path.split('\\')[-1]
                if file_key not in by_file:
                    by_file[file_key] = []
                by_file[file_key].append(f"{node.label.value} {node.name}")
        for file, nodes in by_file.items():
            print(f"    {file}: {', '.join(nodes)}")

        # Show what edges connect seeds to neighbors
        print(f"  [GRAPHRAG DEBUG] Edges connecting seeds to neighbors:")
        edge_count_by_type = {"CONTAINS": 0, "CALLS": 0, "IMPORTS": 0}
        for edge in KG.edges:
            if (edge.src in seed_ids and edge.dst in neighbor_ids) or (edge.dst in seed_ids and edge.src in neighbor_ids):
                src_node = KG.nodes.get(edge.src)
                dst_node = KG.nodes.get(edge.dst)
                if src_node and dst_node:
                    edge_count_by_type[edge.type.value] += 1
                    # Only show first few examples
                    if sum(edge_count_by_type.values()) <= 5:
                        print(f"    {edge.type.value}: {src_node.name} -> {dst_node.name}")
        # print(f"    Total: {sum(edge_count_by_type.values())} edges ({', '.join(f'{k}={v}' for k,v in edge_count_by_type.items())})")

    # 3) Assemble context (seeds first, then neighbors)
    context = assemble_context_from_seeds_and_neighbors(
        KG, seed_docs, neighbor_ids, max_chars=max_chars
    )
    return context, chunks_list, filepaths_list, linenums_list


def main():

    # Use paths relative to this file's location
    script_dir = Path(__file__).parent
    persist_directory = str(script_dir / "chroma_db")
    test_directory = str(script_dir / "example_repos" / "calls_test_cpp")

    # 0) Build the KG with multi-language support
    print("Building knowledge graph from code...")
    print(f"  Enabled languages: {', '.join(h.get_lsp_language_id() for h in ENABLED_LANGUAGES)}")
    indexer = CodeIndexer(test_directory, handlers=ENABLED_LANGUAGES)
    KG = indexer.index_directory()
    print(f"  Graph built: {len(KG.nodes)} nodes, {len(KG.edges)} CONTAINS edges")
    # Write graph to file for debugging
    with open("graph_nolsp.txt", "w", encoding='utf-8') as f:
        f.write(f"Nodes: {len(KG.nodes)}  Edges: {len(KG.edges)}\n")
        for e in KG.edges:
            f.write(str(e.src) + " -> " + str(e.dst) + "\n")

    # 1) Add LSP edges (CALLS and IMPORTS)
    print("\nBuilding LSP edges (CALLS and IMPORTS)...")

    # Build span index for mapping LSP locations to nodes
    span_index = build_span_index(KG)
    print(f"  Span index built for {len(span_index)} files")

    # Initialize LSP manager (one client per language)
    try:
        lsp_manager = LSPManager(ENABLED_LANGUAGES, root_dir=test_directory)
        # Resolve to absolute path before converting to URI
        lsp_manager.initialize_all(Path(test_directory).resolve().as_uri())

        # Open all files in their respective LSP servers
        file_nodes = [n for n in KG.nodes.values() if n.label == NodeLabel.FILE]
        for file_node in file_nodes:
            try:
                # Get the appropriate client and handler for this file
                client, handler = lsp_manager.get_client_for_file(file_node.path)

                # Handle both URI and filesystem path
                if file_node.path.startswith("file://"):
                    uri = file_node.path
                    file_path = _uri_to_path(file_node.path)
                else:
                    file_path = Path(file_node.path)
                    uri = file_path.as_uri()

                text = file_path.read_text(encoding='utf-8')
                lang_id = handler.get_lsp_language_id()
                client.did_open(uri, lang_id, text)
            except KeyError:
                # No handler for this file type, skip
                continue
            except Exception as e:
                print(f"  Warning: Could not open {file_node.path}: {e}")

        print(f"  Opened {len(file_nodes)} files in LSP")

        # Add IMPORTS edges
        imports_count = add_imports_edges(KG, lsp_manager)
        print(f"  Added {imports_count} IMPORTS edges")

        # Add CALLS edges
        calls_count = add_calls_edges(KG, lsp_manager, span_index, debug=True)
        print(f"  Added {calls_count} CALLS edges")

        # Shutdown all LSP servers (keep generated configs for future runs)
        lsp_manager.shutdown_all(cleanup_generated=True)
        print(f"  Total edges: {len(KG.edges)} (CONTAINS + IMPORTS + CALLS)")

        # Write graph to file for debugging
        with open("graph_lsp.txt", "w", encoding='utf-8') as f:
            f.write(f"Nodes: {len(KG.nodes)}  Edges: {len(KG.edges)}\n")
            for e in KG.edges:
                f.write(str(e.src) + " -> " + str(e.dst) + "\n")

    except Exception as e:
        print(f"  Warning: LSP integration failed: {e}")
        import traceback
        traceback.print_exc()
        print("  Continuing with CONTAINS edges only...")

    # 2) Index definition nodes into vectors
    print("\nVectorizing code definitions...")
    vectorstore = index_graph_into_vectors(KG, persist_dir=persist_directory)
    print("  Vectorization complete")

    print("GraphRAG ready. Type \\q to quit.")
    question = input("codecompass#: ")

    while question != "\\q":
        # Build GraphRAG context: vector seeds -> k-hop KG expansion
        context, seed_ids, neighbor_ids = graphrag_context(
            KG,
            vectorstore,
            question,
            k_seeds=3,     # seeds from vector DB
            hops=3,        # 1 hop: parent/children/siblings if your graph is wired that way
            max_neighbors=25,
            max_chars=8000,
            debug=True     # Enable GraphRAG debug logging
        )

        prompt = RAG_PROMPT.format(context=context, question=question)

        # Call your local LLM (Ollama)
        response: ChatResponse = chat(
            model="deepseek-r1",
            messages=[{"role": "user", "content": prompt}],
        )

        print("\n--- Answer ---\n")
        print(response["message"]["content"])
        print("\n--------------\n")

        # Optional: log/debug what got included
        # print("Seeds:", seed_ids)
        # print("Neighbors:", neighbor_ids)

        # Append to responses.md as before
        with open("responses.md", "a", encoding="utf-8") as f:
            f.write(prompt + "\n\n")
            f.write(response["message"]["content"])
            f.write("\n-----------------------------------------\n")

        question = input("codecompass#: ")

    print("Thank you for using CodeCompass!")

if __name__ == "__main__":
    main()
