from __future__ import annotations
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Dict, List, Optional
from collections import defaultdict, deque
from typing import Set, Tuple

class NodeLabel(str, Enum):
    FOLDER = "folder"
    FILE = "file"
    CLASS = "class"
    FUNCTION = "function"
    METHOD = "method"

class EdgeType(str, Enum):
    CONTAINS = "CONTAINS"
    CALLS = "CALLS"
    IMPORTS = "IMPORTS"

@dataclass
class Node:
    id: str
    label: NodeLabel
    path: str               # absolute path or file:// URI (for files/defs)
    name: str               # folder name, filename, class name, function name, etc.
    start_line: Optional[int] = None   # 0-based
    end_line: Optional[int] = None     # 0-based
    extra: Dict[str, str] = field(default_factory=dict)

    # AI Documentation: Summary fields
    summary_short: Optional[str] = None      # 1-3 sentences describing purpose/role
    summary_detailed: Optional[str] = None   # 1-2 paragraphs with key details

    # AI Documentation: Code metrics
    loc: Optional[int] = None                # Lines of code (end_line - start_line + 1)
    fan_in: int = 0                          # Number of incoming CALLS edges
    fan_out: int = 0                         # Number of outgoing CALLS edges

@dataclass
class Edge:
    src: str
    dst: str
    type: EdgeType

class Graph:
    def __init__(self):
        self.nodes: Dict[str, Node] = {}
        self.edges: List[Edge] = []
        self._edge_set: Set[Tuple[str, str, EdgeType]] = set()  # For O(1) duplicate checking

    def add_node(self, n: Node) -> Node:
        self.nodes.setdefault(n.id, n)
        return self.nodes[n.id]

    def add_contains(self, parent_id: str, child_id: str):
        edge_key = (parent_id, child_id, EdgeType.CONTAINS)
        if edge_key not in self._edge_set:
            self._edge_set.add(edge_key)
            self.edges.append(Edge(src=parent_id, dst=child_id, type=EdgeType.CONTAINS))

    def add_edge(self, src_id: str, dst_id: str, edge_type: EdgeType):
        """Add an edge of any type between two nodes."""
        edge_key = (src_id, dst_id, edge_type)
        if edge_key not in self._edge_set:
            self._edge_set.add(edge_key)
            self.edges.append(Edge(src=src_id, dst=dst_id, type=edge_type))

        # ---- adjacency + k-hop traversal ----
    def _build_adj(self) -> Tuple[Dict[str, Set[str]], Dict[str, Set[str]]]:
        fwd: Dict[str, Set[str]] = defaultdict(set)
        bwd: Dict[str, Set[str]] = defaultdict(set)
        for e in self.edges:
            fwd[e.src].add(e.dst)
            bwd[e.dst].add(e.src)
        return fwd, bwd

    def khop(
        self,
        seeds: List[str],
        hops: int = 1,
        allowed: Set[NodeLabel] | Set[str] | None = None,
    ) -> List[str]:
        """
        Return unique node ids within k hops (both directions).
        If `allowed` is provided, only keep neighbors whose label is in that set.
        `allowed` may contain NodeLabel values or their string values (e.g. "class").
        """
        fwd, bwd = self._build_adj()
        seen = set(seeds)
        q = deque(seeds)

        for _ in range(max(0, hops)):
            next_frontier = deque()
            while q:
                u = q.popleft()
                for v in fwd.get(u, set()) | bwd.get(u, set()):
                    if v in seen:
                        continue
                    if allowed is not None:
                        n = self.nodes.get(v)
                        if n is None:
                            continue
                        lab_enum = n.label
                        lab_str  = lab_enum.value  # "folder"/"file"/"class"/"function"/"method"
                        if (lab_enum not in allowed) and (lab_str not in allowed):
                            continue
                    seen.add(v)
                    next_frontier.append(v)
            q = next_frontier
            if not q:
                break

        return list(seen)

    def save(self, path: str):
        """Save graph to JSON file."""
        import json
        from pathlib import Path as PathLib

        # Convert to serializable format
        data = {
            "nodes": [
                {
                    "id": n.id,
                    "label": n.label.value,
                    "path": n.path,
                    "name": n.name,
                    "start_line": n.start_line,
                    "end_line": n.end_line,
                    "extra": n.extra,
                    "summary_short": n.summary_short,
                    "summary_detailed": n.summary_detailed,
                    "loc": n.loc,
                    "fan_in": n.fan_in,
                    "fan_out": n.fan_out
                }
                for n in self.nodes.values()
            ],
            "edges": [
                {
                    "src": e.src,
                    "dst": e.dst,
                    "type": e.type.value
                }
                for e in self.edges
            ]
        }

        # Write to file
        PathLib(path).parent.mkdir(parents=True, exist_ok=True)
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)

    @staticmethod
    def load(path: str) -> 'Graph':
        """Load graph from JSON file."""
        import json

        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        graph = Graph()

        # Load nodes
        for node_data in data["nodes"]:
            node = Node(
                id=node_data["id"],
                label=NodeLabel(node_data["label"]),
                path=node_data["path"],
                name=node_data["name"],
                start_line=node_data.get("start_line"),
                end_line=node_data.get("end_line"),
                extra=node_data.get("extra", {}),
                summary_short=node_data.get("summary_short"),
                summary_detailed=node_data.get("summary_detailed"),
                loc=node_data.get("loc"),
                fan_in=node_data.get("fan_in", 0),
                fan_out=node_data.get("fan_out", 0)
            )
            graph.nodes[node.id] = node

        # Load edges
        for edge_data in data["edges"]:
            edge = Edge(
                src=edge_data["src"],
                dst=edge_data["dst"],
                type=EdgeType(edge_data["type"])
            )
            graph.edges.append(edge)
            edge_key = (edge.src, edge.dst, edge.type)
            graph._edge_set.add(edge_key)

        return graph
