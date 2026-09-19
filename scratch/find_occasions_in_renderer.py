with open(r'E:\vig\cakes2home-main\cakes2home-main\frontend\src\components\store\cms\page-renderer.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for idx, line in enumerate(lines, 1):
    low = line.lower()
    if 'occasion' in low or 'occ_' in low or 'key={' in line or 'key="' in line:
        safe_line = line.strip().encode('ascii', errors='replace').decode('ascii')
        if any(w in low for w in ['occasion', 'occ_']):
            print(f'{idx}: {safe_line[:120]}')
