# CodeCompass

## TODO:
- Add support more other languages (more handlers)
- Fallback handler for unsupported languages
- More integrated knowledge graph (inheritance between classes, parameters of functions, custom classes used with functions)
- Figure out local embedding (too slow for me)
- Prompt engineering
    - How much of the given context should the LLM use?
    - How should the LLM ignore "irrelevant" context?
    - How many code blocks should be presented, in what order, etc?
    - How should the response be formatted?
- Ideal number of seeds and hops
    - Seeds: The top-k chunks from semantic search.
    - Hops: The chunks "around" the seeds in the knowledge graph. 
- Ranking of neighbors: Simple heuristic: seed score + hop penalty + edge weights
- Keyword search

CodeCompass indexes a codebase into:
1. **Knowledge Graph** - Code elements (classes, functions, methods) and relationships (CONTAINS, CALLS, IMPORTS)
2. **Vector Database** - Embeddings of class headers and function/method bodies for semantic search

**GraphRAG Retrieval:**
1. Vector search finds semantically relevant seed nodes
2. k-hop graph expansion pulls in structurally related code (via CALLS, IMPORTS edges)
3. Combined context is sent to LLM for answering questions

## AI Documentation Pipeline

CodeCompass can automatically generate comprehensive wiki documentation for your codebase using a 4-phase pipeline:

**Phase 1: Code Indexing**
- Builds knowledge graph of all code elements (folders, files, classes, methods)
- Creates CONTAINS edges for hierarchical structure
- Caches to `.codecompass/graph.json` (~15s for medium repos)

**Phase 2: AI Summarization**
- Bottom-up approach: methods → classes → files → modules
- Generates short summaries for all code elements using LLM
- Adds IMPORTS edges for module architecture
- Saves to `.codecompass/summaries.json` and `.codecompass/module_summaries.json`

**Phase 3: Wiki IA Generation**
- Uses module summaries to generate conceptual page structure
- Creates user-friendly page hierarchy (e.g., "Agent Architecture", "Search Algorithms")
- Assigns code nodes to appropriate pages for coverage
- Saves to `.codecompass/wiki_ia.json`

**Phase 4: Content Generation**
- Generates markdown content for each wiki page
- Uses hybrid context strategy (summaries + code) for token efficiency
- Outputs to `wiki/*.md` directory

**Usage:**
```bash
python documentation.py  # Runs all 4 phases
```

**Key Files:**
- **`documentation.py`** - Main pipeline orchestration
- **`docs/summarizers/`** - LLM-based summarizers for each level (definition, class, file, module)
- **`docs/ia/ia_generator.py`** - Wiki structure generation
- **`docs/ia/content_generator.py`** - Markdown content generation
- **`docs/ia/prompts.py`** - LLM prompts for IA generation
- **`core/summary_cache.py`** - Summary persistence layer

## Architecture

### Graph Structure

**Nodes:**
- `FOLDER` - Directory nodes
- `FILE` - Source file nodes
- `CLASS` - Class definitions
- `FUNCTION` - Top-level functions
- `METHOD` - Class methods

**Edges:**
- `CONTAINS` - Hierarchical relationships (folder→file→class→method)
- `CALLS` - Function/method call relationships (via LSP resolution)
- `IMPORTS` - File import dependencies (via AST parsing)

### Vectorization

- **Classes**: Only headers (class variables + constructor) to avoid duplicating method code
- **Functions/Methods**: Full code bodies
- **Storage**: Chroma vector DB with Voyage AI embeddings
- **Indexing**: 0-indexed line numbers internally, 1-indexed for display

### Multi-Language Support

Currently supports:
- **Python** (.py, .pyi) - Tree-sitter + Pyright LSP
- **TypeScript/JavaScript** (.ts, .tsx, .js, .jsx) - Tree-sitter + typescript-language-server

## Key Files

### Core Components

- **`core/graph_model.py`** - Graph data structure with bidirectional k-hop traversal
- **`core/code_indexing.py`** - Main indexer that walks repo and extracts definitions
- **`retrieval.py`** - Entry point with GraphRAG query loop

### Language Handlers

- **`languages/language_handler.py`** - Abstract base class for language-specific operations
- **`languages/python_handler.py`** - Python extraction using Tree-sitter + Pyright
- **`languages/typescript_handler.py`** - TypeScript/JS extraction + typescript-language-server
- **`languages/language_config.py`** - Enabled language configuration

### LSP Integration

- **`lsp/lsp_manager.py`** - Manages multiple LSP clients (one per language)
- **`lsp/lsp_client.py`** - Binary stdio LSP client implementation
- **`lsp/lsp_edges.py`** - Builds CALLS and IMPORTS edges using LSP

### Vectorization

- **`vectorization/class_header_extractor.py`** - Extracts class headers (variables + constructor) for smart chunking
- **`vectorization/process_graph.py`** - Converts graph nodes to vector documents
- **`vectorization/embeddings_config.py`** - Embedding model configuration (Voyage AI)

### Utilities

- **`prompt.py`** - RAG prompt template


