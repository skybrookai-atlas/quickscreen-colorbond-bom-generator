import graphify.build
import inspect

src = inspect.getsource(graphify.build.build_from_json)
with open('scratch/build_src.py', 'w', encoding='utf-8') as f:
    f.write(src)
print("Saved")
