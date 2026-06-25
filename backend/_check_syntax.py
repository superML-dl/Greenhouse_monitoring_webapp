import ast, sys, os

target = os.path.join(os.path.dirname(__file__), "app", "cv", "window_slicer.py")
try:
    with open(target, encoding="utf-8") as f:
        ast.parse(f.read())
    print("OK: Syntax is valid")
except SyntaxError as e:
    print(f"FAIL: {e}")
    sys.exit(1)
