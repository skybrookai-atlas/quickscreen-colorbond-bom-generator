import json
from pathlib import Path
from graphify.extract import _file_node_id

# Load detect to get all code files
with open('graphify-out/.graphify_detect.json', 'r', encoding='utf-8') as f:
    detect = json.load(f)

# Load AST
ast_path = Path('graphify-out/.graphify_ast.json')
ast = json.loads(ast_path.read_text(encoding="utf-8")) if ast_path.exists() else {'nodes':[], 'edges':[], 'input_tokens':0, 'output_tokens':0}

# Get project root to make paths relative
scan_root = Path(detect.get('scan_root', '.')).resolve()
project_root = Path('.').resolve()

# Create file nodes
file_nodes = []
existing_ids = {n['id'] for n in ast['nodes']}

for f in detect.get('files', {}).get('code', []):
    f_path = Path(f).resolve()
    # Get path relative to project root
    try:
        rel_path = f_path.relative_to(project_root)
    except ValueError:
        rel_path = f_path
    
    file_id = _file_node_id(rel_path)
    if file_id not in existing_ids:
        file_nodes.append({
            "id": file_id,
            "label": f_path.name,
            "file_type": "code",
            "source_file": str(rel_path).replace('\\', '/'),
            "_origin": "ast_file"
        })
        existing_ids.add(file_id)

print(f"Adding {len(file_nodes)} file-level nodes...")
ast['nodes'].extend(file_nodes)

# Save enriched AST
ast_path.write_text(json.dumps(ast, indent=2, ensure_ascii=False), encoding="utf-8")
print("Saved enriched AST.")
