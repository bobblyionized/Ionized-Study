"""Rewrite solutions in a topic file without touching anything else.

  python tools/expand.py dump <topic>            print bank problems and generator code, numbered
  python tools/expand.py apply <topic> <patch>   apply a patch file

Patch file format (blocks start with ###):
  ### B <subtopic> <n>          replace the S: of the n-th hand-written problem (1-based) in @@ <subtopic>
  <new solution, any number of lines>
  ### G <subtopic> <g> [k]      replace the k-th (default 0) s: expression of generator g (0-based)
  <new JavaScript expression, e.g. T`...`>
"""
import os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOP = os.path.join(ROOT, 'src', 'topics')


def read(tid):
    p = os.path.join(TOP, tid + '.txt')
    return p, open(p, encoding='utf-8').read()


def sections(text):
    i = text.index('=== BANK ===\n') + len('=== BANK ===\n')
    j = text.index('=== GENS ===')
    return i, j


def bank_blocks(text):
    """yield (sub, n, start, end) spans of every hand-written problem block"""
    i, j = sections(text)
    bank = text[i:j]
    out = []
    for m in re.finditer(r'^@@\s*(\S+)\s*\n', bank, re.M):
        sub = m.group(1)
        s0 = m.end()
        nxt = re.search(r'^@@', bank[s0:], re.M)
        s1 = s0 + nxt.start() if nxt else len(bank)
        pos, n = s0, 0
        for part in re.split(r'(^---\s*$\n?)', bank[s0:s1], flags=re.M):
            if part.startswith('---') and part.strip() == '---':
                pos += len(part)
                continue
            if re.search(r'^Q:', part, re.M):
                n += 1
                out.append((sub, n, i + pos, i + pos + len(part)))
            pos += len(part)
    return out


def skip_regex(src, j):
    """if src[j] starts a regex literal, return the index after it, else None"""
    if src[j] != '/' or src[j + 1:j + 2] in ('/', '*'): return None
    k = j - 1
    while k >= 0 and src[k] in ' \t\n': k -= 1
    if k >= 0 and src[k] not in '(,=:[!&|?{};+': return None
    k, cls = j + 1, False
    while k < len(src) and src[k] != '\n':
        ch = src[k]
        if ch == '\\': k += 2; continue
        if ch == '[': cls = True
        elif ch == ']': cls = False
        elif ch == '/' and not cls:
            k += 1
            while k < len(src) and src[k].isalpha(): k += 1
            return k
        k += 1
    return None


def scan_expr(src, i):
    """index just past a JS expression starting at i (stops at , ) ] } at depth 0)"""
    st, j = [], i
    while j < len(src):
        c = src[j]
        top = st[-1] if st else None
        if top == '`':
            if c == '\\': j += 2; continue
            if c == '`': st.pop(); j += 1; continue
            if c == '$' and src[j + 1:j + 2] == '{': st.append('${'); j += 2; continue
            j += 1; continue
        if top in ("'", '"'):
            if c == '\\': j += 2; continue
            if c == top: st.pop()
            j += 1; continue
        rx = skip_regex(src, j) if c == '/' else None
        if rx: j = rx; continue
        if c in '\'"`': st.append(c); j += 1; continue
        if c in '([{': st.append(c); j += 1; continue
        if c in ')]}':
            if not st: return j
            st.pop(); j += 1; continue
        if c == ',' and not st: return j
        j += 1
    raise ValueError('unterminated expression')


def gens(text):
    """{sub: [(start, end), ...]} spans of each generator function"""
    j = text.index('=== GENS ===')
    out = {}
    for m in re.finditer(r"GENS(?:\['([^']+)'\]|\.(\w+))=\[\n", text[j:]):
        sub = m.group(1) or m.group(2)
        k = j + m.end()
        spans = []
        while True:
            while text[k] in ' \n\r\t': k += 1
            if text.startswith('];', k) or text[k] == ']': break
            if text.startswith('/*', k):
                k = text.index('*/', k) + 2; continue
            e = scan_expr(text, k)
            spans.append((k, e))
            k = e + 1 if text[e] == ',' else e
        out[sub] = spans
    return out


def s_props(code):
    """start/end offsets of every s: expression inside one generator's code"""
    res, st, j = [], [], 0
    while j < len(code):
        c = code[j]
        top = st[-1] if st else None
        if top == '`':
            if c == '\\': j += 2; continue
            if c == '`': st.pop()
            elif c == '$' and code[j + 1:j + 2] == '{': st.append('${'); j += 2; continue
            j += 1; continue
        if top in ("'", '"'):
            if c == '\\': j += 2; continue
            if c == top: st.pop()
            j += 1; continue
        rx = skip_regex(code, j) if c == '/' else None
        if rx: j = rx; continue
        if c in '\'"`': st.append(c); j += 1; continue
        if c in '([{': st.append(c); j += 1; continue
        if c in ')]}':
            if st: st.pop()
            j += 1; continue
        if c == 's' and code[j + 1:j + 2] == ':' and (j == 0 or not re.match(r'[\w$.]', code[j - 1])):
            e = scan_expr(code, j + 2)
            res.append((j + 2, e))
            j = e; continue
        j += 1
    return res


def dump(tid):
    p, text = read(tid)
    for sub, n, a, b in bank_blocks(text):
        blk = text[a:b].strip()
        print(f'### B {sub} {n}\n{blk}\n')
    for sub, spans in gens(text).items():
        for g, (a, b) in enumerate(spans):
            code = text[a:b]
            print(f'### G {sub} {g}  ({len(s_props(code))} s:)\n{code}\n')


def apply(tid, patch):
    p, text = read(tid)
    blocks = re.split(r'^### ', open(patch, encoding='utf-8').read(), flags=re.M)[1:]
    edits = []
    bb = {(s, n): (a, b) for s, n, a, b in bank_blocks(text)}
    gg = gens(text)
    for blk in blocks:
        head, _, body = blk.partition('\n')
        body = body.strip('\n')
        f = head.split()
        if f[0] == 'B':
            a, b = bb[(f[1], int(f[2]))]
            part = text[a:b]
            m = re.search(r'^S:.*?(?=^[QALW]:|\Z)', part, re.M | re.S)
            if not m: sys.exit(f'no S: in {head}')
            new = 'S: ' + body.rstrip() + '\n'
            edits.append((a + m.start(), a + m.end(), new))
        elif f[0] == 'G':
            ga, gb = gg[f[1]][int(f[2])]
            k = int(f[3]) if len(f) > 3 else 0
            props = s_props(text[ga:gb])
            sa, sb = props[k]
            edits.append((ga + sa, ga + sb, body.strip()))
        else:
            sys.exit('bad header ' + head)
    for a, b, new in sorted(edits, reverse=True):
        text = text[:a] + new + text[b:]
    open(p, 'w', encoding='utf-8', newline='\n').write(text)
    print(f'{tid}: applied {len(edits)} edits')


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    cmd = sys.argv[1]
    if cmd == 'dump': dump(sys.argv[2])
    elif cmd == 'apply': apply(sys.argv[2], sys.argv[3])
