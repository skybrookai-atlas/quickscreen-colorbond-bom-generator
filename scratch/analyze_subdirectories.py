import json
from pathlib import Path
from collections import Counter

with open('graphify-out/.graphify_detect.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

scan_root = Path(data.get('scan_root', '.')).resolve()
# Concatenate all files across types
all_files = []
for file_list in data.get('files', {}).values():
    if isinstance(file_list, list):
        all_files.extend(file_list)

# Filter out graphify-out
filtered_files = []
for f in all_files:
    f_path = Path(f).resolve()
    # check if f_path starts with scan_root / graphify-out
    try:
        rel = f_path.relative_to(scan_root)
        if rel.parts and rel.parts[0] == 'graphify-out':
            continue
        filtered_files.append(f_path)
    except ValueError:
        pass

# Compute subdirectories
subdirs = []
for f_path in filtered_files:
    try:
        rel = f_path.relative_to(scan_root)
        if len(rel.parts) > 1:
            subdirs.append(rel.parts[0])
        else:
            subdirs.append('(root)')
    except ValueError:
        pass

counts = Counter(subdirs)
print("WARNING: Large corpus detected.")
print(f"Total files: {len(filtered_files)}")
print(f"Total estimated words: {data.get('total_words', 0):,}")
print("\nTop 5 first-level subdirectories by file count:")
for subdir, count in counts.most_common(5):
    print(f"  {subdir}/: {count} files")
