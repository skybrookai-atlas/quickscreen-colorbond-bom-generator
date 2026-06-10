import json
from graphify.cache import check_semantic_cache
from pathlib import Path

detect = json.loads(Path('graphify-out/.graphify_detect.json').read_text(encoding="utf-8"))
# Get non-code files (docs, papers, images, etc.)
non_code_files = []
for cat, files in detect.get('files', {}).items():
    if cat != 'code':
        non_code_files.extend(files)

if non_code_files:
    cached_nodes, cached_edges, cached_hyperedges, uncached = check_semantic_cache(non_code_files)
    print(f"Non-code files: {len(non_code_files)}")
    print(f"Uncached non-code files: {len(uncached)}")
    print("Uncached non-code list:", uncached)
else:
    print("Zero non-code files detected.")
