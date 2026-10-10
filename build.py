"""Build index.html (Ionized Study) from src/.

src/shell.html        head, styles, header, timer markup
src/timer.html        focus-timer script
src/topics/<id>.txt   one file per topic with three sections:
                        === LESSONS ===  <script type="text/plain" id="L-<sub>"> blocks
                        === BANK ===     hand-written problems (@@ <sub> ... --- ...)
                        === GENS ===     GENS['<sub>']=[...] problem generators
src/engine_*.js, src/catalog.js   app code
"""
import os, re, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, 'src')
ORDER = ['alg', 'quad', 'func', 'polys', 'ineq', 'seq', 'tri', 'circ', 'polyg', 'coord', 'solid',
         'div', 'mod', 'base', 'dioph', 'count', 'prob', 'binom', 'explog', 'trig', 'cplx', 'conic']


def rd(*p):
    with open(os.path.join(SRC, *p), encoding='utf-8') as f:
        return f.read()


def split_topic(text, name):
    m = re.match(r'\s*=== LESSONS ===\n(.*)\n=== BANK ===\n(.*)\n=== GENS ===\n(.*)\Z', text, re.S)
    if not m:
        sys.exit(f'bad topic file format: {name}')
    return m.group(1), m.group(2), m.group(3)


lessons, banks, gens = [], [], []
for tid in ORDER:
    path = os.path.join(SRC, 'topics', tid + '.txt')
    if not os.path.exists(path):
        print('  (missing topic file)', tid)
        continue
    l, b, g = split_topic(rd('topics', tid + '.txt'), tid)
    lessons.append(l.strip())
    banks.append(b.strip())
    gens.append(f'/* ---- {tid} ---- */\n' + g.strip())

js = '\n'.join([rd('engine_utils.js'), rd('catalog.js'), '\n'.join(gens), rd('engine_model.js'),
                rd('engine_pages.js'), rd('engine_ui.js'), rd('engine_mock.js'), rd('sync.js')])
html = (rd('shell.html')
        + '<!-- ======================= LESSONS ======================= -->\n' + '\n'.join(lessons)
        + '\n\n<!-- ======================= PROBLEM BANK ======================= -->\n'
        + '<script type="text/plain" id="bank">\n' + '\n'.join(banks) + '\n</script>\n'
        + rd('timer.html') + '\n<script id="main">\n' + js + '\n</script>\n</body>\n</html>\n')

for out in [os.path.join(ROOT, 'index.html')] + sys.argv[1:]:
    with open(out, 'w', encoding='utf-8', newline='\n') as f:
        f.write(html)
    print('wrote', out, f'{len(html)/1024:.0f} KB')
