/* ---------- mock test ---------- */
function mockPage(scope){
  const M=MOCKS[scope],t=M?null:findTopic(scope);const pc=t&&t.track==='pc';
  const title=M?M.name:esc(t.name)+(pc?' Chapter Test':' Mock Test');
  setCrumbs(t?[['Home','#/home'],trackCrumb(t),[t.name,'#/t/'+t.id],[pc?'Chapter Test':'Mock Test']]:[['Home','#/home'],['AMC Prep','#/amc'],[M.short]]);
  const hist=PROG.mock.filter(m=>(m.topic||'seq')===scope).slice(-5).reverse();
  app.innerHTML=`<h1>${title}</h1><p class="sub">${M?esc(M.d):'25 multiple-choice questions on '+esc(t.name)+', ordered from easier to harder. You have 75 minutes.'} Scoring: 6 points for a correct answer, 1.5 for a blank, 0 for a wrong answer.</p>
   <div class="card"><div class="row"><button class="btn pri" id="mstart">Start test</button><span class="meta">Questions are drawn at random, so each attempt is different.</span></div>
   ${hist.length?`<h4 style="margin-top:16px">Recent scores</h4>${hist.map(h=>`<div class="meta">${new Date(h.at).toLocaleString()} — <b>${h.score}</b> / 150 (${h.ok} correct, ${h.blank} blank)</div>`).join('')}`:''}</div>`;
  app.querySelector('#mstart').onclick=()=>startMock(scope);
}
function startMock(scope){
  const M=MOCKS[scope],t=M?null:findTopic(scope);
  const used=new Set();
  const free=arr=>arr.filter(x=>!used.has(x.id));
  const one=arr=>{const f=free(arr);if(!f.length)return null;const x=f[Math.floor(Math.random()*f.length)];used.add(x.id);return x};
  /* prefer hand-written problems, fall back to drills */
  const draw=pool=>one(pool.filter(x=>x.src==='c'))||one(pool);
  let items=[];
  if(t){
    const all=[];for(const s of t.subs)for(const it of SETS[s.id]||[])all.push(it);
    [[1,9],[2,10],[3,6]].forEach(([lv,n])=>{for(let i=0;i<n;i++){const x=draw(all.filter(y=>y.lvl===lv));if(x)items.push(x)}});
    while(items.length<25){const x=draw(all);if(!x)break;items.push(x)}
  }else{
    /* full exams: spread questions evenly across topics, so no single topic dominates */
    const topics=M.topics();const pools={};for(const tp of topics){pools[tp.id]=[];for(const s of tp.subs)for(const it of SETS[s.id]||[])pools[tp.id].push(it)}
    const count={};const lv12=topics.filter(tp=>tp.amc==='12').map(tp=>tp.id);
    const slot=(lv,only)=>{
      const cands=(only||topics.map(tp=>tp.id)).filter(id=>free(pools[id]).some(x=>x.lvl===lv));if(!cands.length)return null;
      const low=Math.min(...cands.map(id=>count[id]||0));const pickT=shuffle(Math.random,cands.filter(id=>(count[id]||0)===low))[0];
      const x=draw(pools[pickT].filter(y=>y.lvl===lv));if(x)count[pickT]=(count[pickT]||0)+1;return x;
    };
    const [a,b,c]=M.lv;const want=[].concat(Array(a).fill(1),Array(b).fill(2),Array(c).fill(3));
    if(M.min12){for(let i=0;i<M.min12;i++){const lv=i<2?2:3;const k=want.indexOf(lv);want.splice(k,1);const x=slot(lv,lv12);if(x)items.push(x)}}
    for(const lv of want){const x=slot(lv);if(x)items.push(x)}
  }
  items.sort((a,b)=>a.lvl-b.lvl);
  const N=items.length;const ans=new Array(N).fill(null);const total=75*60;const t0=Date.now();
  app.innerHTML=`<div class="row" style="position:sticky;top:58px;z-index:5;background:var(--bg);padding:8px 0"><h1 style="margin:0">Mock Test</h1><span class="spacer"></span><span class="meta" id="mans">0/${N} answered</span><span class="timer" id="mtimer"></span><button class="btn pri" id="msubmit">Submit test</button></div>
   <p class="meta">Click a choice to select it; click it again to clear it (a blank is worth 1.5 points). Nothing is graded until you submit.</p><div id="mlist">${items.map((it,i)=>cardHTML(it,i+1)).join('')}</div>
   <div class="row"><span class="spacer"></span><button class="btn pri" id="msubmit2">Submit test</button></div>`;
  renderMath(app);
  const list=app.querySelector('#mlist');
  list.addEventListener('click',ev=>{const b=ev.target.closest('.ch');if(!b||b.disabled)return;const card=b.closest('.prob');const qi=[...list.children].indexOf(card);const i=+b.dataset.i;
    ans[qi]=ans[qi]===i?null:i;card.querySelectorAll('.ch').forEach(x=>x.classList.toggle('sel',+x.dataset.i===ans[qi]));
    app.querySelector('#mans').textContent=ans.filter(x=>x!==null).length+'/'+N+' answered'});
  const tEl=app.querySelector('#mtimer');
  mockLive=true;
  const tick=()=>{const left=total-(Date.now()-t0)/1000;tEl.textContent=fmtTime(left);tEl.classList.toggle('low',left<300);if(left<=0){finish(true)}};tick();timerHandle=setInterval(tick,1000);
  const ask=()=>{const blanks=ans.filter(x=>x===null).length;if(confirm(blanks?`Submit with ${blanks} blank answer(s)?`:'Submit your test?'))finish(false)};
  app.querySelector('#msubmit').onclick=ask;app.querySelector('#msubmit2').onclick=ask;
  function finish(timeUp){
    mockLive=false;cleanup();let ok=0,blank=0;items.forEach((it,i)=>{if(ans[i]===null)blank++;else if(ans[i]===it.ans)ok++});const wrong=N-ok-blank;const score=ok*6+blank*1.5;
    PROG.mock.push({at:Date.now(),score,ok,blank,topic:scope});saveProg();
    const secs=Math.min(total,(Date.now()-t0)/1000);
    const groups=t?t.subs.map(s=>[s.name,it=>it.sub===s.id]):M.topics().map(x=>[x.name,it=>subById(it.sub).topic===x.id]);
    app.innerHTML=`<h1>Mock Test Results</h1>${timeUp?'<p class="sub">Time ran out, so the test was submitted automatically.</p>':''}
     <div class="stat"><div><b>${score}</b><span>score / 150</span></div><div><b>${ok}</b><span>correct</span></div><div><b>${wrong}</b><span>wrong</span></div><div><b>${blank}</b><span>blank</span></div><div><b>${fmtTime(secs)}</b><span>time used</span></div></div>
     <div class="card" style="margin-bottom:16px"><b>By ${t?'subtopic':'topic'}:</b> ${groups.map(([nm,f])=>{const its=items.map((it,i)=>[it,i]).filter(([it])=>f(it));if(!its.length)return'';const c=its.filter(([it,i])=>ans[i]===it.ans).length;return`<span class="pill ${c===its.length?'ok':c?'':'no'}" style="margin:3px">${esc(nm)} ${c}/${its.length}</span>`}).join('')}
     <div class="row" style="margin-top:12px"><button class="btn pri" id="again">Take another test</button><button class="btn" onclick="location.hash='${t?'#/t/'+t.id:'#/amc'}'">Back</button></div></div>
     <div id="mrev">${items.map((it,i)=>cardHTML(it,i+1,{extra:`<span class="meta">${esc(subById(it.sub).name)}</span>`})).join('')}</div>`;
    app.querySelector('#again').onclick=()=>startMock(scope);
    const rev=app.querySelector('#mrev');items.forEach((it,i)=>revealCard(rev.children[i],it,ans[i],false));renderMath(app);window.scrollTo(0,0);
  }
}

/* ====================== boot ====================== */
if(typeof document!=='undefined'&&document.getElementById('bank')){
  app=document.getElementById('app');crumbs=document.getElementById('crumbs');
  loadData(document.getElementById('bank').textContent);loadProg();
  let lastHash=location.hash;
  window.addEventListener('hashchange',()=>{
    if(mockLive&&!confirm('Leave this mock test? Your answers so far will be lost.')){history.replaceState(null,'',lastHash||'#/home');return}
    mockLive=false;lastHash=location.hash;route()});
  window.addEventListener('beforeunload',e=>{if(mockLive){e.preventDefault();e.returnValue=''}});
  route();
}
