// Validates index.html: every subtopic has a lesson, hand-written problems are well formed,
// every set has >= 50 problems, and every generator produces sane, distinct choices.
// Usage: node test.js [index.html] [samplesPerGenerator]
const fs = require('fs'), vm = require('vm');
const file = process.argv[2] || __dirname + '/index.html';
const N = +process.argv[3] || 1500;
const html = fs.readFileSync(file, 'utf8');
const main = html.match(/<script id="main">([\s\S]*?)<\/script>/)[1];
const bank = html.match(/<script type="text\/plain" id="bank">([\s\S]*?)<\/script>/)[1];
const ctx = { console, Math, Date, JSON }; vm.createContext(ctx);
vm.runInContext(main + '\n;this.API={loadData,SETS,GENS,mkGen,hash,SUBS,TOPICS,BANK:()=>BANK,freshGen};', ctx);
const A = ctx.API; A.loadData(bank);
let bad = 0; const err = m => { bad++; if (bad < 400) console.log('ERR', m); };
let totalProblems = 0, totalClassic = 0;
for (const s of A.SUBS) {
  const set = A.SETS[s.id] || []; const c = set.filter(x => x.src === 'c').length;
  totalProblems += set.length; totalClassic += c;
  if (!html.includes(`id="L-${s.id}"`)) err(s.id + ' has no lesson');
  if (set.length < 50) err(`${s.id} only ${set.length} problems (classic ${c}, gens ${(A.GENS[s.id] || []).length})`);
  if (!c) err(s.id + ' has no hand-written problems');
  for (const it of A.BANK()[s.id] || []) {
    if (it.W.length !== 4) err(s.id + ' W count ' + it.W.length + ': ' + it.Q.slice(0, 60));
    if (!it.S) err(s.id + ' no solution: ' + it.Q.slice(0, 40));
    if (!it.A) err(s.id + ' no answer: ' + it.Q.slice(0, 40));
    const all = [it.A, ...it.W].map(x => x.trim());
    if (new Set(all).size !== 5) err(s.id + ' duplicate choices: ' + it.Q.slice(0, 50));
    if (!/^[123]$/.test((it.L || '').trim())) err(s.id + ' bad level: ' + it.Q.slice(0, 40));
    const btxt = [it.Q, it.A, ...it.W, it.S].join(' ');
    const g2 = btxt.match(/\\(?:(?:le|lt|ge|gt)(?!ft|q|floor|ss|ad)|pm(?!od)|cdot(?!s)|infty|times)[a-zA-Z]/);
    if (g2) err(s.id + ' TeX command runs into a letter: ' + btxt.slice(Math.max(0, g2.index - 30), g2.index + 20));
    if ((btxt.replace(/\\\$/g, '').match(/\$/g) || []).length % 2) err(s.id + ' unbalanced $ in: ' + it.Q.slice(0, 50));
  }
  const qs = new Set(); for (const it of set) { if (qs.has(it.q)) err(s.id + ' dup question'); qs.add(it.q); }
}
for (const k of Object.keys(A.BANK())) if (!A.SUBS.find(s => s.id === k)) err('bank section for unknown subtopic ' + k);
for (const s of A.SUBS) { try { const g = A.freshGen(s.id, 5); if ((A.GENS[s.id] || []).length + (A.GENS[s.id + ':practice'] || []).length && !g.length) err('practice drills empty for ' + s.id); } catch (e) { err('practice drills crash for ' + s.id + ': ' + e.message); } }
for (const k of Object.keys(A.GENS)) if (!A.SUBS.find(s => s.id === k.replace(/:practice$/, ''))) err('GENS for unknown subtopic ' + k);
const bads = /NaN|undefined|Infinity|\[object|null/;
for (const [sub, gens] of Object.entries(A.GENS)) {
  if (sub === 'mixed') continue;
  gens.forEach((g, gi) => {
    for (let k = 0; k < N; k++) {
      let it; try { it = A.mkGen(sub, g, A.hash(sub + gi + 'x' + k), 't'); } catch (e) { err(`${sub}[${gi}] throws: ${e.message}`); break; }
      const txt = it.q + it.sol + it.choices.join('|');
      if (bads.test(txt)) { err(`${sub}[${gi}] bad text: ` + txt.match(/.{0,50}(NaN|undefined|Infinity|\[object|null).{0,20}/)[0]); break; }
      if (it.choices.length !== 5) { err(`${sub}[${gi}] ${it.choices.length} choices: ${it.choices.join(' ')}`); break; }
      if (new Set(it.choices).size !== 5) { err(`${sub}[${gi}] duplicate choices`); break; }
      if (it.ans < 0 || it.ans > 4) { err(`${sub}[${gi}] answer index`); break; }
      if (/\$-?\d+\.\d{5,}/.test(it.choices.join(''))) { err(`${sub}[${gi}] float choice ${it.choices.join(' ')}`); break; }
      const glued = txt.match(/\\(?:(?:le|lt|ge|gt)(?!ft|q|floor|ss|ad)|pm(?!od)|cdot(?!s)|infty|times)[a-zA-Z]/);
      if (glued) { err(`${sub}[${gi}] TeX command runs into a letter: ` + txt.slice(Math.max(0, glued.index - 30), glued.index + 20)); break; }
    }
  });
}
console.log(`subtopics ${A.SUBS.length}, problems ${totalProblems}, hand-written ${totalClassic}`);
console.log('errors:', bad);
process.exit(bad ? 1 : 0);
