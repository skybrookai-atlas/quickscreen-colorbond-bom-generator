import json
from pathlib import Path
from graphify.build import build_from_json
from graphify.cluster import score_all
from graphify.analyze import god_nodes, surprising_connections, suggest_questions
from graphify.report import generate

# Load files
extraction = json.loads(Path('graphify-out/.graphify_extract.json').read_text(encoding="utf-8"))
detection  = json.loads(Path('graphify-out/.graphify_detect.json').read_text(encoding="utf-8"))
analysis   = json.loads(Path('graphify-out/.graphify_analysis.json').read_text(encoding="utf-8"))

G = build_from_json(extraction)
communities = {int(k): v for k, v in analysis['communities'].items()}
cohesion = {int(k): v for k, v in analysis['cohesion'].items()}
tokens = {'input': extraction.get('input_tokens', 0), 'output': extraction.get('output_tokens', 0)}

# Hardcode labels for top largest communities in Supabase codebase
top_labels = {
    0: "BOM Calculator Edge Function Engine",
    1: "Edge Functions Auth & Transport Framework",
    2: "Pricing Logic & Validation Tests",
    3: "Canonical Layout Segments & Definitions",
    4: "BOM Engine Integration Tests",
    5: "Pricing DB Rules Helper"
}

# Rule-based namer for the remaining communities
labels = {}
nodes_map = {n['id']: n for n in extraction['nodes']}

for cid, node_ids in communities.items():
    if cid in top_labels:
        labels[cid] = top_labels[cid]
        continue
    
    # Analyze the nodes in the community
    labels_list = [nodes_map.get(nid, {}).get('label', nid) for nid in node_ids if nid in nodes_map]
    if not labels_list:
        labels_list = node_ids
    
    # If it has nodes ending in .tsx or .ts, it is a file/module
    ts_files = [l for l in labels_list if l.endswith('.tsx') or l.endswith('.ts') or l.endswith('.sql') or l.endswith('.json')]
    
    if ts_files:
        labels[cid] = f"Module: {ts_files[0]}"
    elif len(labels_list) == 1:
        labels[cid] = f"Symbol: {labels_list[0]}"
    elif len(labels_list) <= 3:
        labels[cid] = " & ".join(labels_list[:3])
    else:
        labels[cid] = f"Group: {', '.join(labels_list[:2])}..."

# Regenerate questions with real community labels
questions = suggest_questions(G, communities, labels)

# Generate and save report
report = generate(G, communities, cohesion, labels, analysis['gods'], analysis['surprises'], detection, tokens, '.', suggested_questions=questions)
Path('graphify-out/GRAPH_REPORT.md').write_text(report, encoding="utf-8")
Path('graphify-out/.graphify_labels.json').write_text(json.dumps({str(k): v for k, v in labels.items()}, ensure_ascii=False), encoding="utf-8")

print("Report successfully updated with community labels.")
