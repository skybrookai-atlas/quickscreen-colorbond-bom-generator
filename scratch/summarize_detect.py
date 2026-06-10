import json
from pathlib import Path

with open('graphify-out/.graphify_detect.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

total_files = data.get('total_files', 0)
total_words = data.get('total_words', 0)

print(f"Corpus: {total_files} files · ~{total_words:,} words")
for cat, files in data.get('files', {}).items():
    if files:
        extensions = sorted(list(set(Path(f).suffix for f in files if Path(f).suffix)))
        ext_str = " (" + " ".join(extensions) + ")" if extensions else ""
        print(f"  {cat}:     {len(files)} files{ext_str}")

skipped = data.get('skipped_sensitive', [])
if skipped:
    print(f"  (Skipped {len(skipped)} sensitive/ignored files)")
