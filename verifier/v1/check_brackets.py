import sys, re
def strip_strings_comments(src):
    # crude: remove template/quoted strings and comments
    src = re.sub(r'//[^\n]*', '', src)
    src = re.sub(r'/\*.*?\*/', '', src, flags=re.S)
    src = re.sub(r"'(?:\\.|[^'\\\n])*'", "''", src)
    src = re.sub(r'"(?:\\.|[^"\\\n])*"', '""', src)
    src = re.sub(r'`(?:\\.|[^`\\])*`', '``', src, flags=re.S)
    return src
ok = True
for path in sys.argv[1:]:
    src = strip_strings_comments(open(path, encoding='utf-8').read())
    stack = []
    pairs = {')':'(', ']':'[', '}':'{'}
    for i, ch in enumerate(src):
        if ch in '([{': stack.append(ch)
        elif ch in ')]}':
            if not stack or stack.pop() != pairs[ch]:
                print(f'MISMATCH {path} at char {i}: {ch}'); ok = False; break
    else:
        if stack: print(f'UNCLOSED {path}: {stack[-5:]}'); ok = False
    if ok: print(f'OK {path}')
sys.exit(0 if ok else 1)
