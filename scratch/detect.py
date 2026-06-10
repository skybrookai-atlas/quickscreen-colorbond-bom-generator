import json
from pathlib import Path
from graphify.detect import detect

result = detect(Path('supabase'))
with open('graphify-out/.graphify_detect.json', 'w', encoding='utf-8') as f:
    json.dump(result, f, ensure_ascii=False, indent=2)
print("SUCCESS")
