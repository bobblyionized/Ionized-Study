/* ====================== progress storage ====================== */
let PROG={q:{},pr:{},mock:[]};
function loadProg(){try{const v=JSON.parse(localStorage.getItem(KEY));if(v&&typeof v==='object')PROG=Object.assign({q:{},pr:{},mock:[]},v)}catch(e){}}
function saveProg(){try{localStorage.setItem(KEY,JSON.stringify(PROG))}catch(e){}if(typeof SYNC!=='undefined'&&SYNC)SYNC.changed()}
function subStats(sub){const set=SETS[sub]||[];let done=0,ok=0;for(const it of set){const p=PROG.q[it.id];if(p){done++;if(p.ok)ok++}}return{total:set.length,done,ok}}
function topicStats(t){let done=0,ok=0,total=0;for(const s of t.subs){const st=subStats(s.id);done+=st.done;ok+=st.ok;total+=st.total}return{done,ok,total}}

/* ====================== UI ====================== */
let app,crumbs,timerHandle=null,keyHandler=null,mockLive=false;   // mockLive: a mock test is in progress
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const L='ABCDE';
function renderMath(el){if(window.renderMathInElement){try{renderMathInElement(el,{delimiters:[{left:'$$',right:'$$',display:true},{left:'$',right:'$',display:false}],throwOnError:false})}catch(e){}}}
function setCrumbs(parts){crumbs.innerHTML=parts.map(p=>p[1]?`<a href="${p[1]}">${esc(p[0])}</a>`:esc(p[0])).join(' &nbsp;›&nbsp; ');crumbs.scrollLeft=crumbs.scrollWidth}
function cleanup(){if(window.__graphOff)window.__graphOff();if(timerHandle){clearInterval(timerHandle);timerHandle=null}if(keyHandler){document.removeEventListener('keydown',keyHandler);keyHandler=null}}
const stars=l=>'★'.repeat(l)+'☆'.repeat(3-l);
const fmtTime=s=>{s=Math.max(0,Math.round(s));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};

const WH_TEST={n:30,mins:40};                                    // a World History unit test: questions and minutes
const MOCKS={
  amc10:{name:'AMC 10 Mock Exam',short:'AMC 10 Mock',d:'25 questions from the AMC 10 topics only (no precalculus-only material) in 75 minutes, ordered easy to hard like the real AMC 10.',topics:()=>amcTopics().filter(t=>t.amc!=='12'),lv:[9,10,6]},
  amc12:{name:'AMC 12 Mock Exam',short:'AMC 12 Mock',d:'25 questions from every topic in 75 minutes, with a full share of AMC 12 precalculus (logs, trig, complex numbers, conics) and a harder mix.',topics:()=>amcTopics(),lv:[7,10,8],min12:6},
  all:{name:'Full AMC Mock Exam',short:'Full Mock',d:'25 questions drawn evenly from every AMC 10 and AMC 12 topic in 75 minutes, ordered easy to hard.',topics:()=>amcTopics(),lv:[9,10,6]},
};
const mockKey=t=>t.track==='pc'?'Chapter test':t.track==='wh'?'Unit test':'Mock test';
const trackCrumb=t=>t.track==='pc'?['Precalculus','#/pc']:t.track==='wh'?['World History','#/wh']:['AMC Prep','#/amc'];
const UNITS={pc:['chapter','section','problems'],wh:['unit','lesson','questions'],amc:['topic','subtopic','problems']};   // what each track calls its parts
const plural=(n,w)=>n+' '+w+(n===1?'':'s');

function route(){
  const m=location.hash.match(/^#\/s\/([^/]+)/),sub=m?m[1]:null,same=sub&&sub===route.sub;route.sub=sub;
  routeTo();if(typeof restoreScroll==='function'&&location.hash)restoreScroll();
  if(window.__quietRoute||typeof document==='undefined'||document.body.classList.contains('landing'))return;
  const tb=document.getElementById('tabbody');                         // soft cross-fade on every page or tab change
  const el=same&&tb?tb:app,cls=same&&tb?'tab-fade':'route-in';
  if(same&&tb&&/tab-in-/.test(tb.className))return;                     // arrow/swipe already animates
  el.classList.remove(cls);void el.offsetWidth;el.classList.add(cls);
  el.addEventListener('animationend',()=>el.classList.remove(cls),{once:true});
}
function fadeLanding(toLanding){
  const land=document.getElementById('land'),main=document.querySelector('main'),hdr=document.querySelector('header.top');if(!land)return;
  if(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  land.classList.remove('fade-in','fade-out');[main,hdr].forEach(el=>el&&el.classList.remove('study-in'));void land.offsetWidth;
  if(toLanding){land.classList.add('fade-in');land.addEventListener('animationend',()=>land.classList.remove('fade-in'),{once:true})}
  else{land.classList.add('fade-out');const done=()=>land.classList.remove('fade-out');land.addEventListener('animationend',done,{once:true});setTimeout(done,700);
    [main,hdr].forEach(el=>{if(!el)return;el.classList.add('study-in');el.addEventListener('animationend',()=>el.classList.remove('study-in'),{once:true})})}
}
function routeTo(){
  cleanup();const h=location.hash.replace(/^#\/?/,'').split('/').filter(Boolean);
  window.scrollTo(0,0);
  const landing=h.length===0,was=document.body.classList.contains('landing');
  if(was!==landing&&routeTo.ran)fadeLanding(landing);                 // cross-fade between the timer screen and studying
  routeTo.ran=true;document.body.classList.toggle('landing',landing);if(typeof TM!=='undefined'){TM.show(landing);if(!landing&&TM.closeSheet)TM.closeSheet(true)}
  document.body.classList.toggle('nb-only',h[0]==='notebooks');
  if(landing)return;
  if(h[0]==='notebooks')return notebooksPage();
  if(h[0]==='home')return hub();
  if(h[0]==='amc')return amcHome();
  if(h[0]==='pc')return pcHome();
  if(h[0]==='wh')return whHome();
  if(h[0]==='t'&&findTopic(h[1]))return topicPage(findTopic(h[1]));
  if(h[0]==='s'&&subById(h[1]))return subPage(h[1],h[2]||'lesson');
  if(h[0]==='mock')return mockPage(h[1]&&(MOCKS[h[1]]||findTopic(h[1]))?h[1]:'all');
  hub();
}

/* the Notebooks page opened from the timer screen: just the notebook library and a way back */
function notebooksPage(){setCrumbs([['Notebooks']]);
  app.innerHTML=`<a class="nb-back" href="#/" title="Back to the timer menu">Timer</a><div id="nbStand"></div>`;NOTEBOOK.view(document.getElementById('nbStand'))}

function trackStats(id){let total=0,done=0,ok=0;for(const t of TOPICS)if(t.track===id){const st=topicStats(t);total+=st.total;done+=st.done;ok+=st.ok}return{total,done,ok}}
function hub(){
  setCrumbs([['Home']]);
  const card=tr=>{const st=trackStats(tr.id);const ts=TOPICS.filter(t=>t.track===tr.id);const U=UNITS[tr.id]||UNITS.amc;
    const ns=ts.reduce((a,t)=>a+t.subs.filter(s=>tr.id!=='wh'||s.sec).length,0);     // a history unit's planner is not a lesson
    return`<button class="card tile big" onclick="location.hash='#/${tr.id}'"><span class="t">${esc(tr.name)}</span><span class="d">${esc(tr.d)}</span>
    <span class="meta">${plural(ts.length,U[0])} · ${plural(ns,U[1])} · ${st.total.toLocaleString()} ${U[2]} · ${st.done} attempted${st.done?' · '+Math.round(st.ok/st.done*100)+'% correct':''}</span>
    <span class="bar"><i style="width:${st.total?st.done/st.total*100:0}%"></i></span></button>`};
  app.innerHTML=`<h1>What are you studying?</h1><p class="sub">Pick a track. Your progress in every track is saved to your code and synced across your devices.</p>
   <div class="grid two">${TRACKS.map(card).join('')}</div>
   <p class="meta" style="margin-top:26px"><a href="#" onclick="if(confirm('Reset all saved problem progress in every track?')){PROG={q:{},pr:{},mock:[]};saveProg();route()}return false">Reset all problem progress</a></p>`;
}

/* which contest the AMC Prep page is set up for: '10', '12' or 'both' (kept on this device) */
const AMC_LEVELS={'10':{name:'AMC 10',d:'Only AMC 10 topics. The AMC 12 precalculus topics are hidden.',mocks:['amc10']},
  '12':{name:'AMC 12',d:'Every topic, including AMC 12 precalculus, with the AMC 12 mock exam.',mocks:['amc12']},
  both:{name:'Both',d:'Everything for the AMC 10 and AMC 12, with all three mock exams.',mocks:['amc10','amc12','all']}};
function amcLevel(){let v='both';try{v=localStorage.getItem('amcprep.level')||'both'}catch(e){}return AMC_LEVELS[v]?v:'both'}
const amcShown=t=>{const lv=amcLevel();return lv==='10'?t.amc!=='12':lv==='12'?t.amc!=='10':true};
const GEAR='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';
function amcHome(){
  setCrumbs([['Home','#/home'],['AMC Prep']]);
  const lv=amcLevel(),L_=AMC_LEVELS[lv],shown=amcTopics().filter(amcShown);
  let all=0,allDone=0;for(const t of shown){const st=topicStats(t);all+=st.total;allDone+=st.done}
  const tag=t=>lv==='both'?'AMC '+t.amc:L_.name;
  const tile=t=>{const st=topicStats(t);return`<button class="card tile" onclick="location.hash='#/t/${t.id}'">
    <span class="t">${esc(t.name)}</span><span class="d">${esc(t.d)}</span>
    <span class="meta">${tag(t)} · ${t.subs.length} subtopics · ${st.total} problems · ${st.done} attempted</span><span class="bar"><i style="width:${st.total?st.done/st.total*100:0}%"></i></span></button>`};
  const mockTile=k=>{const m=MOCKS[k];const last=PROG.mock.filter(x=>x.topic===k).pop();
    return`<button class="card tile mock" onclick="location.hash='#/mock/${k}'"><span class="t">${esc(m.name)}</span>
    <span class="d">${esc(m.d)} Real AMC scoring (6 / 1.5 / 0).</span><span class="meta">${last?'Last score: '+last.score+' / 150':'Not taken yet'}</span></button>`};
  const sub=lv==='10'?`${shown.length} topics and ${all.toLocaleString()} problems for the AMC 10 (${allDone} attempted so far). AMC 12-only topics are hidden; change this with the gear.`
    :lv==='12'?`${shown.length} topics and ${all.toLocaleString()} problems for the AMC 12, including its precalculus topics (${allDone} attempted so far).`
    :`${shown.length} topics and ${all.toLocaleString()} problems covering everything on the AMC 10 and AMC 12 (${allDone} attempted so far). Topics marked <b>AMC 12</b> are mainly precalculus material for the AMC 12.`;
  app.innerHTML=`<div class="h1row"><h1>${lv==='both'?'AMC 10/12 Prep':L_.name+' Prep'}</h1>
     <button class="gear" id="amcGear" type="button" aria-expanded="false" aria-label="AMC settings" title="Settings">${GEAR}<span>${L_.name}</span></button></div>
   <div class="setpanel" id="amcSet" hidden><div class="h">Which contest are you preparing for?</div>
     <div class="seg">${Object.entries(AMC_LEVELS).map(([k,v])=>`<button class="${k===lv?'on':''}" data-lv="${k}" type="button"><b>${v.name}</b><span>${v.d}</span></button>`).join('')}</div></div>
   <p class="sub">${sub}</p>
   <h2>Mock exam${L_.mocks.length>1?'s':''}</h2><div class="grid">${L_.mocks.map(mockTile).join('')}</div>`+
   CATALOG.map(sec=>{const its=sec.items.filter(amcShown);return its.length?`<h2>${esc(sec.area)}</h2><p class="meta" style="margin:0 0 12px">${esc(sec.note)}</p><div class="grid">${its.map(tile).join('')}</div>`:''}).join('');
  const g=document.getElementById('amcGear'),pn=document.getElementById('amcSet');
  g.addEventListener('click',()=>{pn.hidden=!pn.hidden;g.setAttribute('aria-expanded',String(!pn.hidden));g.classList.toggle('on',!pn.hidden)});
  pn.addEventListener('click',e=>{const b=e.target.closest('[data-lv]');if(!b)return;try{localStorage.setItem('amcprep.level',b.dataset.lv)}catch(err){}if(typeof SYNC!=='undefined')SYNC.changed();
    amcHome();const g2=document.getElementById('amcGear'),p2=document.getElementById('amcSet');p2.hidden=false;g2.classList.add('on');g2.setAttribute('aria-expanded','true')});
}

function pcHome(){
  setCrumbs([['Home','#/home'],['Precalculus']]);
  const tile=t=>{const st=topicStats(t);return`<button class="card tile" onclick="location.hash='#/t/${t.id}'">
    <span class="t"><span class="secno">${t.ch}</span> ${esc(t.name)}</span><span class="d">${esc(t.d)}</span>
    <span class="meta">${t.subs.length} sections · ${st.total} problems · ${st.done} attempted</span><span class="bar"><i style="width:${st.total?st.done/st.total*100:0}%"></i></span></button>`};
  app.innerHTML=`<h1>General Precalculus</h1><p class="sub">${esc(PC_CATALOG[0].note)}</p>`+
   PC_CATALOG.map(sec=>`<div class="grid two">${sec.items.map(tile).join('')}</div>`).join('');
}
function whHome(){
  setCrumbs([['Home','#/home'],['World History']]);
  const tile=t=>{const st=topicStats(t);return`<button class="card tile" onclick="location.hash='#/t/${t.id}'">
    <span class="t"><span class="secno">${t.unit}</span> ${esc(t.name)}</span><span class="d">${esc(t.d)}</span>
    <span class="meta">${plural(t.subs.filter(s=>s.sec).length,'lesson')} · ${st.total} questions · ${st.done} attempted</span><span class="bar"><i style="width:${st.total?st.done/st.total*100:0}%"></i></span></button>`};
  app.innerHTML=`<h1>World History</h1><p class="sub">${esc(WH_CATALOG[0].note)}</p>`+
   WH_CATALOG.map(sec=>`<div class="grid two">${sec.items.map(tile).join('')}</div>`).join('');
}

function topicPage(t){
  setCrumbs([['Home','#/home'],trackCrumb(t),[t.name]]);const pc=t.track==='pc',wh=t.track==='wh',U=UNITS[t.track]||UNITS.amc;
  const cards=t.subs.map((s,i)=>{const st=subStats(s.id);return`<button class="card tile" onclick="location.hash='#/s/${s.id}/lesson'">
    <span class="t">${(n=>n?`<span class="secno">${n}</span> `:'')(s.id==='mixed'?'':pc||wh?s.sec||'':i+1)}${esc(s.name)}</span><span class="d">${esc(s.d)}</span>
    <span class="meta">${st.total} ${U[2]} · ${st.done} attempted · ${st.done?Math.round(st.ok/st.done*100)+'% correct':'not started'}</span>
    <span class="bar"><i style="width:${st.total?st.done/st.total*100:0}%"></i></span></button>`}).join('');
  const last=PROG.mock.filter(m=>(m.topic||'seq')===t.id).pop();
  const how=wh?'Work through the lessons in order: read the lesson, go over the review notes, then answer the practice questions.'
    :`Work through the ${pc?'sections':'subtopics'} in order: read the lesson, do the problem set, then work it out in your notebook.`;
  app.innerHTML=`<h1>${pc?'Chapter '+t.ch+': ':wh?'Unit '+t.unit+': ':''}${esc(t.name)}</h1><p class="sub">${esc(t.d)} ${how} Finish with the ${mockKey(t).toLowerCase()}.</p>
  ${pc&&typeof BOOKS!=='undefined'?BOOKS.chapterCard(t.id):''}
  <div class="grid">${cards}
  <button class="card tile mock" onclick="location.hash='#/mock/${t.id}'"><span class="t">${esc(t.name)} ${pc?'Chapter Test':wh?'Unit Test':'Mock Test'}</span>
  <span class="d">${wh?`${WH_TEST.n} multiple-choice questions from every lesson in ${WH_TEST.mins} minutes, in the order the unit goes. Scored as a percent, like a class test.`:'25 questions in 75 minutes, ordered easy to hard, with AMC-style scoring (6 / 1.5 / 0).'}</span>
  <span class="meta">${last?'Last score: '+(last.pct?last.score+'%':last.score+' / 150'):'Not taken yet'}</span></button></div>
  <div class="row" style="margin-top:18px"><button class="btn fb-back" onclick="location.hash='${trackCrumb(t)[1]}'">All ${U[0]}s</button></div>`;
}

function subPage(sid,tab){
  const s=subById(sid);const t=findTopic(s.topic);setCrumbs([['Home','#/home'],trackCrumb(t),[t.name,'#/t/'+t.id],[s.name]]);
  const st=subStats(sid),tabs=subTabs(sid),text=isTextSub(sid);if(!tabs.some(x=>x[0]===tab))tab='lesson';
  app.innerHTML=`<h1>${s.sec?'<span class="secno">'+s.sec+'</span> ':''}${esc(s.name)}</h1><p class="sub">${esc(s.d)}</p>
  <div class="tabs">${tabs.map(([k,n])=>`<button class="tab ${k===tab?'on':''}" onclick="location.hash='#/s/${sid}/${k}'">${n}${k==='set'?' ('+st.total+')':''}</button>`).join('')}</div>
  <div id="tabbody"></div>${tabArrows(sid,tab)}`;
  const body=document.getElementById('tabbody');enterTab(body);
  if(tab==='set')return setView(sid,body);
  if(tab==='notebook')return NOTEBOOK.view(body,sid);
  if(tab==='graph')return graphView(body);
  const i=t.subs.indexOf(s),next=t.subs[i+1],setBtn=`<button class="btn pri" onclick="location.hash='#/s/${sid}/set'">${text?'Practice questions':'Go to problem set'}</button>`;
  if(tab==='review'){const rv=document.getElementById('R-'+sid);         // Cornell-style notes: cues on the left, notes on the right, a summary below
    body.innerHTML=`${rv?'<div class="cn-tools"><button class="chip" type="button" data-cn-cover>Cover the notes</button><span class="meta">Quiz yourself: answer each cue from memory, then tap its row to check.</span></div>':''}
    <div class="lesson${rv?' cn-wrap':''}">${rv?rv.textContent:'<p>Review notes coming soon.</p>'}</div>
    <div class="row" style="margin-top:16px"><button class="btn fb-back" onclick="location.hash='#/s/${sid}/lesson'">Back to the lesson</button><span class="spacer"></span>${setBtn}</div>`;
    body.addEventListener('click',e=>{const cn=body.querySelector('.cornell');if(!cn)return;const b=e.target.closest('[data-cn-cover]');
      if(b){const on=cn.classList.toggle('cn-covered');cn.querySelectorAll('.cn-row.open').forEach(r=>r.classList.remove('open'));b.textContent=on?'Show all notes':'Cover the notes';b.classList.toggle('on',on);return}
      const r=e.target.closest('.cn-row');if(r&&cn.classList.contains('cn-covered'))r.classList.toggle('open')});
    return renderMath(body)}
  const les=document.getElementById('L-'+sid);
  body.innerHTML=`${typeof BOOKS!=='undefined'?BOOKS.lessonBar(sid):''}<div class="lesson">${les?les.textContent:'<p>Lesson coming soon.</p>'}</div>
  <div class="row" style="margin-top:16px">${next?`<button class="btn" onclick="location.hash='#/s/${next.id}/lesson'">Next lesson: ${esc(next.name)}</button>`:''}<span class="spacer"></span>${text?`<button class="btn pri" onclick="location.hash='#/s/${sid}/review'">Review notes</button>`:setBtn}</div>`;
  drawLessonPlots(body);renderMath(body);
}
/* ---------- moving between Lesson / (Review) / Problem Set / Notebook / Graph: side arrows + sideways swipe ---------- */
const SUB_TABS=[['lesson','Lesson'],['set','Problem Set'],['notebook','Notebook'],['graph','Graph']];
const TEXT_TABS=[['lesson','Lesson'],['review','Review'],['set','Questions'],['notebook','Notebook']];   // reading subjects: no graph, a review tab
const subTabs=sid=>isTextSub(sid)?TEXT_TABS:SUB_TABS;
let tabSlide=null;                                              // 'next' | 'prev': direction the new tab slides in from
function tabArrows(sid,tab){
  const T=subTabs(sid),i=T.findIndex(x=>x[0]===tab),pv=T[i-1],nx=T[i+1];
  const a=(t,dir,ch)=>t?`<button class="tab-arrow ${dir}" type="button" data-go="${dir}" aria-label="${esc(t[1])}"><span class="ta-ch">${ch}</span><span class="ta-lbl">${esc(t[1])}</span></button>`:'';
  return a(pv,'prev',icon('chevL'))+a(nx,'next',icon('chevR'));
}
function curSubTab(){const m=location.hash.match(/^#\/s\/([^/]+)(?:\/(\w+))?/);if(!m||!subById(m[1]))return null;
  const T=subTabs(m[1]),i=Math.max(0,T.findIndex(x=>x[0]===(m[2]||'lesson')));return{sid:m[1],i,n:T.length}}
function goTab(dir){
  const c=curSubTab();if(!c)return false;const j=c.i+(dir==='next'?1:-1),T=subTabs(c.sid);if(j<0||j>=T.length)return false;
  tabSlide=dir;location.hash='#/s/'+c.sid+'/'+T[j][0];return true;
}
function enterTab(body){
  if(!tabSlide)return;const dir=tabSlide;tabSlide=null;
  body.classList.add('tab-in-'+dir);body.addEventListener('animationend',()=>body.classList.remove('tab-in-'+dir),{once:true});
}
if(typeof document!=='undefined')(()=>{                          // arrow clicks + touch: drag the page sideways
  document.addEventListener('click',e=>{const b=e.target.closest('.tab-arrow');if(b)goTab(b.dataset.go)});
  let x0,y0,t0,body,lock=null,dx=0;
  const scrollsX=el=>{for(;el&&el!==document.body;el=el.parentElement){const cs=getComputedStyle(el);
    if(/(auto|scroll)/.test(cs.overflowX)&&el.scrollWidth>el.clientWidth+2)return true}return false};
  document.addEventListener('touchstart',e=>{
    body=null;lock=null;dx=0;if(e.touches.length!==1||!curSubTab())return;
    const tg=e.target;if(tg.closest('input,textarea,select,.katex-display,.plot,.lfig,table,.gc,.nb')||scrollsX(tg))return;
    body=document.getElementById('tabbody');x0=e.touches[0].clientX;y0=e.touches[0].clientY;t0=Date.now();
  },{passive:true});
  document.addEventListener('touchmove',e=>{
    if(!body)return;const x=e.touches[0].clientX-x0,y=e.touches[0].clientY-y0;
    if(!lock){if(Math.abs(x)<10&&Math.abs(y)<10)return;lock=Math.abs(x)>Math.abs(y)*1.2?'x':'y'}
    if(lock!=='x')return;
    const c=curSubTab();const edge=(x>0&&c.i===0)||(x<0&&c.i===c.n-1);
    dx=edge?x/4:x;body.style.transition='none';body.style.transform=`translateX(${dx}px)`;body.style.opacity=String(1-Math.min(.5,Math.abs(dx)/innerWidth));
  },{passive:true});
  document.addEventListener('touchend',()=>{
    if(!body||lock!=='x'){body=null;return}const b=body;body=null;
    const fast=Math.abs(dx)>40&&Date.now()-t0<300,far=Math.abs(dx)>innerWidth*.28;
    const reset=()=>{b.style.transition='transform .25s ease,opacity .25s ease';b.style.transform='';b.style.opacity=''};
    if(fast||far){const dir=dx<0?'next':'prev';
      b.style.transition='transform .18s ease-in,opacity .18s ease-in';b.style.transform=`translateX(${dx<0?-innerWidth:innerWidth}px)`;b.style.opacity='0';
      setTimeout(()=>{if(!goTab(dir))reset()},170);
    }else reset();
  });
  document.addEventListener('touchcancel',()=>{if(body){body.style.transform='';body.style.opacity='';body=null}});
})();

/* <div class="lplot" data-f="expr|a|b|ends; expr2..." data-x="-5,5" data-y="-5,5" data-pts="x,y,o; ..." data-cap="..."> */
function drawLessonPlots(root){
  root.querySelectorAll('.lplot').forEach(el=>{
    try{
      const num=s=>s.split(',').map(Number);
      const curves=(el.dataset.f||'').split(';').filter(s=>s.trim()).map(c=>{const [e,a,b,ends]=c.split('|');
        const fn=new Function('x','with(Math){return('+e+')}');
        return{f:fn,a:a!==undefined&&a!==''?+a:undefined,b:b!==undefined&&b!==''?+b:undefined,ends:(ends||'').split('').map(ch=>ch==='-'?'':ch)}});
      const pts=(el.dataset.pts||'').split(';').filter(s=>s.trim()).map(p=>{const q=p.split(',');return{x:+q[0],y:+q[1],open:(q[2]||'').trim()==='o'}});
      const paths=(el.dataset.paths||'').split('/').filter(s=>s.trim()).map(p=>p.split(';').map(num));
      for(const pr of (el.dataset.par||'').split(';').filter(s=>s.trim())){     // parametric: "x(t)|y(t)|t0|t1"
        const [ex,ey,t0,t1]=pr.split('|');const fx=new Function('t','with(Math){return('+ex+')}'),fy=new Function('t','with(Math){return('+ey+')}');
        paths.push(Array.from({length:201},(_,i)=>{const t=+t0+(t1-t0)*i/200;return[fx(t),fy(t)]}));
      }
      const svg=plot({x:el.dataset.x?num(el.dataset.x):undefined,y:el.dataset.y?num(el.dataset.y):undefined,w:+el.dataset.w||240,curves,pts,paths,label:el.dataset.cap||'graph'});
      el.outerHTML=`<figure class="lfig">${svg}${el.dataset.cap?`<figcaption>${el.dataset.cap}</figcaption>`:''}</figure>`;
    }catch(e){el.textContent=''}
  });
}
