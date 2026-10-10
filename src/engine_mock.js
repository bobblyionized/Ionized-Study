/* ---------- mock test ---------- */
function mockPage(scope){
  const t=scope==='all'?null:findTopic(scope);const name=t?t.name:'All Topics';
  setCrumbs(t?[['Home','#/home'],[t.name,'#/t/'+t.id],['Mock Test']]:[['Home','#/home'],['Full Mock Test']]);
  const hist=PROG.mock.filter(m=>(m.topic||'seq')===scope).slice(-5).reverse();
  app.innerHTML=`<h1>${t?esc(name)+' Mock Test':'Full AMC Mock Exam'}</h1><p class="sub">25 multiple-choice questions${t?' on '+esc(name):' drawn from every topic'}, ordered from easier to harder like a real AMC 10/12. You have 75 minutes. Scoring: 6 points for a correct answer, 1.5 for a blank, 0 for a wrong answer.</p>
   <div class="card"><div class="row"><button class="btn pri" id="mstart">Start test</button><span class="meta">Questions are drawn at random, so each attempt is different.</span></div>
   ${hist.length?`<h4 style="margin-top:16px">Recent scores</h4>${hist.map(h=>`<div class="meta">${new Date(h.at).toLocaleString()} — <b>${h.score}</b> / 150 (${h.ok} correct, ${h.blank} blank)</div>`).join('')}`:''}</div>`;
  app.querySelector('#mstart').onclick=()=>startMock(scope);
}
function startMock(scope){
  const t=scope==='all'?null:findTopic(scope);const subs=t?t.subs:SUBS;
  const classics=[],drills=[];for(const s of subs)for(const it of SETS[s.id]||[])(it.src==='c'?classics:drills).push(it);
  const used=new Set();
  const take=(arr,n)=>{const o=[];for(const x of shuffle(Math.random,arr)){if(o.length>=n)break;if(!used.has(x.id)){used.add(x.id);o.push(x)}}return o};
  const pick=(lvl,n)=>{let o=take(classics.filter(x=>x.lvl===lvl),n);if(o.length<n)o=o.concat(take(drills.filter(x=>x.lvl===lvl),n-o.length));return o};
  let items=pick(1,9).concat(pick(2,10),pick(3,6));
  if(items.length<25)items=items.concat(take(classics,25-items.length));
  if(items.length<25)items=items.concat(take(drills,25-items.length));
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
  const tick=()=>{const left=total-(Date.now()-t0)/1000;tEl.textContent='⏱ '+fmtTime(left);tEl.classList.toggle('low',left<300);if(left<=0){finish(true)}};tick();timerHandle=setInterval(tick,1000);
  const ask=()=>{const blanks=ans.filter(x=>x===null).length;if(confirm(blanks?`Submit with ${blanks} blank answer(s)?`:'Submit your test?'))finish(false)};
  app.querySelector('#msubmit').onclick=ask;app.querySelector('#msubmit2').onclick=ask;
  function finish(timeUp){
    cleanup();let ok=0,blank=0;items.forEach((it,i)=>{if(ans[i]===null)blank++;else if(ans[i]===it.ans)ok++});const wrong=N-ok-blank;const score=ok*6+blank*1.5;
    PROG.mock.push({at:Date.now(),score,ok,blank,topic:scope});saveProg();
    const secs=Math.min(total,(Date.now()-t0)/1000);
    const groups=t?t.subs.map(s=>[s.name,it=>it.sub===s.id]):TOPICS.map(x=>[x.name,it=>subById(it.sub).topic===x.id]);
    app.innerHTML=`<h1>Mock Test Results</h1>${timeUp?'<p class="sub">Time ran out, so the test was submitted automatically.</p>':''}
     <div class="stat"><div><b>${score}</b><span>score / 150</span></div><div><b>${ok}</b><span>correct</span></div><div><b>${wrong}</b><span>wrong</span></div><div><b>${blank}</b><span>blank</span></div><div><b>${fmtTime(secs)}</b><span>time used</span></div></div>
     <div class="card" style="margin-bottom:16px"><b>By ${t?'subtopic':'topic'}:</b> ${groups.map(([nm,f])=>{const its=items.map((it,i)=>[it,i]).filter(([it])=>f(it));if(!its.length)return'';const c=its.filter(([it,i])=>ans[i]===it.ans).length;return`<span class="pill ${c===its.length?'ok':c?'':'no'}" style="margin:3px">${esc(nm)} ${c}/${its.length}</span>`}).join('')}
     <div class="row" style="margin-top:12px"><button class="btn pri" id="again">Take another test</button><button class="btn" onclick="location.hash='${t?'#/t/'+t.id:'#/home'}'">Back</button></div></div>
     <div id="mrev">${items.map((it,i)=>cardHTML(it,i+1,{extra:`<span class="meta">${esc(subById(it.sub).name)}</span>`})).join('')}</div>`;
    app.querySelector('#again').onclick=()=>startMock(scope);
    const rev=app.querySelector('#mrev');items.forEach((it,i)=>revealCard(rev.children[i],it,ans[i],false));renderMath(app);window.scrollTo(0,0);
  }
}

/* ====================== boot ====================== */
if(typeof document!=='undefined'&&document.getElementById('bank')){
  app=document.getElementById('app');crumbs=document.getElementById('crumbs');
  loadData(document.getElementById('bank').textContent);loadProg();
  window.addEventListener('hashchange',route);route();
}
