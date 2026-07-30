import re, os, sys
root = sys.argv[1]
idx = open(root+'/index.html', encoding='utf-8').read()
refs = re.findall(r'(?:src|href)="([^"?]+)(?:\?v=[\d.]+)?"', idx)
missing = []
for r in refs:
    if r.startswith(('http', 'data:', 'manifest')): continue
    if not os.path.exists(os.path.join(root, r)): missing.append(r)
print('checked', len(refs), 'refs,', 'missing:', missing)
sys.exit(1 if missing else 0)
