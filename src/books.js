/* ====================== Textbook viewer (precalculus chapters) ======================
   The student's own chapter PDFs are stored on their device only (IndexedDB) and rendered with PDF.js.
   Nothing is uploaded. Each section's lesson links to its pages; the chapter page manages the files.
   Page numbers: pdf page p is book page p + offset.                                                    */
const BOOKS=(()=>{
  const DATA={
    pc3:{ch:3,offset:140,pages:95,docs:[['book','Textbook']],
      secs:{'pc3-func':[2,10],'pc3-not':[11,20],'pc3-graph':[21,34],'pc3-param':[35,38],'pc3-trans':[39,48],'pc3-sym':[49,54],'pc3-ops':[55,63],'pc3-rate':[64,76],'pc3-inv':[77,87]},
      extra:{review:[88,93],test:[94,95]}},
    pc4:{ch:4,offset:238,pages:102,docs:[['book','Textbook']],
      secs:{'pc4-quad':[2,11],'pc4-poly':[12,20],'pc4-synth':[21,23],'pc4-roots':[24,31],'pc4-graph':[32,44],'pc4-model':[45,49],'pc4-rat':[50,65],'pc4-ratx':[66,69],
        'pc4-ineq':[70,78],'pc4-abs':[79,82],'pc4-cplx':[83,89],'pc4-theory':[90,95],'pc4-review':[96,100]},
      extra:{review:[96,100],test:[101,102]}},
    pc5:{ch:5,offset:340,pages:86,docs:[['book','Textbook'],['ans1','Answers, part 1'],['ans2','Answers, part 2']],
      secs:{'pc5-rad':[2,9],'pc5-radeq':[10,16],'pc5-exp':[17,28],'pc5-int':[29,34],'pc5-log':[35,44],'pc5-laws':[45,51],'pc5-base':[52,58],'pc5-eq':[59,68],'pc5-model':[69,78]},
      extra:{review:[79,83],test:[84,86]}}};
  const has=new Set();                                   // "pc5:book" keys stored on this device
  /* ---------- IndexedDB ---------- */
  let dbp=null;
  const db=()=>dbp||(dbp=new Promise((ok,no)=>{if(typeof indexedDB==='undefined')return no(new Error('no storage'));
    const q=indexedDB.open('ionized-books',1);q.onupgradeneeded=()=>q.result.createObjectStore('files');q.onsuccess=()=>ok(q.result);q.onerror=()=>no(q.error)}));
  const tx=(mode,fn)=>db().then(d=>new Promise((ok,no)=>{const t=d.transaction('files',mode),s=t.objectStore('files');const r=fn(s);t.oncomplete=()=>ok(r&&r.result);t.onerror=()=>no(t.error)}));
  const get=k=>tx('readonly',s=>s.get(k)),put=(k,v)=>tx('readwrite',s=>s.put(v,k)),del=k=>tx('readwrite',s=>s.delete(k));
  const ready=db().then(d=>new Promise(ok=>{const q=d.transaction('files').objectStore('files').getAllKeys();q.onsuccess=()=>{(q.result||[]).forEach(k=>has.add(k));ok()};q.onerror=()=>ok()})).catch(()=>{});

  /* ---------- helpers ---------- */
  const bookPage=(tid,p)=>p+DATA[tid].offset;
  const subTopic=sid=>Object.keys(DATA).find(t=>DATA[t].secs[sid]);
  const ICON='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5zM4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/></svg>';
  function lessonBar(sid){
    const tid=subTopic(sid);if(!tid)return'';const D=DATA[tid],[a,b]=D.secs[sid],ok=has.has(tid+':book');
    const range=`pp. ${bookPage(tid,a)}–${bookPage(tid,b)}`;const ans=D.docs.filter(d=>d[0]!=='book'&&has.has(tid+':'+d[0]));
    return`<div class="bkbar">${ICON}<span><b>Textbook</b> · Chapter ${D.ch}, ${range}</span><span class="sp"></span>
      ${ok?`<button class="btn sm" data-bk-open="${tid}:book:${a}">Open ${range}</button>`:`<button class="btn sm" data-bk-add="${tid}:book" data-bk-then="${a}">Add your Chapter ${D.ch} PDF</button>`}
      ${ans.map(d=>`<button class="btn sm" data-bk-open="${tid}:${d[0]}:1">${d[1]}</button>`).join('')}</div>`;
  }
  function chapterCard(tid){
    const D=DATA[tid];if(!D)return'';
    const row=([id,label])=>{const k=tid+':'+id,ok=has.has(k);
      return`<div class="bkrow"><span class="bkname">${label}${id==='book'?` <span class="meta">book pp. ${bookPage(tid,1)}–${bookPage(tid,D.pages)}</span>`:''}</span><span class="sp"></span>
      ${ok?`<button class="btn sm pri" data-bk-open="${k}:1">Open</button><button class="btn sm" data-bk-add="${k}">Replace</button><button class="btn sm" data-bk-del="${k}">Remove</button>`
         :`<button class="btn sm" data-bk-add="${k}">Add PDF</button>`}</div>`};
    const ex=D.extra;const jump=has.has(tid+':book')?`<div class="bkjump">Jump to: ${[['Chapter Review',ex.review],['Chapter Test',ex.test]].map(([n,r])=>`<button class="chip" data-bk-open="${tid}:book:${r[0]}">${n} (p. ${bookPage(tid,r[0])})</button>`).join(' ')}</div>`:'';
    return`<div class="card bkcard"><div class="bkhead">${ICON}<div><b>Your Chapter ${D.ch} textbook</b><div class="meta">Read the chapter here. Each section's lesson links straight to its pages. Files stay on this device and are never uploaded; add them once on each device you use.</div></div></div>
      ${D.docs.map(row).join('')}${jump}</div>`;
  }

  /* ---------- adding / removing files ---------- */
  let picker=null;
  function pick(key,thenPage){
    if(!picker){picker=document.createElement('input');picker.type='file';picker.accept='application/pdf,.pdf';picker.hidden=true;document.body.appendChild(picker)}
    picker.value='';picker.onchange=async()=>{const f=picker.files&&picker.files[0];if(!f)return;
      if(!/pdf$/i.test(f.type)&&!/\.pdf$/i.test(f.name)){alert('Please choose a PDF file.');return}
      try{await put(key,{blob:f,name:f.name,size:f.size,at:Date.now()});has.add(key)}catch(e){alert('Could not save the file on this device: '+(e.message||e));return}
      refresh();if(thenPage)open(key,+thenPage)};
    picker.click();
  }
  async function remove(key){if(!confirm('Remove this PDF from this device?'))return;await del(key).catch(()=>{});has.delete(key);refresh()}
  function refresh(){if(typeof route==='function'){const y=window.scrollY;window.__quietRoute=true;try{route()}finally{window.__quietRoute=false}window.scrollTo(0,y)}}

  /* ---------- the reader ---------- */
  let lib=null;
  function loadLib(){if(lib)return lib;
    lib=new Promise((ok,no)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      s.onload=()=>{try{window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';ok(window.pdfjsLib)}catch(e){no(e)}};
      s.onerror=()=>{lib=null;no(new Error('Could not load the PDF reader. Check your internet connection.'))};document.head.appendChild(s)});
    return lib}
  let V=null;                                            // current viewer state
  function shell(){
    let el=document.getElementById('bkv');if(el)return el;
    el=document.createElement('div');el.id='bkv';el.className='bkv';el.setAttribute('role','dialog');el.setAttribute('aria-label','Textbook');
    el.innerHTML=`<div class="bkv-top"><div class="bkv-tabs" id="bkvTabs"></div><span class="sp"></span>
      <div class="bkv-nav"><button class="bkv-b" id="bkvPrev" aria-label="Previous page">‹</button><label class="bkv-pg"><span id="bkvPre">p.</span><input id="bkvIn" inputmode="numeric" aria-label="Go to page"><span id="bkvOf"></span></label><button class="bkv-b" id="bkvNext" aria-label="Next page">›</button></div>
      <div class="bkv-nav"><button class="bkv-b" id="bkvOut" aria-label="Zoom out">−</button><button class="bkv-b" id="bkvFit" aria-label="Fit width">Fit</button><button class="bkv-b" id="bkvZin" aria-label="Zoom in">+</button></div>
      <button class="bkv-b bkv-x" id="bkvClose" aria-label="Close">×</button></div>
      <div class="bkv-body" id="bkvBody"><div class="bkv-msg" id="bkvMsg">Opening…</div><div class="bkv-pages" id="bkvPages"></div></div>`;
    document.body.appendChild(el);
    const $=id=>el.querySelector('#'+id);
    $('bkvClose').onclick=close;
    $('bkvPrev').onclick=()=>V&&go(V.cur-1);$('bkvNext').onclick=()=>V&&go(V.cur+1);
    $('bkvOut').onclick=()=>V&&zoom(V.z/1.25);$('bkvZin').onclick=()=>V&&zoom(V.z*1.25);$('bkvFit').onclick=()=>V&&zoom(1);
    $('bkvIn').addEventListener('keydown',e=>{if(e.key!=='Enter'||!V)return;const n=parseInt($('bkvIn').value,10);if(!isFinite(n))return;go(V.isBook?n-DATA[V.tid].offset:n)});
    $('bkvBody').addEventListener('scroll',()=>{if(V){track();sweep()}},{passive:true});
    document.addEventListener('keydown',e=>{if(!V||!el.classList.contains('open'))return;if(e.key==='Escape')close();
      else if(e.target.tagName!=='INPUT'&&(e.key==='ArrowRight'||e.key==='PageDown'))go(V.cur+1);else if(e.target.tagName!=='INPUT'&&(e.key==='ArrowLeft'||e.key==='PageUp'))go(V.cur-1)});
    window.addEventListener('resize',()=>{if(V&&el.classList.contains('open'))layout(true)});
    return el;
  }
  async function open(key,page){
    const [tid,doc]=key.split(':');const el=shell(),$=id=>el.querySelector('#'+id);
    el.classList.add('open');document.body.classList.add('bkv-on');
    $('bkvTabs').innerHTML=DATA[tid].docs.filter(d=>has.has(tid+':'+d[0])).map(d=>`<button class="bkv-tab${d[0]===doc?' on':''}" data-bk-open="${tid}:${d[0]}:1">${d[1]}</button>`).join('');
    if(V&&V.key===key){go(page||1);return}
    if(V)teardown();
    $('bkvMsg').hidden=false;$('bkvMsg').textContent='Opening…';$('bkvPages').innerHTML='';
    try{
      const rec=await get(key);if(!rec)throw new Error('That PDF is not stored on this device yet.');
      const pdfjs=await loadLib();const data=new Uint8Array(await rec.blob.arrayBuffer());
      const pdf=await pdfjs.getDocument({data}).promise;const p1=await pdf.getPage(1);const vp=p1.getViewport({scale:1});
      V={key,tid,doc,isBook:doc==='book',pdf,n:pdf.numPages,ar:vp.height/vp.width,z:1,cur:1,rendered:new Map(),obs:null};
      $('bkvMsg').hidden=true;
      if(V.isBook&&V.n!==DATA[tid].pages){$('bkvMsg').hidden=false;$('bkvMsg').textContent=`This file has ${V.n} pages; the Chapter ${DATA[tid].ch} PDF has ${DATA[tid].pages}, so section links may point to the wrong pages.`}
      build();go(page||1,true);
    }catch(e){$('bkvMsg').hidden=false;$('bkvMsg').textContent=e.message||'Could not open this PDF.'}
  }
  function build(){
    const box=document.getElementById('bkvPages');box.innerHTML='';
    for(let i=1;i<=V.n;i++){const d=document.createElement('div');d.className='bkv-page';d.dataset.p=i;d.innerHTML=`<span class="bkv-num">${V.isBook?'p. '+bookPage(V.tid,i):'page '+i}</span>`;box.appendChild(d)}
    layout(false);
    document.getElementById('bkvOf').textContent=V.isBook?` (${V.n} pages)`:` of ${V.n}`;document.getElementById('bkvPre').textContent=V.isBook?'p.':'';
  }
  function layout(keep){
    const body=document.getElementById('bkvBody');const p=keep?V.cur:null;
    const w=Math.min(body.clientWidth-24,980)*V.z;V.w=w;
    document.querySelectorAll('#bkvPages .bkv-page').forEach(d=>{d.style.width=w+'px';d.style.height=(w*V.ar)+'px'});
    V.rendered.forEach((c,pg)=>{if(c.w!==w){const d=document.querySelector(`#bkvPages .bkv-page[data-p="${pg}"]`);unpaint(pg,d)}});
    if(keep&&p)go(p,true);else sweep();
  }
  async function paint(p,d){
    if(!V||V.rendered.has(p))return;const tok={w:V.w};V.rendered.set(p,tok);
    try{const page=await V.pdf.getPage(p);if(V.rendered.get(p)!==tok)return;
      const dpr=Math.min(2,window.devicePixelRatio||1),base=page.getViewport({scale:1}),sc=tok.w/base.width,vp=page.getViewport({scale:sc*dpr});
      const c=document.createElement('canvas');c.width=Math.floor(vp.width);c.height=Math.floor(vp.height);c.style.width=tok.w+'px';c.style.height=(tok.w*base.height/base.width)+'px';
      await page.render({canvasContext:c.getContext('2d'),viewport:vp}).promise;
      if(V.rendered.get(p)!==tok)return;d.querySelectorAll('canvas').forEach(x=>x.remove());d.appendChild(c);
    }catch(e){if(V)V.rendered.delete(p)}
  }
  /* draw the pages near the visible area and free canvases far away (keeps memory low on phones) */
  function sweep(){if(!V)return;const body=document.getElementById('bkvBody');const top=body.scrollTop,h=body.clientHeight;
    document.querySelectorAll('#bkvPages .bkv-page').forEach(d=>{const p=+d.dataset.p,y0=d.offsetTop,y1=y0+d.offsetHeight;
      if(y1>top-h&&y0<top+2*h)paint(p,d);else if(y1<top-3*h||y0>top+4*h)unpaint(p,d)})}
  function unpaint(p,d){if(!V||!V.rendered.has(p))return;V.rendered.delete(p);if(d)d.querySelectorAll('canvas').forEach(c=>{c.width=c.height=0;c.remove()})}
  function go(p,instant){if(!V)return;p=Math.max(1,Math.min(V.n,p|0));const d=document.querySelector(`#bkvPages .bkv-page[data-p="${p}"]`);const body=document.getElementById('bkvBody');
    if(d)body.scrollTo({top:d.offsetTop-10,behavior:instant?'auto':'smooth'});V.cur=p;label();sweep();setTimeout(sweep,450)}
  function track(){const body=document.getElementById('bkvBody');const mid=body.scrollTop+body.clientHeight*0.35;let cur=1;
    document.querySelectorAll('#bkvPages .bkv-page').forEach(d=>{if(d.offsetTop<=mid)cur=+d.dataset.p});if(cur!==V.cur){V.cur=cur;label()}}
  function label(){const inp=document.getElementById('bkvIn');if(document.activeElement!==inp)inp.value=V.isBook?bookPage(V.tid,V.cur):V.cur}
  function zoom(z){V.z=Math.max(0.5,Math.min(3,z));layout(true)}
  function teardown(){if(!V)return;V.rendered.forEach((_,p)=>unpaint(p,document.querySelector(`#bkvPages .bkv-page[data-p="${p}"]`)));try{V.pdf.destroy()}catch(e){}V=null}
  function close(){const el=document.getElementById('bkv');if(el)el.classList.remove('open');document.body.classList.remove('bkv-on')}

  if(typeof document!=='undefined')document.addEventListener('click',e=>{
    const o=e.target.closest('[data-bk-open]'),a=e.target.closest('[data-bk-add]'),d=e.target.closest('[data-bk-del]');
    if(o){e.preventDefault();const [t,doc,p]=o.dataset.bkOpen.split(':');open(t+':'+doc,+p||1)}
    else if(a){e.preventDefault();pick(a.dataset.bkAdd,a.dataset.bkThen)}
    else if(d){e.preventDefault();remove(d.dataset.bkDel)}
  });
  ready.then(()=>{if(has.size&&/^#\/(t|s)\/pc/.test(location.hash||''))refresh()});   // stored files load after the first render
  return{lessonBar,chapterCard,ready,DATA,has};
})();
