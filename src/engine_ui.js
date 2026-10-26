/* ---------- problem card ---------- */
/* hand-written problems are 'AMC-style' in the AMC track and 'Worked problem' in precalculus */
const cLabel=sub=>{const s=subById(sub);return s&&findTopic(s.topic).track==='pc'?'Worked problem':'AMC-style'};
const GIVEUP='<span class="fb-acts first"><button class="giveup-btn" type="button">Give up</button></span>';
const ITEMS=new Map();   // id -> problem, so Ask AI can find the problem behind a card
function cardHTML(it,num,opts={}){
  ITEMS.set(it.id,it);
  const tag=it.src==='c'?`<span class="pill">${cLabel(it.sub)}</span>`:'<span class="pill g">Skill drill</span>';
  return`<div class="prob" data-id="${it.id}">
   <div class="phead"><b>#${num}</b>${tag}<span class="lv" title="Difficulty">${stars(it.lvl)}</span>${opts.extra||''}<span class="spacer"></span><span class="status"></span></div>
   <div class="ptext">${it.q}</div>
   <div class="choices${it.choices.some(c=>/\\begin|<table|<svg/.test(c)||c.length>70)?' wide':''}">${it.choices.map((c,i)=>`<button class="ch" data-i="${i}"><b>(${L[i]})</b><span>${c}</span></button>`).join('')}</div>
   <div class="fb">${opts.giveUp?GIVEUP:''}</div>
   <div class="sol" hidden><div class="sol-acts"><button class="hist-btn" type="button" hidden title="Show the wrong answers you picked before">History</button><button class="ai-btn" type="button" title="Open Google AI Mode in a new tab to explain this problem">Ask AI</button></div><details><summary>Show full solution</summary><div class="solbody">${it.sol}</div></details><div class="hist-box" hidden></div></div>
  </div>`;
}
/* hist = earlier wrong picks (problem sets only); a correct answer after misses gets a History button */
function revealCard(el,it,chosen,openSol,hist){
  el.querySelectorAll('.ch').forEach(b=>{const i=+b.dataset.i;b.disabled=true;b.classList.remove('sel','wrong','right');
    if(i===it.ans)b.classList.add('right');else if(i===chosen)b.classList.add('wrong')});
  const fb=el.querySelector('.fb');const st=el.querySelector('.status');const tries=hist?hist.length:0;
  if(chosen===null||chosen===undefined){fb.className='fb no';fb.textContent='Skipped. The answer is ('+L[it.ans]+').';st.innerHTML='<span class="pill g">Blank</span>'}
  else if(chosen===it.ans){fb.className='fb ok';fb.textContent=tries?'Correct on try '+(tries+1)+'!':'Correct!';
    st.innerHTML=tries?'<span class="pill g">Solved on try '+(tries+1)+'</span>':'<span class="pill ok">Correct</span>'}
  else{fb.className='fb no';fb.textContent='Not quite. The answer is ('+L[it.ans]+').';st.innerHTML='<span class="pill no">Missed</span>'}
  const sol=el.querySelector('.sol');sol.hidden=false;sol.querySelector('details').open=!!openSol;
  const hb=el.querySelector('.hist-btn'),box=el.querySelector('.hist-box');
  const showHist=chosen===it.ans&&tries>0;hb.hidden=!showHist;box.hidden=true;hb.classList.remove('on');sol.classList.toggle('has-hist',showHist);
  if(showHist)box.innerHTML='<div class="hist-h">Your earlier attempts</div><ol>'+hist.map(i=>i<0?'<li><i>Gave up</i></li>':'<li><b>('+L[i]+')</b> '+it.choices[i]+'</li>').join('')+'</ol>';
}
/* a wrong pick in a problem set: keep the answer hidden and offer another try */
const flash=el=>{el.classList.remove('just');void el.offsetWidth;el.classList.add('just');clearTimeout(el._jt);el._jt=setTimeout(()=>el.classList.remove('just'),800)};   // marks a card that was just answered
function wrongCard(el,it,p){
  el.querySelectorAll('.ch').forEach(b=>{const i=+b.dataset.i;b.disabled=true;b.classList.remove('sel','right','wrong');if(i===p.c)b.classList.add('wrong')});
  const fb=el.querySelector('.fb');fb.className='fb no';
  fb.innerHTML=(p.c<0?'You gave up.':'Not quite.')+' <span class="fb-acts"><button class="retry-btn" type="button">Try again</button><button class="show-btn" type="button">Show answer</button></span>';
  el.querySelector('.status').innerHTML='<span class="pill no">Missed'+(p.w.length>1?' ×'+p.w.length:'')+'</span>';
  el.querySelector('.sol').hidden=true;
}
function retryCard(el){
  el.querySelectorAll('.ch').forEach(b=>{b.disabled=false;b.classList.remove('sel','right','wrong')});
  const fb=el.querySelector('.fb');fb.className='fb';fb.innerHTML=GIVEUP;el.querySelector('.sol').hidden=true;
}

/* ---------- problem set ---------- */
function setView(sid,body){
  const set=SETS[sid];let filter='all';
  const statHTML=()=>{const st=subStats(sid);return`<div><b>${st.done}/${st.total}</b><span>attempted</span></div><div><b>${st.ok}</b><span>correct</span></div><div><b>${st.done?Math.round(st.ok/st.done*100):0}%</b><span>accuracy</span></div>`};
  body.innerHTML=`<div class="stat" id="sstat">${statHTML()}</div>
  <div class="filters" id="flt">${[['all','All'],['c',cLabel(sid)],['g','Skill drills'],['1','★ Easy'],['2','★★ Medium'],['3','★★★ Hard'],['new','Unattempted'],['miss','Missed']].map(([k,n])=>`<button class="chip ${k==='all'?'on':''}" data-f="${k}">${n}</button>`).join('')}
  <span class="spacer"></span><button class="chip" id="resetset">Reset this set</button></div><div id="plist"></div>`;
  const list=body.querySelector('#plist');
  function draw(){
    const items=set.map((it,i)=>[it,i+1]).filter(([it])=>{const p=PROG.q[it.id];
      if(filter==='all')return true;if(filter==='c'||filter==='g')return it.src===filter;if(filter==='new')return!p;if(filter==='miss')return p&&!p.ok;return String(it.lvl)===filter});
    list.innerHTML=items.length?items.map(([it,n])=>cardHTML(it,n,{giveUp:true})).join(''):'<div class="empty">No problems match this filter.</div>';
    for(const [it] of items){if(PROG.q[it.id])paint(list.querySelector(`[data-id="${it.id}"]`),it,false)}
    renderMath(list);
  }
  /* PROG.q[id] = {c: latest pick, ok: right on the first try, w: wrong picks in order, show: answer revealed after a miss} */
  function paint(card,it,fresh){const p=PROG.q[it.id];const w=p.w||(p.ok?[]:[p.c]);
    if(p.c===it.ans)revealCard(card,it,p.c,false,w);
    else if(p.show){revealCard(card,it,p.c<0?-1:p.c,fresh,w);const fb=card.querySelector('.fb');
      if(p.c<0){fb.textContent='You gave up. The answer is ('+L[it.ans]+').';card.querySelector('.status').innerHTML='<span class="pill no">Gave up</span>'}
      fb.insertAdjacentHTML('beforeend',' <span class="fb-acts"><button class="retry-btn" type="button">Try again</button></span>')}
    else wrongCard(card,it,{...p,w});
  }
  list.addEventListener('click',e=>{
    const card=e.target.closest('.prob');if(!card)return;const it=set.find(x=>x.id===card.dataset.id);if(!it)return;
    const hb=e.target.closest('.hist-btn');
    if(hb){const box=card.querySelector('.hist-box');box.hidden=!box.hidden;hb.classList.toggle('on',!box.hidden);if(!box.hidden)renderMath(box);return}
    if(e.target.closest('.giveup-btn')){const prev=PROG.q[it.id];const w=prev?(prev.w||(prev.ok?[]:[prev.c])).slice():[];w.push(-1);   // counts as a miss
      PROG.q[it.id]={c:-1,ok:false,w,show:true};saveProg();paint(card,it,true);flash(card);renderMath(card);body.querySelector('#sstat').innerHTML=statHTML();return}
    if(e.target.closest('.retry-btn')){const p=PROG.q[it.id];if(p&&p.show){delete p.show;saveProg()}retryCard(card);return}
    if(e.target.closest('.show-btn')){const p=PROG.q[it.id];p.show=true;saveProg();paint(card,it,true);flash(card);renderMath(card);return}
    const b=e.target.closest('.ch');if(!b||b.disabled)return;
    const c=+b.dataset.i,prev=PROG.q[it.id];const w=prev?(prev.w||(prev.ok?[]:[prev.c])).slice():[];
    if(c!==it.ans)w.push(c);
    PROG.q[it.id]={c,ok:c===it.ans&&!w.length,w};saveProg();paint(card,it,true);flash(card);renderMath(card);
    body.querySelector('#sstat').innerHTML=statHTML()});
  body.querySelector('#flt').addEventListener('click',e=>{const b=e.target.closest('.chip');if(!b)return;
    if(b.id==='resetset'){if(confirm('Clear your answers for this problem set?')){for(const it of set)delete PROG.q[it.id];saveProg();setView(sid,body)}return}
    filter=b.dataset.f;body.querySelectorAll('#flt .chip[data-f]').forEach(x=>x.classList.toggle('on',x===b));draw()});
  draw();
}
