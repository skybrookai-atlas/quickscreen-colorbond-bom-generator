import json
from pathlib import Path

# Load AST
ast_path = Path('graphify-out/.graphify_ast.json')
ast = json.loads(ast_path.read_text(encoding="utf-8")) if ast_path.exists() else {'nodes':[], 'edges':[], 'input_tokens':0, 'output_tokens':0}

# Create empty semantic since there are only SVGs and no docs/text files
sem = {'nodes':[], 'edges':[], 'hyperedges':[], 'input_tokens':0, 'output_tokens':0}
Path('graphify-out/.graphify_semantic.json').write_text(json.dumps(sem, indent=2, ensure_ascii=False), encoding="utf-8")

# Merge: AST nodes first, semantic nodes deduplicated by id
seen = {n['id'] for n in ast['nodes']}
merged_nodes = list(ast['nodes'])
for n in sem['nodes']:
    if n['id'] not in seen:
        merged_nodes.append(n)
        seen.add(n['id'])

merged_edges = ast['edges'] + sem['edges']
merged_hyperedges = sem.get('hyperedges', [])
merged = {
    'nodes': merged_nodes,
    'edges': merged_edges,
    'hyperedges': merged_hyperedges,
    'input_tokens': sem.get('input_tokens', 0) + ast.get('input_tokens', 0),
    'output_tokens': sem.get('output_tokens', 0) + ast.get('output_tokens', 0),
}
Path('graphify-out/.graphify_extract.json').write_text(json.dumps(merged, indent=2, ensure_ascii=False), encoding="utf-8")
total = len(merged_nodes)
edges = len(merged_edges)
print(f'Merged: {total} nodes, {edges} edges ({len(ast["nodes"])} AST + {len(sem["nodes"])} semantic)')
