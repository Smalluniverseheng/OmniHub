import re, sys
root = sys.argv[1]
prov = open(root+'/js/providers.js', encoding='utf-8').read()
m = re.search(r"APP_VERSION\s*=\s*['\"]v?([\d.]+)['\"]", prov)
ver = m.group(1) if m else None
if not ver or not re.fullmatch(r'\d+\.\d+', ver):
    print('BAD VERSION FORMAT:', ver); sys.exit(1)
idx = open(root+'/index.html', encoding='utf-8').read()
vs = set(re.findall(r'\?v=([\d.]+)', idx))
sw = open(root+'/sw.js', encoding='utf-8').read()
swm = re.search(r"VERSION\s*=\s*['\"]v?([\d.]+)['\"]", sw)
clog = open(root+'/js/changelog.js', encoding='utf-8').read()
cm = re.findall(r"version:\s*['\"]([\d.]+)['\"]", clog)
print('APP_VERSION:', ver)
print('index.html ?v=:', vs)
print('sw.js VERSION:', swm.group(1) if swm else None)
print('changelog versions tail:', cm[-3:])
ok = (vs == {ver}) and swm and swm.group(1) == ver and cm and cm[-1] == ver
print('VERSION SYNC:', 'OK' if ok else 'FAIL')
sys.exit(0 if ok else 1)
