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

const MOCKS={
  amc10:{name:'AMC 10 Mock Exam',short:'AMC 10 Mock',d:'25 questions from the AMC 10 topics only (no precalculus-only material) in 75 minutes, ordered easy to hard like the real AMC 10.',topics:()=>amcTopics().filter(t=>t.amc!=='12'),lv:[9,10,6]},
  amc12:{name:'AMC 12 Mock Exam',short:'AMC 12 Mock',d:'25 questions from every topic in 75 minutes, with a full share of AMC 12 precalculus (logs, trig, complex numbers, conics) and a harder mix.',topics:()=>amcTopics(),lv:[7,10,8],min12:6},
  all:{name:'Full AMC Mock Exam',short:'Full Mock',d:'25 questions drawn evenly from every AMC 10 and AMC 12 topic in 75 minutes, ordered easy to hard.',topics:()=>amcTopics(),lv:[9,10,6]},
};
const mockKey=t=>t.track==='pc'?'Chapter test':'Mock test';
const trackCrumb=t=>t.track==='pc'?['Precalculus','#/pc']:['AMC Prep','#/amc'];

function route(){
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

function amcHome(){
  setCrumbs([['Home','#/home'],['AMC Prep']]);
  let all=0,allDone=0;for(const t of amcTopics()){const st=topicStats(t);all+=st.total;allDone+=st.done}
  const tile=t=>{const st=topicStats(t);return`<button class="card tile" onclick="location.hash='#/t/${t.id}'">
    <span class="num">AMC ${t.amc}</span><span class="t">${esc(t.name)}</span><span class="d">${esc(t.d)}</span>
    <span class="meta">${t.subs.length} subtopics · ${st.total} problems · ${st.done} attempted</span><span class="bar"><i style="width:${st.total?st.done/st.total*100:0}%"></i></span></button>`};
  const mockTile=k=>{const m=MOCKS[k];const last=PROG.mock.filter(x=>x.topic===k).pop();
    return`<button class="card tile" style="border-color:var(--accent)" onclick="location.hash='#/mock/${k}'"><span class="num">Full mock exam</span><span class="t">${esc(m.name)}</span>
    <span class="d">${esc(m.d)} Real AMC scoring (6 / 1.5 / 0).</span><span class="meta">${last?'Last score: '+last.score+' / 150':'Not taken yet'}</span></button>`};
  app.innerHTML=`<h1>AMC 10/12 Prep</h1><p class="sub">${amcTopics().length} topics and ${all.toLocaleString()} problems covering everything on the AMC 10 and AMC 12 (${allDone} attempted so far). Topics marked <b>AMC 12</b> are mainly precalculus material for the AMC 12.</p>
   <h2>Mock exams</h2><div class="grid">${['amc10','amc12','all'].map(mockTile).join('')}</div>`+
   CATALOG.map(sec=>`<h2>${esc(sec.area)}</h2><p class="meta" style="margin:0 0 12px">${esc(sec.note)}</p><div class="grid">${sec.items.map(tile).join('')}</div>`).join('');
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
  <div class="tabs">${[['lesson','Lesson'],['set','Problem Set ('+st.total+')'],['practice','Practice Mode']].map(([k,n])=>`<button class="tab ${k===tab?'on':''}" onclick="location.hash='#/s/${sid}/${k}'">${n}</button>`).join('')}</div>
  <div id="tabbody"></div>`;
  const body=document.getElementById('tabbody');
  if(tab==='set')return setView(sid,body);
  if(tab==='practice')return practiceSetup(sid,body);
  const les=document.getElementById('L-'+sid);
  const i=t.subs.indexOf(s),next=t.subs[i+1];
  body.innerHTML=`<div class="lesson">${les?les.textContent:'<p>Lesson coming soon.</p>'}</div>
  <div class="row" style="margin-top:16px">${next?`<button class="btn" onclick="location.hash='#/s/${next.id}/lesson'">Next lesson: ${esc(next.name)} →</button>`:''}<span class="spacer"></span><button class="btn pri" onclick="location.hash='#/s/${sid}/set'">Go to problem set →</button></div>`;
  drawLessonPlots(body);renderMath(body);
}
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
