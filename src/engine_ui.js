/* ---------- problem card ---------- */
function cardHTML(it,num,opts={}){
  const tag=it.src==='c'?'<span class="pill">AMC-style</span>':'<span class="pill g">Skill drill</span>';
  return`<div class="prob" data-id="${it.id}">
   <div class="phead"><b>#${num}</b>${tag}<span class="lv" title="Difficulty">${stars(it.lvl)}</span>${opts.extra||''}<span class="spacer"></span><span class="status"></span></div>
   <div class="ptext">${it.q}</div>
   <div class="choices">${it.choices.map((c,i)=>`<button class="ch" data-i="${i}"><b>(${L[i]})</b><span>${c}</span></button>`).join('')}</div>
   <div class="fb"></div>
   <div class="sol" hidden><details><summary>Show full solution</summary><div class="solbody">${it.sol}</div></details></div>
  </div>`;
}
function revealCard(el,it,chosen,openSol){
  el.querySelectorAll('.ch').forEach(b=>{const i=+b.dataset.i;b.disabled=true;b.classList.remove('sel');
    if(i===it.ans)b.classList.add('right');else if(i===chosen)b.classList.add('wrong')});
  const fb=el.querySelector('.fb');const st=el.querySelector('.status');
  if(chosen===null||chosen===undefined){fb.className='fb no';fb.textContent='Skipped. The answer is ('+L[it.ans]+').';st.innerHTML='<span class="pill g">Blank</span>'}
  else if(chosen===it.ans){fb.className='fb ok';fb.textContent='Correct!';st.innerHTML='<span class="pill ok">Correct</span>'}
  else{fb.className='fb no';fb.textContent='Not quite. The answer is ('+L[it.ans]+').';st.innerHTML='<span class="pill no">Missed</span>'}
  const sol=el.querySelector('.sol');sol.hidden=false;if(openSol)sol.querySelector('details').open=true;
}

/* ---------- problem set ---------- */
function setView(sid,body){
  const set=SETS[sid];let filter='all';
  const statHTML=()=>{const st=subStats(sid);return`<div><b>${st.done}/${st.total}</b><span>attempted</span></div><div><b>${st.ok}</b><span>correct</span></div><div><b>${st.done?Math.round(st.ok/st.done*100):0}%</b><span>accuracy</span></div>`};
  body.innerHTML=`<div class="stat" id="sstat">${statHTML()}</div>
  <div class="filters" id="flt">${[['all','All'],['c','AMC-style'],['g','Skill drills'],['1','★ Easy'],['2','★★ Medium'],['3','★★★ Hard'],['new','Unattempted'],['miss','Missed']].map(([k,n])=>`<button class="chip ${k==='all'?'on':''}" data-f="${k}">${n}</button>`).join('')}
  <span class="spacer"></span><button class="chip" id="resetset">Reset this set</button></div><div id="plist"></div>`;
  const list=body.querySelector('#plist');
  function draw(){
    const items=set.map((it,i)=>[it,i+1]).filter(([it])=>{const p=PROG.q[it.id];
      if(filter==='all')return true;if(filter==='c'||filter==='g')return it.src===filter;if(filter==='new')return!p;if(filter==='miss')return p&&!p.ok;return String(it.lvl)===filter});
    list.innerHTML=items.length?items.map(([it,n])=>cardHTML(it,n)).join(''):'<div class="empty">No problems match this filter.</div>';
    for(const [it] of items){const p=PROG.q[it.id];if(p)revealCard(list.querySelector(`[data-id="${it.id}"]`),it,p.c,false)}
    renderMath(list);
  }
  list.addEventListener('click',e=>{const b=e.target.closest('.ch');if(!b||b.disabled)return;const card=b.closest('.prob');const it=set.find(x=>x.id===card.dataset.id);
    const c=+b.dataset.i;PROG.q[it.id]={c,ok:c===it.ans};saveProg();revealCard(card,it,c,c!==it.ans);body.querySelector('#sstat').innerHTML=statHTML()});
  body.querySelector('#flt').addEventListener('click',e=>{const b=e.target.closest('.chip');if(!b)return;
    if(b.id==='resetset'){if(confirm('Clear your answers for this problem set?')){for(const it of set)delete PROG.q[it.id];saveProg();setView(sid,body)}return}
    filter=b.dataset.f;body.querySelectorAll('#flt .chip[data-f]').forEach(x=>x.classList.toggle('on',x===b));draw()});
  draw();
}

/* ---------- practice mode ---------- */
function practiceSetup(sid,body){
  const hist=PROG.pr[sid];
  body.innerHTML=`<div class="card">
  <h3 style="margin-top:4px">Practice Mode</h3>
  <p class="meta" style="font-size:14.5px">Each session gives you a <b>fresh, randomized</b> set of questions: hand-written AMC-style problems mixed with newly generated drills, so the numbers change every time. Answer one question at a time and get instant feedback with a full solution.</p>
  <div class="opt"><label class="h">Number of questions</label><div class="filters" data-o="n">${[10,15,25,50].map(n=>`<button class="chip ${n===15?'on':''}" data-v="${n}">${n}</button>`).join('')}</div></div>
  <div class="opt"><label class="h">Question mix</label><div class="filters" data-o="mix">${[['mix','AMC-style + drills'],['c','AMC-style only'],['g','Fresh drills only']].map(([k,n],i)=>`<button class="chip ${i===0?'on':''}" data-v="${k}">${n}</button>`).join('')}</div></div>
  <div class="opt"><label class="h">Timer</label><div class="filters" data-o="timer">${[['off','Untimed'],['amc','AMC pace (3 min / question)'],['fast','Speed (90 s / question)']].map(([k,n],i)=>`<button class="chip ${i===0?'on':''}" data-v="${k}">${n}</button>`).join('')}</div></div>
  <div class="row"><button class="btn pri" id="go">Start practice</button>${hist?`<span class="meta">Lifetime practice: ${hist.c}/${hist.t} correct (${Math.round(hist.c/hist.t*100)}%) over ${hist.s} session${hist.s>1?'s':''}</span>`:''}</div></div>`;
  const cfg={n:15,mix:'mix',timer:'off'};
  body.querySelectorAll('[data-o]').forEach(g=>g.addEventListener('click',e=>{const b=e.target.closest('.chip');if(!b)return;g.querySelectorAll('.chip').forEach(x=>x.classList.toggle('on',x===b));const k=g.dataset.o;cfg[k]=k==='n'?+b.dataset.v:b.dataset.v}));
  body.querySelector('#go').onclick=()=>{
    const classics=shuffle(Math.random,SETS[sid].filter(x=>x.src==='c'));let items=[];
    if(cfg.mix==='c'){while(items.length<cfg.n&&classics.length)items.push(classics.shift());if(items.length<cfg.n)items=items.concat(freshGen(sid,cfg.n-items.length))}
    else if(cfg.mix==='g')items=freshGen(sid,cfg.n);
    else{const nc=Math.min(classics.length,Math.ceil(cfg.n/2));items=classics.slice(0,nc).concat(freshGen(sid,cfg.n-nc));items=shuffle(Math.random,items)}
    items.sort((a,b)=>a.lvl-b.lvl);
    runPractice(sid,body,items,cfg);
  };
}
function runPractice(sid,body,items,cfg){
  const N=items.length;const res=new Array(N).fill(undefined);let idx=0,sel=null,locked=false;
  const total=cfg.timer==='amc'?N*180:cfg.timer==='fast'?N*90:0;const t0=Date.now();
  body.innerHTML=`<div class="row" style="margin-bottom:12px"><b id="pcount"></b><span class="meta" id="pscore"></span><span class="spacer"></span>${total?'<span class="timer" id="ptimer"></span>':''}<button class="btn sm" id="pquit">End session</button></div>
  <div id="pq"></div><div class="row" style="margin-top:4px"><button class="btn" id="pskip">Skip</button><span class="spacer"></span><span class="kbd">Keys: A–E choose · Enter submit/next</span><button class="btn pri" id="pgo" disabled>Submit</button></div>`;
  const pq=body.querySelector('#pq'),go=body.querySelector('#pgo'),skip=body.querySelector('#pskip');
  function show(){
    sel=null;locked=false;const it=items[idx];
    body.querySelector('#pcount').textContent=`Question ${idx+1} of ${N}`;
    const c=res.filter(x=>x&&x.r==='ok').length;body.querySelector('#pscore').textContent=`${c} correct so far`;
    pq.innerHTML=cardHTML(it,idx+1);renderMath(pq);go.textContent='Submit';go.disabled=true;skip.disabled=false;
  }
  function choose(i){if(locked)return;sel=i;pq.querySelectorAll('.ch').forEach(b=>b.classList.toggle('sel',+b.dataset.i===i));go.disabled=false}
  function submit(skipped){
    if(locked){idx++;if(idx>=N)return finish();return show()}
    const it=items[idx];const c=skipped?null:sel;res[idx]={c,r:c===null?'blank':c===it.ans?'ok':'no'};
    if(PROG.q.hasOwnProperty(it.id)===false&&it.src==='c'&&c!==null){PROG.q[it.id]={c,ok:c===it.ans};saveProg()}
    locked=true;revealCard(pq.querySelector('.prob'),it,c,c!==it.ans);renderMath(pq);
    go.disabled=false;go.textContent=idx===N-1?'See results':'Next →';skip.disabled=true;
  }
  pq.addEventListener('click',e=>{const b=e.target.closest('.ch');if(b&&!b.disabled)choose(+b.dataset.i)});
  go.onclick=()=>submit(false);skip.onclick=()=>submit(true);
  body.querySelector('#pquit').onclick=()=>{if(confirm('End this session and see results?'))finish()};
  keyHandler=e=>{if(/INPUT|TEXTAREA/.test(e.target.tagName)||document.querySelector('.tm-sheet.open'))return;const k=e.key.toUpperCase();const i=L.indexOf(k);if(i>=0&&k.length===1&&!locked)choose(i);else if(e.key==='Enter'&&!go.disabled){e.preventDefault();go.click()}};
  document.addEventListener('keydown',keyHandler);
  if(total){const tEl=body.querySelector('#ptimer');const tick=()=>{const left=total-(Date.now()-t0)/1000;tEl.textContent='⏱ '+fmtTime(left);tEl.classList.toggle('low',left<60);if(left<=0){clearInterval(timerHandle);timerHandle=null;alert("Time's up!");finish()}};tick();timerHandle=setInterval(tick,1000)}
  function finish(){
    cleanup();const ok=res.filter(x=>x&&x.r==='ok').length,no=res.filter(x=>x&&x.r==='no').length,blank=N-ok-no;
    const answered=ok+no;const h=PROG.pr[sid]||{c:0,t:0,s:0};h.c+=ok;h.t+=answered||0;h.s++;if(h.t>0){PROG.pr[sid]=h;saveProg()}
    const secs=(Date.now()-t0)/1000;
    body.innerHTML=`<div class="card"><h3 style="margin-top:4px">Session results</h3>
     <div class="stat"><div><b>${ok}/${N}</b><span>correct</span></div><div><b>${N?Math.round(ok/N*100):0}%</b><span>score</span></div><div><b>${(ok*6+blank*1.5).toFixed(1)}</b><span>AMC points (of ${N*6})</span></div><div><b>${fmtTime(secs)}</b><span>time used</span></div></div>
     <div class="row"><button class="btn pri" id="again">New session</button><button class="btn" onclick="location.hash='#/s/${sid}/lesson'">Review lesson</button></div></div>
     <h3>Review</h3><div id="rev"></div>`;
    const rev=body.querySelector('#rev');
    rev.innerHTML=items.map((it,i)=>cardHTML(it,i+1)).join('');
    items.forEach((it,i)=>{const el=rev.children[i];const r_=res[i];revealCard(el,it,r_?r_.c:null,false);
      if(!r_){el.querySelector('.fb').textContent='Not reached. The answer is ('+L[it.ans]+').'}});
    renderMath(rev);body.querySelector('#again').onclick=()=>practiceSetup(sid,body);
  }
  show();
}

