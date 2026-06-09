def build_from_json(extraction: dict, *, directed: bool = False, root: str | Path | None = None) -> nx.Graph:
    """Build a NetworkX graph from an extraction dict.

    directed=True produces a DiGraph that preserves edge direction (source→target).
    directed=False (default) produces an undirected Graph for backward compatibility.
    root: if given, absolute source_file paths from semantic subagents are made
        relative to root so all nodes share a consistent path key (#932).
    """
    _root = str(Path(root).resolve()) if root else None
    # NetworkX <= 3.1 serialised edges as "links"; remap to "edges" for compatibility.
    if "edges" not in extraction and "links" in extraction:
        extraction = dict(extraction, edges=extraction["links"])

    # Canonicalize legacy node/edge schema before validation.
    for node in extraction.get("nodes", []):
        if not isinstance(node, dict):
            continue
        if "source" in node and "source_file" not in node:
            # Count edges that reference this node so the warning is actionable (#479)
            node_id = node.get("id", "?")
            affected_edges = sum(
                1 for e in extraction.get("edges", [])
                if e.get("source") == node_id or e.get("target") == node_id
            )
            print(
                f"[graphify] WARNING: node '{node_id}' uses field 'source' instead of "
                f"'source_file' — {affected_edges} edge(s) may be misrouted. "
                f"Rename the field to 'source_file' to silence this warning.",
                file=sys.stderr,
            )
            node["source_file"] = node.pop("source")
        # Default missing/None file_type to "concept" so legacy graph.json
        # entries (and stub nodes preserved by `_rebuild_code` from older
        # graphify versions that didn't always populate file_type) don't
        # trigger spurious "invalid file_type 'None'" validator warnings (#660).
        if node.get("file_type") in (None, ""):
            node["file_type"] = "concept"
        ft = node.get("file_type", "")
        if ft and ft not in {"code", "document", "paper", "image", "rationale", "concept"}:
            node["file_type"] = _FILE_TYPE_SYNONYMS.get(ft, "concept")

    errors = validate_extraction(extraction)
    # Dangling edges (stdlib/external imports) are expected - only warn about real schema errors.
    real_errors = [e for e in errors if "does not match any node id" not in e]
    if real_errors:
        print(f"[graphify] Extraction warning ({len(real_errors)} issues): {real_errors[0]}", file=sys.stderr)
    G: nx.Graph = nx.DiGraph() if directed else nx.Graph()
    for node in extraction.get("nodes", []):
        if "source_file" in node:
            node["source_file"] = _norm_source_file(node["source_file"], _root)
        G.add_node(node["id"], **{k: v for k, v in node.items() if k != "id"})
    node_set = set(G.nodes())

    # #1145: merge semantic ghost-duplicate nodes into AST nodes.
    # When AST and semantic extractors emit different IDs for the same symbol
    # (one has source_location=L<n>, the other has source_location=None), find
    # pairs that share (source_file basename, label) and collapse the semantic
    # copy into the AST copy so edges re-point to a single node.
    # Two passes: first collect all AST (located) nodes, then find ghosts.
    _loc_nodes: dict[tuple[str, str], str] = {}   # (basename, label) -> AST node id
    _noloc_nodes: dict[tuple[str, str], str] = {}  # (basename, label) -> semantic node id
    for nid in node_set:
        attrs = G.nodes[nid]
        label = str(attrs.get("label", "")).strip()
        sf = str(attrs.get("source_file", ""))
        basename = Path(sf).name if sf else ""
        if not label or not basename:
            continue
        if attrs.get("source_location"):
            _loc_nodes[(basename, label)] = nid
    for nid in node_set:
        attrs = G.nodes[nid]
        label = str(attrs.get("label", "")).strip()
        sf = str(attrs.get("source_file", ""))
        basename = Path(sf).name if sf else ""
        if not label or not basename or attrs.get("source_location"):
            continue
        key = (basename, label)
        if key in _loc_nodes and _loc_nodes[key] != nid:
            _noloc_nodes[key] = nid
    # For every ghost that has an AST counterpart, record a remap.
    _ghost_remap: dict[str, str] = {}  # ghost_id -> canonical_id
    for key, sem_id in _noloc_nodes.items():
        ast_id = _loc_nodes.get(key)
        if ast_id is not None:
            _ghost_remap[sem_id] = ast_id
    # Remove ghost nodes from the graph; edges will be re-pointed via norm_to_id.
    for ghost_id in _ghost_remap:
        G.remove_node(ghost_id)
        node_set.discard(ghost_id)

    # Normalized ID map: lets edges survive when the LLM generates IDs with
    # slightly different casing or punctuation than the AST extractor.
    # e.g. "Session_ValidateToken" maps to "session_validatetoken".
    norm_to_id: dict[str, str] = {_normalize_id(nid): nid for nid in node_set}
    # Also map ghost IDs to their canonical AST replacements.
    for ghost_id, canonical_id in _ghost_remap.items():
        norm_to_id[_normalize_id(ghost_id)] = canonical_id
        norm_to_id[ghost_id] = canonical_id
    # Iterate edges in a deterministic order. The graph is undirected and stores
    # direction in _src/_tgt; when two edges collapse onto the same node pair the
    # last write wins, so an unstable iteration order flips _src/_tgt run-to-run
    # and makes the serialized graph churn. Sorting fixes the last-write outcome.
    for edge in sorted(
        extraction.get("edges", []),
        key=lambda e: (
            str(e.get("source", e.get("from", ""))),
            str(e.get("target", e.get("to", ""))),
            str(e.get("relation", "")),
        ),
    ):
        if "source" not in edge and "from" in edge:
            edge["source"] = edge["from"]
        if "target" not in edge and "to" in edge:
            edge["target"] = edge["to"]
        if "source" not in edge or "target" not in edge:
            continue
        src, tgt = edge["source"], edge["target"]
        # Remap mismatched IDs via normalization before dropping the edge.
        if src not in node_set:
            src = norm_to_id.get(_normalize_id(src), src)
        if tgt not in node_set:
            tgt = norm_to_id.get(_normalize_id(tgt), tgt)
        if src not in node_set or tgt not in node_set:
            continue  # skip edges to external/stdlib nodes - expected, not an error
        attrs = {k: v for k, v in edge.items() if k not in ("source", "target")}
        if "source_file" in attrs:
            attrs["source_file"] = _norm_source_file(attrs["source_file"], _root)
        # Drop cross-language INFERRED `calls` edges — same short names (render,
        # parse, etc.) appear across language boundaries in multi-language chunks,
        # producing phantom edges that don't represent real call relationships.
        if attrs.get("relation") == "calls" and attrs.get("confidence") == "INFERRED":
            _LANG_FAMILY: dict[str, str] = {
                ".py": "py", ".pyi": "py",
                ".js": "js", ".mjs": "js", ".cjs": "js", ".jsx": "js",
                ".ts": "js", ".tsx": "js",
                ".go": "go", ".rs": "rs",
                ".java": "jvm", ".kt": "jvm", ".scala": "jvm", ".groovy": "jvm",
                ".c": "c", ".h": "c", ".cc": "cpp", ".cpp": "cpp", ".hpp": "cpp",
                ".rb": "rb", ".php": "php", ".cs": "cs", ".swift": "swift", ".lua": "lua",
            }
            src_ext = Path(G.nodes[src].get("source_file") or "").suffix.lower()
            tgt_ext = Path(G.nodes[tgt].get("source_file") or "").suffix.lower()
            if src_ext and tgt_ext and _LANG_FAMILY.get(src_ext) != _LANG_FAMILY.get(tgt_ext):
                continue
        # Preserve original edge direction - undirected graphs lose it otherwise,
        # causing display functions to show edges backwards.
        attrs["_src"] = src
        attrs["_tgt"] = tgt
        # When the graph is undirected and the same node pair appears twice with
        # the same relation but opposite directions (e.g. a `calls` b and b `calls` a),
        # nx.Graph collapses them into one edge. The deterministic sort above means
        # the lexicographically-later direction would systematically overwrite the
        # earlier one's _src/_tgt, silently flipping the surviving edge's caller
        # and callee. First-seen direction wins instead — drop the redundant
        # reverse-direction duplicate so the original direction is preserved (#1061).
        if not G.is_directed() and G.has_edge(src, tgt):
            existing = edge_data(G, src, tgt)
            if existing.get("relation") == attrs.get("relation") and (
                existing.get("_src") == tgt and existing.get("_tgt") == src
            ):
                continue
        G.add_edge(src, tgt, **attrs)
    hyperedges = extraction.get("hyperedges", [])
    if hyperedges:
        G.graph["hyperedges"] = hyperedges
    return G
