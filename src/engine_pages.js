/* ====================== progress storage ====================== */
let PROG={q:{},pr:{},mock:[]};
function loadProg(){try{const v=JSON.parse(localStorage.getItem(KEY));if(v&&typeof v==='object')PROG=Object.assign({q:{},pr:{},mock:[]},v)}catch(e){}}
function saveProg(){try{localStorage.setItem(KEY,JSON.stringify(PROG))}catch(e){}if(typeof SYNC!=='undefined'&&SYNC)SYNC.changed()}
function subStats(sub){const set=SETS[sub]||[];let done=0,ok=0;for(const it of set){const p=PROG.q[it.id];if(p){done++;if(p.ok)ok++}}return{total:set.length,done,ok}}
function topicStats(t){let done=0,ok=0,total=0;for(const s of t.subs){const st=subStats(s.id);done+=st.done;ok+=st.ok;total+=st.total}return{done,ok,total}}

/* ====================== UI ====================== */
let app,crumbs,timerHandle=null,keyHandler=null;
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const L='ABCDE';
function renderMath(el){if(window.renderMathInElement){try{renderMathInElement(el,{delimiters:[{left:'$$',right:'$$',display:true},{left:'$',right:'$',display:false}],throwOnError:false})}catch(e){}}}
function setCrumbs(parts){crumbs.innerHTML=parts.map(p=>p[1]?`<a href="${p[1]}">${esc(p[0])}</a>`:esc(p[0])).join(' &nbsp;›&nbsp; ')}
function cleanup(){if(timerHandle){clearInterval(timerHandle);timerHandle=null}if(keyHandler){document.removeEventListener('keydown',keyHandler);keyHandler=null}}
const stars=l=>'★'.repeat(l)+'☆'.repeat(3-l);
const fmtTime=s=>{s=Math.max(0,Math.round(s));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};

function route(){
  cleanup();const h=location.hash.replace(/^#\/?/,'').split('/').filter(Boolean);
  window.scrollTo(0,0);
  const landing=h.length===0;document.body.classList.toggle('landing',landing);if(typeof TM!=='undefined')TM.show(landing);
  if(landing)return;
  if(h[0]==='home')return home();
  if(h[0]==='t'&&findTopic(h[1]))return topicPage(findTopic(h[1]));
  if(h[0]==='s'&&subById(h[1]))return subPage(h[1],h[2]||'lesson');
  if(h[0]==='mock')return mockPage(h[1]&&(h[1]==='all'||findTopic(h[1]))?h[1]:'seq');
  home();
}

function home(){
  setCrumbs([['Home']]);
  let all=0,allDone=0;for(const t of TOPICS){const st=topicStats(t);all+=st.total;allDone+=st.done}
  const tile=t=>{const st=topicStats(t);return`<button class="card tile" onclick="location.hash='#/t/${t.id}'">
    <span class="num">AMC ${t.amc}</span><span class="t">${esc(t.name)}</span><span class="d">${esc(t.d)}</span>
    <span class="meta">${t.subs.length} subtopics · ${st.total} problems · ${st.done} attempted</span><span class="bar"><i style="width:${st.total?st.done/st.total*100:0}%"></i></span></button>`};
  const last=PROG.mock.filter(m=>m.topic==='all').pop();
  app.innerHTML=`<h1>AMC 10/12 Prep</h1><p class="sub">${TOPICS.length} topics and ${all.toLocaleString()} problems covering everything on the AMC 10 and AMC 12. Topics marked <b>AMC 12</b> are mainly precalculus material for the AMC 12.</p>
   <div class="grid"><button class="card tile" style="border-color:var(--accent)" onclick="location.hash='#/mock/all'"><span class="num">Full mock test · all topics</span><span class="t">AMC-Style Mock Exam</span>
   <span class="d">25 questions drawn from every topic in 75 minutes, ordered easy to hard, with real AMC scoring (6 / 1.5 / 0).</span><span class="meta">${last?'Last score: '+last.score+' / 150':'Not taken yet'} · ${allDone} problems attempted overall</span></button></div>`+
   CATALOG.map(sec=>`<h2>${esc(sec.area)}</h2><p class="meta" style="margin:0 0 12px">${esc(sec.note)}</p><div class="grid">${sec.items.map(tile).join('')}</div>`).join('')+
   `<p class="meta" style="margin-top:26px">Problem progress is saved in this browser. <a href="#" onclick="if(confirm('Reset all saved problem progress?')){PROG={q:{},pr:{},mock:[]};saveProg();route()}return false">Reset problem progress</a></p>`;
}

function topicPage(t){
  setCrumbs([['Home','#/home'],[t.name]]);
  const cards=t.subs.map((s,i)=>{const st=subStats(s.id);return`<button class="card tile" onclick="location.hash='#/s/${s.id}/lesson'">
    <span class="num">${s.id==='mixed'?'Challenge':'Subtopic '+(i+1)}</span><span class="t">${esc(s.name)}</span><span class="d">${esc(s.d)}</span>
    <span class="meta">${st.total} problems · ${st.done} attempted · ${st.done?Math.round(st.ok/st.done*100)+'% correct':'not started'}</span>
    <span class="bar"><i style="width:${st.total?st.done/st.total*100:0}%"></i></span></button>`}).join('');
  const last=PROG.mock.filter(m=>(m.topic||'seq')===t.id).pop();
  app.innerHTML=`<h1>${esc(t.name)}</h1><p class="sub">${esc(t.d)} Work through the subtopics in order: read the lesson, do the problem set, then drill in practice mode. Finish with the mock test.</p>
  <div class="grid">${cards}
  <button class="card tile" style="border-color:var(--accent)" onclick="location.hash='#/mock/${t.id}'"><span class="num">Mock test</span><span class="t">${esc(t.name)} Mock Test</span>
  <span class="d">25 questions in 75 minutes, ordered easy to hard, with real AMC scoring (6 / 1.5 / 0).</span>
  <span class="meta">${last?'Last score: '+last.score+' / 150':'Not taken yet'}</span></button></div>
  <div class="row" style="margin-top:18px"><button class="btn" onclick="location.hash='#/home'">← All topics</button></div>`;
}

function subPage(sid,tab){
  const s=subById(sid);const t=findTopic(s.topic);setCrumbs([['Home','#/home'],[t.name,'#/t/'+t.id],[s.name]]);
  const st=subStats(sid);
  app.innerHTML=`<h1>${esc(s.name)}</h1><p class="sub">${esc(s.d)}</p>
  <div class="tabs">${[['lesson','Lesson'],['set','Problem Set ('+st.total+')'],['practice','Practice Mode']].map(([k,n])=>`<button class="tab ${k===tab?'on':''}" onclick="location.hash='#/s/${sid}/${k}'">${n}</button>`).join('')}</div>
  <div id="tabbody"></div>`;
  const body=document.getElementById('tabbody');
  if(tab==='set')return setView(sid,body);
  if(tab==='practice')return practiceSetup(sid,body);
  const les=document.getElementById('L-'+sid);
  const i=t.subs.indexOf(s),next=t.subs[i+1];
  body.innerHTML=`<div class="lesson">${les?les.textContent:'<p>Lesson coming soon.</p>'}</div>
  <div class="row" style="margin-top:16px">${next?`<button class="btn" onclick="location.hash='#/s/${next.id}/lesson'">Next lesson: ${esc(next.name)} →</button>`:''}<span class="spacer"></span><button class="btn pri" onclick="location.hash='#/s/${sid}/set'">Go to problem set →</button></div>`;
  renderMath(body);
}
