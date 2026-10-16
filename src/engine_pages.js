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
function cleanup(){if(window.__graphOff)window.__graphOff();if(timerHandle){clearInterval(timerHandle);timerHandle=null}if(keyHandler){document.removeEventListener('keydown',keyHandler);keyHandler=null}}
const stars=l=>'★'.repeat(l)+'☆'.repeat(3-l);
const fmtTime=s=>{s=Math.max(0,Math.round(s));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};

const MOCKS={
  amc10:{name:'AMC 10 Mock Exam',short:'AMC 10 Mock',d:'25 questions from the AMC 10 topics only (no precalculus-only material) in 75 minutes, ordered easy to hard like the real AMC 10.',topics:()=>amcTopics().filter(t=>t.amc!=='12'),lv:[9,10,6]},
  amc12:{name:'AMC 12 Mock Exam',short:'AMC 12 Mock',d:'25 questions from every topic in 75 minutes, with a full share of AMC 12 precalculus (logs, trig, complex numbers, conics) and a harder mix.',topics:()=>amcTopics(),lv:[7,10,8],min12:6},
  all:{name:'Full AMC Mock Exam',short:'Full Mock',d:'25 questions drawn evenly from every AMC 10 and AMC 12 topic in 75 minutes, ordered easy to hard.',topics:()=>amcTopics(),lv:[9,10,6]},
};
const mockKey=t=>t.track==='pc'?'Chapter test':'Mock test';
const trackCrumb=t=>t.track==='pc'?['Precalculus','#/pc']:['AMC Prep','#/amc'];

function route(){routeTo();if(typeof restoreScroll==='function'&&location.hash)restoreScroll()}
function routeTo(){
  cleanup();const h=location.hash.replace(/^#\/?/,'').split('/').filter(Boolean);
  window.scrollTo(0,0);
  const landing=h.length===0;document.body.classList.toggle('landing',landing);if(typeof TM!=='undefined')TM.show(landing);
  if(landing)return;
  if(h[0]==='home')return hub();
  if(h[0]==='amc')return amcHome();
  if(h[0]==='pc')return pcHome();
  if(h[0]==='t'&&findTopic(h[1]))return topicPage(findTopic(h[1]));
  if(h[0]==='s'&&subById(h[1]))return subPage(h[1],h[2]||'lesson');
  if(h[0]==='mock')return mockPage(h[1]&&(MOCKS[h[1]]||findTopic(h[1]))?h[1]:'all');
  hub();
}

function trackStats(id){let total=0,done=0,ok=0;for(const t of TOPICS)if(t.track===id){const st=topicStats(t);total+=st.total;done+=st.done;ok+=st.ok}return{total,done,ok}}
function hub(){
  setCrumbs([['Home']]);
  const card=tr=>{const st=trackStats(tr.id);const ts=TOPICS.filter(t=>t.track===tr.id);const ns=ts.reduce((a,t)=>a+t.subs.length,0);
    return`<button class="card tile big" onclick="location.hash='#/${tr.id}'"><span class="num">${tr.id==='amc'?'Contest prep':'Course'}</span><span class="t">${esc(tr.name)}</span><span class="d">${esc(tr.d)}</span>
    <span class="meta">${ts.length} ${tr.id==='pc'?'chapters':'topics'} · ${ns} ${tr.id==='pc'?'sections':'subtopics'} · ${st.total.toLocaleString()} problems · ${st.done} attempted${st.done?' · '+Math.round(st.ok/st.done*100)+'% correct':''}</span>
    <span class="bar"><i style="width:${st.total?st.done/st.total*100:0}%"></i></span></button>`};
  app.innerHTML=`<h1>What are you studying?</h1><p class="sub">Pick a track. Your progress in both is saved to your code and synced across your devices.</p>
   <div class="grid two">${TRACKS.map(card).join('')}</div>
   <p class="meta" style="margin-top:26px"><a href="#" onclick="if(confirm('Reset all saved problem progress in both tracks?')){PROG={q:{},pr:{},mock:[]};saveProg();route()}return false">Reset all problem progress</a></p>`;
}

/* which contest the AMC Prep page is set up for: '10', '12' or 'both' (kept on this device) */
const AMC_LEVELS={'10':{name:'AMC 10',d:'Only AMC 10 topics. The AMC 12 precalculus topics are hidden.',mocks:['amc10']},
  '12':{name:'AMC 12',d:'Every topic, including AMC 12 precalculus, with the AMC 12 mock exam.',mocks:['amc12']},
  both:{name:'Both',d:'Everything for the AMC 10 and AMC 12, with all three mock exams.',mocks:['amc10','amc12','all']}};
function amcLevel(){let v='both';try{v=localStorage.getItem('amcprep.level')||'both'}catch(e){}return AMC_LEVELS[v]?v:'both'}
const amcShown=t=>amcLevel()!=='10'||t.amc!=='12';
const GEAR='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';
function amcHome(){
  setCrumbs([['Home','#/home'],['AMC Prep']]);
  const lv=amcLevel(),L_=AMC_LEVELS[lv],shown=amcTopics().filter(amcShown);
  let all=0,allDone=0;for(const t of shown){const st=topicStats(t);all+=st.total;allDone+=st.done}
  const tag=t=>lv==='both'?'AMC '+t.amc:L_.name;
  const tile=t=>{const st=topicStats(t);return`<button class="card tile" onclick="location.hash='#/t/${t.id}'">
    <span class="num">${tag(t)}</span><span class="t">${esc(t.name)}</span><span class="d">${esc(t.d)}</span>
    <span class="meta">${t.subs.length} subtopics · ${st.total} problems · ${st.done} attempted</span><span class="bar"><i style="width:${st.total?st.done/st.total*100:0}%"></i></span></button>`};
  const mockTile=k=>{const m=MOCKS[k];const last=PROG.mock.filter(x=>x.topic===k).pop();
    return`<button class="card tile" style="border-color:var(--accent)" onclick="location.hash='#/mock/${k}'"><span class="num">Full mock exam</span><span class="t">${esc(m.name)}</span>
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
    <span class="num">Chapter ${t.ch}</span><span class="t">${esc(t.name)}</span><span class="d">${esc(t.d)}</span>
    <span class="meta">${t.subs.length} sections · ${st.total} problems · ${st.done} attempted</span><span class="bar"><i style="width:${st.total?st.done/st.total*100:0}%"></i></span></button>`};
  app.innerHTML=`<h1>General Precalculus</h1><p class="sub">${esc(PC_CATALOG[0].note)}</p>`+
   PC_CATALOG.map(sec=>`<div class="grid two">${sec.items.map(tile).join('')}</div>`).join('');
}

function topicPage(t){
  setCrumbs([['Home','#/home'],trackCrumb(t),[t.name]]);const pc=t.track==='pc';
  const cards=t.subs.map((s,i)=>{const st=subStats(s.id);return`<button class="card tile" onclick="location.hash='#/s/${s.id}/lesson'">
    <span class="num">${s.id==='mixed'?'Challenge':pc?'Section '+s.sec:'Subtopic '+(i+1)}</span><span class="t">${esc(s.name)}</span><span class="d">${esc(s.d)}</span>
    <span class="meta">${st.total} problems · ${st.done} attempted · ${st.done?Math.round(st.ok/st.done*100)+'% correct':'not started'}</span>
    <span class="bar"><i style="width:${st.total?st.done/st.total*100:0}%"></i></span></button>`}).join('');
  const last=PROG.mock.filter(m=>(m.topic||'seq')===t.id).pop();
  app.innerHTML=`<h1>${pc?'Chapter '+t.ch+': ':''}${esc(t.name)}</h1><p class="sub">${esc(t.d)} Work through the ${pc?'sections':'subtopics'} in order: read the lesson, do the problem set, then drill in practice mode. Finish with the ${mockKey(t).toLowerCase()}.</p>
  <div class="grid">${cards}
  <button class="card tile" style="border-color:var(--accent)" onclick="location.hash='#/mock/${t.id}'"><span class="num">${mockKey(t)}</span><span class="t">${esc(t.name)} ${pc?'Chapter Test':'Mock Test'}</span>
  <span class="d">25 questions in 75 minutes, ordered easy to hard, with AMC-style scoring (6 / 1.5 / 0).</span>
  <span class="meta">${last?'Last score: '+last.score+' / 150':'Not taken yet'}</span></button></div>
  <div class="row" style="margin-top:18px"><button class="btn" onclick="location.hash='${trackCrumb(t)[1]}'">← All ${pc?'chapters':'topics'}</button></div>`;
}

function subPage(sid,tab){
  const s=subById(sid);const t=findTopic(s.topic);setCrumbs([['Home','#/home'],trackCrumb(t),[t.name,'#/t/'+t.id],[s.name]]);
  const st=subStats(sid);
  app.innerHTML=`<h1>${s.sec?'<span class="secno">'+s.sec+'</span> ':''}${esc(s.name)}</h1><p class="sub">${esc(s.d)}</p>
  <div class="tabs">${[['lesson','Lesson'],['set','Problem Set ('+st.total+')'],['practice','Practice Mode'],['graph','Graph']].map(([k,n])=>`<button class="tab ${k===tab?'on':''}" onclick="location.hash='#/s/${sid}/${k}'">${n}</button>`).join('')}</div>
  <div id="tabbody"></div>${tabArrows(sid,tab)}`;
  const body=document.getElementById('tabbody');enterTab(body);
  if(tab==='set')return setView(sid,body);
  if(tab==='practice')return practiceSetup(sid,body);
  if(tab==='graph')return graphView(body);
  const les=document.getElementById('L-'+sid);
  const i=t.subs.indexOf(s),next=t.subs[i+1];
  body.innerHTML=`<div class="lesson">${les?les.textContent:'<p>Lesson coming soon.</p>'}</div>
  <div class="row" style="margin-top:16px">${next?`<button class="btn" onclick="location.hash='#/s/${next.id}/lesson'">Next lesson: ${esc(next.name)} →</button>`:''}<span class="spacer"></span><button class="btn pri" onclick="location.hash='#/s/${sid}/set'">Go to problem set →</button></div>`;
  drawLessonPlots(body);renderMath(body);
}
/* ---------- moving between Lesson / Problem Set / Practice: side arrows + sideways swipe ---------- */
const SUB_TABS=[['lesson','Lesson'],['set','Problem Set'],['practice','Practice Mode'],['graph','Graph']];
let tabSlide=null;                                              // 'next' | 'prev': direction the new tab slides in from
function tabArrows(sid,tab){
  const i=SUB_TABS.findIndex(x=>x[0]===tab),pv=SUB_TABS[i-1],nx=SUB_TABS[i+1];
  const a=(t,dir,ch)=>t?`<button class="tab-arrow ${dir}" type="button" data-go="${dir}" aria-label="${esc(t[1])}"><span class="ta-ch">${ch}</span><span class="ta-lbl">${esc(t[1])}</span></button>`:'';
  return a(pv,'prev','‹')+a(nx,'next','›');
}
function curSubTab(){const m=location.hash.match(/^#\/s\/([^/]+)(?:\/(\w+))?/);if(!m||!subById(m[1]))return null;
  const i=Math.max(0,SUB_TABS.findIndex(x=>x[0]===(m[2]||'lesson')));return{sid:m[1],i}}
function practiceBusy(){return!!document.querySelector('#tabbody #pq')}
function goTab(dir){
  const c=curSubTab();if(!c)return false;const j=c.i+(dir==='next'?1:-1);if(j<0||j>=SUB_TABS.length)return false;
  if(practiceBusy()&&!confirm('Leave this practice session? Your progress in it will be lost.'))return false;
  tabSlide=dir;location.hash='#/s/'+c.sid+'/'+SUB_TABS[j][0];return true;
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
    const tg=e.target;if(tg.closest('input,textarea,select,.katex-display,.plot,.lfig,table,.gc')||scrollsX(tg))return;
    body=document.getElementById('tabbody');x0=e.touches[0].clientX;y0=e.touches[0].clientY;t0=Date.now();
  },{passive:true});
  document.addEventListener('touchmove',e=>{
    if(!body)return;const x=e.touches[0].clientX-x0,y=e.touches[0].clientY-y0;
    if(!lock){if(Math.abs(x)<10&&Math.abs(y)<10)return;lock=Math.abs(x)>Math.abs(y)*1.2?'x':'y'}
    if(lock!=='x')return;
    const c=curSubTab();const edge=(x>0&&c.i===0)||(x<0&&c.i===SUB_TABS.length-1);
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
