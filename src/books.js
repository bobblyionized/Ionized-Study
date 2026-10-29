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
      secs:{'pc5-rad':[2,9],'pc5-radeq':[10,16],'pc5-exp':[17,28],'pc5-int':[29,34],'pc5-log':[35,44],'pc5-laws':[45,51],'pc5-base':[52,58],'pc5-eq':[59,68],'pc5-model':[69,78],'pc5-hw':[35,68]},
      extra:{review:[79,83],test:[84,86]}},
    /* history readings: one PDF per lesson; reads[sub] = [doc, book page of each pdf page] (the Han scan skips p. 262) */
    wh4:{unit:4,docs:[['unify','The Unification of China'],['qin','The Qin Dynasty'],['han','Han Emperors in China'],['tang','Tang and Song China'],['mongol','Rise of the Mongols'],['kublai','Kublai Khan'],['ming','Ming Dynasty']],
      secs:{},reads:{'wh4-unify':['unify',rng(137,141)],'wh4-qin':['qin',rng(141,143)],'wh4-han':['han',[256,257,258,259,260,261,263,264,265]],
        'wh4-tang':['tang',rng(310,317)],'wh4-mongol':['mongol',rng(320,325)],'wh4-kublai':['kublai',rng(325,329)],'wh4-ming':['ming',rng(617,623)]}}};
  function rng(a,b){const o=[];for(let i=a;i<=b;i++)o.push(i);return o}
  const readOf=(tid,doc)=>{const R=DATA[tid]&&DATA[tid].reads;if(!R)return null;for(const k in R)if(R[k][0]===doc)return R[k][1];return null};
  const pageLabel=(tid,doc,p)=>doc==='book'?p+DATA[tid].offset:(readOf(tid,doc)||[])[p-1];   // undefined: plain pdf page numbers (answer scans)
  const toPdf=(tid,doc,n)=>{if(doc==='book')return n-DATA[tid].offset;const ns=readOf(tid,doc);if(!ns)return n;const i=ns.indexOf(n);return i>=0?i+1:(n<ns[0]?1:ns.length)};
  const has=new Set();                                   // "pc5:book" keys stored on this device
  /* ---------- IndexedDB ---------- */
  let dbp=null;
  const db=()=>dbp||(dbp=new Promise((ok,no)=>{if(typeof indexedDB==='undefined')return no(new Error('no storage'));
    const q=indexedDB.open('ionized-books',1);q.onupgradeneeded=()=>q.result.createObjectStore('files');q.onsuccess=()=>ok(q.result);q.onerror=()=>no(q.error)}));
  const tx=(mode,fn)=>db().then(d=>new Promise((ok,no)=>{const t=d.transaction('files',mode),s=t.objectStore('files');const r=fn(s);t.oncomplete=()=>ok(r&&r.result);t.onerror=()=>no(t.error)}));
  const get=k=>tx('readonly',s=>s.get(k)),put=(k,v)=>tx('readwrite',s=>s.put(v,k)),del=k=>tx('readwrite',s=>s.delete(k));
  const localAt={};                                      // key -> 'at' stamp of the copy on this device
  const ready=db().then(d=>new Promise(ok=>{const st=d.transaction('files').objectStore('files'),q=st.getAllKeys(),v=st.getAll();
    v.onsuccess=()=>{(q.result||[]).forEach((k,i)=>{has.add(k);localAt[k]=(v.result[i]||{}).at||0});ok()};v.onerror=()=>ok()})).catch(()=>{});

  /* ---------- the copy saved under the sync code: /codes/<code>/pdf/meta/<key> and /pdf/data/<key>/<i> ---------- */
  const FB='https://ionized-study-and-shi-default-rtdb.firebaseio.com';
  const code=()=>typeof SYNC!=='undefined'?SYNC.code:null;
  let cloud={},cloudFor=null;const busy={};               // busy[key] = 'up 40%' / 'down 40%' / 'failed'
  const CHUNK=512*1024;                                   // base64 characters per stored piece
  async function rest(path,method,body){const c=code();if(!c)throw new Error('no code');
    const r=await fetch(`${FB}/codes/${c}/pdf/${path}.json`,{method:method||'GET',cache:'no-store',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
    if(!r.ok)throw new Error('HTTP '+r.status);return r.json()}
  const enc=k=>k.replace(':','__');                       // keep database keys simple
  async function loadCloud(){const c=code();if(!c)return;
    try{const m=await rest('meta');if(code()!==c)return;cloud={};for(const k in m||{})if(safeKey(k))cloud[k.replace('__',':')]=m[k];cloudFor=c}catch(e){return}
    for(const k of has)if(!cloud[k]||(localAt[k]||0)>cloud[k].at)upload(k);   // copies added before syncing, or newer than the saved one
    refresh()}
  const b64of=blob=>new Promise((ok,no)=>{const fr=new FileReader();fr.onload=()=>ok(String(fr.result).split(',')[1]||'');fr.onerror=()=>no(fr.error);fr.readAsDataURL(blob)});
  function setBusy(k,v){if(v)busy[k]=v;else delete busy[k];document.querySelectorAll(`[data-bk-st="${k}"]`).forEach(el=>{el.textContent=stText(k)})}
  async function upload(k){if(busy[k]&&busy[k]!=='failed'||!code())return;
    try{setBusy(k,'up 0%');const rec=await get(k);if(!rec)return setBusy(k);const b=await b64of(rec.blob);const n=Math.max(1,Math.ceil(b.length/CHUNK));
      await rest('data/'+enc(k),'DELETE');
      for(let i=0;i<n;i++){await rest('data/'+enc(k)+'/'+i,'PUT',b.slice(i*CHUNK,(i+1)*CHUNK));setBusy(k,'up '+Math.round((i+1)/n*100)+'%')}
      const meta={name:rec.name,size:rec.size,at:rec.at||Date.now(),n};await rest('meta/'+enc(k),'PUT',meta);cloud[k]=meta;setBusy(k);refresh();
    }catch(e){setBusy(k,'failed')}}
  async function download(k,onp){const meta=cloud[k];if(!meta)throw new Error('This PDF is not saved to your code.');
    setBusy(k,'down 0%');const parts=[];
    try{for(let i=0;i<meta.n;i++){const piece=await rest('data/'+enc(k)+'/'+i);if(typeof piece!=='string')throw new Error('The saved copy is incomplete. Add the PDF again on the device that has it.');
        parts.push(piece);const pct=Math.round((i+1)/meta.n*100);setBusy(k,'down '+pct+'%');if(onp)onp(pct)}
      const bin=atob(parts.join(''));const u8=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u8[i]=bin.charCodeAt(i);
      await put(k,{blob:new Blob([u8],{type:'application/pdf'}),name:meta.name,size:meta.size,at:meta.at});has.add(k);localAt[k]=meta.at;setBusy(k);
    }catch(e){setBusy(k);throw e}}
  const avail=k=>has.has(k)||!!cloud[k];
  const mb=n=>(n/1048576).toFixed(1)+' MB';
  function stText(k){const b=busy[k];
    if(b==='failed')return'Not saved to your code yet (connection problem).';
    if(b&&b.startsWith('up'))return'Saving to your code… '+b.slice(3);
    if(b&&b.startsWith('down'))return'Downloading from your code… '+b.slice(5);
    if(has.has(k)&&cloud[k]&&cloud[k].at<=(localAt[k]||0))return'Saved to your code · on this device';
    if(cloud[k])return'Saved to your code · downloads when you open it ('+mb(cloud[k].size)+')';
    if(has.has(k))return code()?'On this device · saving to your code…':'On this device';
    return'';}
  if(typeof document!=='undefined'){document.addEventListener('amcprep:code',()=>{cloud={};cloudFor=null;ready.then(loadCloud)});
    window.addEventListener('online',()=>{for(const k in busy)if(busy[k]==='failed'){delete busy[k];upload(k)}})}

  /* ---------- helpers ---------- */
  const bookPage=(tid,p)=>p+DATA[tid].offset;
  const subTopic=sid=>Object.keys(DATA).find(t=>DATA[t].secs[sid]||(DATA[t].reads&&DATA[t].reads[sid]));
  const ICON='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5zM4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/></svg>';
  const span=ns=>`pp. ${ns[0]}–${ns[ns.length-1]}`;
  function lessonBar(sid){
    const tid=subTopic(sid);if(!tid)return'';const D=DATA[tid];
    if(D.reads&&D.reads[sid]){const [doc,ns]=D.reads[sid],k=tid+':'+doc;   // a history lesson: its own reading PDF
      return`<div class="bkbar">${ICON}<span><b>Reading</b> · ${span(ns)}</span><span class="sp"></span>
        ${avail(k)?`<button class="btn sm" data-bk-open="${k}">Open the reading</button>`:`<button class="btn sm" data-bk-add="${k}" data-bk-then="1">Add the reading PDF</button>`}</div>`}
    const [a,b]=D.secs[sid],ok=avail(tid+':book');
    const range=`pp. ${bookPage(tid,a)}–${bookPage(tid,b)}`;const ans=D.docs.filter(d=>d[0]!=='book'&&avail(tid+':'+d[0]));
    return`<div class="bkbar">${ICON}<span><b>Textbook</b> · Chapter ${D.ch}, ${range}</span><span class="sp"></span>
      ${ok?`<button class="btn sm" data-bk-open="${tid}:book:${a}">Open ${range}</button>`:`<button class="btn sm" data-bk-add="${tid}:book" data-bk-then="${a}">Add your Chapter ${D.ch} PDF</button>`}
      ${ans.map(d=>`<button class="btn sm" data-bk-open="${tid}:${d[0]}">${d[1]}</button>`).join('')}</div>`;
  }
  function chapterCard(tid){
    const D=DATA[tid];if(!D)return'';
    const row=([id,label])=>{const k=tid+':'+id,ok=avail(k),ns=readOf(tid,id);
      return`<div class="bkrow"><span class="bkname">${label}${id==='book'?` <span class="meta">book pp. ${bookPage(tid,1)}–${bookPage(tid,D.pages)}</span>`:ns?` <span class="meta">${span(ns)}</span>`:''}<span class="bkst" data-bk-st="${k}">${stText(k)}</span></span><span class="sp"></span>
      ${busy[k]==='failed'?`<button class="btn sm" data-bk-up="${k}">Try again</button>`:''}
      ${ok?`<button class="btn sm pri" data-bk-open="${k}">Open</button><button class="btn sm fb-plain" data-bk-add="${k}">Replace</button><button class="btn sm fb-plain" data-bk-del="${k}">Remove</button>`
         :`<button class="btn sm" data-bk-add="${k}">Add PDF</button>`}</div>`};
    if(D.reads)return`<div class="card bkcard"><div class="bkhead">${ICON}<div><b>Your ${Hs(typeof findTopic==='function'&&findTopic(tid)?findTopic(tid).name:'Unit '+D.unit)} readings</b><div class="meta">Add each reading’s PDF once and open it from its lesson. Files are saved to your sync code, so every device using your code gets them.</div></div></div>
      ${D.docs.map(row).join('')}</div>`;
    const ex=D.extra;const jump=avail(tid+':book')?`<div class="bkjump">Jump to: ${[['Chapter Review',ex.review],['Chapter Test',ex.test]].map(([n,r])=>`<button class="chip" data-bk-open="${tid}:book:${r[0]}">${n} (p. ${bookPage(tid,r[0])})</button>`).join(' ')}</div>`:'';
    return`<div class="card bkcard"><div class="bkhead">${ICON}<div><b>Your Chapter ${D.ch} textbook</b><div class="meta">Read the chapter here. Each section's lesson links straight to its pages. Files are saved to your sync code, so every device using your code gets them; each device downloads a copy the first time it opens one.</div></div></div>
      ${D.docs.map(row).join('')}${jump}</div>`;
  }

  /* ---------- adding / removing files ---------- */
  let picker=null;
  function pick(key,thenPage){
    if(!picker){picker=document.createElement('input');picker.type='file';picker.accept='application/pdf,.pdf';picker.hidden=true;document.body.appendChild(picker)}
    picker.value='';picker.onchange=async()=>{const f=picker.files&&picker.files[0];if(!f)return;
      if(!/pdf$/i.test(f.type)&&!/\.pdf$/i.test(f.name)){alert('Please choose a PDF file.');return}
      const at=Date.now();try{await put(key,{blob:f,name:f.name,size:f.size,at});has.add(key);localAt[key]=at}catch(e){alert('Could not save the file on this device: '+(e.message||e));return}
      delete busy[key];refresh();upload(key);if(thenPage)open(key,+thenPage)};
    picker.click();
  }
  async function remove(key){if(!confirm('Remove this PDF from your sync code? It will be removed from every device that uses your code.'))return;
    await del(key).catch(()=>{});has.delete(key);delete localAt[key];
    if(code()){try{await rest('meta/'+enc(key),'DELETE');await rest('data/'+enc(key),'DELETE')}catch(e){}}delete cloud[key];
    refresh()}
  function refresh(){if(typeof route==='function'){const y=window.scrollY;window.__quietRoute=true;try{route()}finally{window.__quietRoute=false}window.scrollTo(0,y)}}

  /* ---------- the reader ---------- */
  let lib=null;
  function loadLib(){if(lib)return lib;
    lib=new Promise((ok,no)=>{const u='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',s=document.createElement('script');s.src=u;
      if(SRI[u]){s.integrity=SRI[u];s.crossOrigin='anonymous'}
      s.onload=()=>{try{window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';ok(window.pdfjsLib)}catch(e){no(e)}};
      s.onerror=()=>{lib=null;no(new Error('Could not load the PDF reader. Check your internet connection.'))};document.head.appendChild(s)});
    return lib}
  let V=null;                                            // current viewer state
  const $b=()=>document.getElementById('bkvBody'),pageDiv=p=>document.querySelector(`#bkvPages .bkv-page[data-p="${p}"]`);
  const Hs=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const mid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);

  /* where you were in each file, kept on this device only: switching between the book and the answers comes back to the same spot */
  const POS='amcprep.bkpos';
  const posAll=()=>{try{return JSON.parse(localStorage.getItem(POS)||'{}')||{}}catch(e){return{}}};
  function savePos(){if(!V||!V.ready)return;const d=pageDiv(V.cur),body=$b();if(!d)return;
    const f=Math.max(0,Math.min(1,(body.scrollTop+10-d.offsetTop)/d.offsetHeight)),all=posAll();all[V.key]={p:V.cur,f:+f.toFixed(3),z:V.z};
    try{localStorage.setItem(POS,JSON.stringify(all))}catch(e){}}
  let posT=null;const savePosSoon=()=>{clearTimeout(posT);posT=setTimeout(savePos,250)};

  /* ---------- highlights and sticky notes: /codes/<code>/pdf/marks/<file>/<id>, also cached on this device ----------
     highlight {k:'h', p: pdf page, r: [[x,y,w,h]…] as fractions of the page, c: colour, t: the highlighted text, at}
     note      {k:'n', p, y: fraction of the page, h: highlight id ('' for a loose note), v: the note, at}
     removed   {del:1, at}                                                                                         */
  const HL={y:'Yellow',g:'Green',b:'Blue',p:'Pink'};let lastC='y';
  let marks={},marksKey=null;
  const mkStore=k=>'amcprep.marks.'+(code()||'local')+'.'+k;
  function loadMarks(k){marksKey=k;try{marks=JSON.parse(localStorage.getItem(mkStore(k))||'{}')||{}}catch(e){marks={}}}
  const keepMarks=()=>{if(marksKey)try{localStorage.setItem(mkStore(marksKey),JSON.stringify(marks))}catch(e){}};
  const num=(v,a,b)=>typeof v==='number'&&isFinite(v)&&v>=a&&v<=b;
  function cleanMark(r){if(!r||typeof r!=='object'||!num(r.at,0,1e14))return null;if(r.del)return{del:1,at:r.at};   // anything synced is checked before use
    if(!Number.isInteger(r.p)||r.p<1||r.p>5000)return null;
    if(r.k==='h'){const rs=(Array.isArray(r.r)?r.r:Object.values(r.r||{})).map(q=>Array.isArray(q)?q:Object.values(q||{}))
        .filter(q=>q.length===4&&q.every(x=>num(x,-.01,1.01))).slice(0,120);
      return rs.length?{k:'h',p:r.p,r:rs,c:HL[r.c]?r.c:'y',t:String(r.t||'').slice(0,2000),at:r.at}:null}
    if(r.k==='n')return{k:'n',p:r.p,y:num(r.y,0,1)?r.y:0,h:r.h&&safeId(r.h)?r.h:'',v:String(r.v||'').slice(0,5000),at:r.at};
    return null}
  const live=id=>!!(marks[id]&&!marks[id].del);
  function pushMark(id){keepMarks();if(code()&&marksKey)rest('marks/'+enc(marksKey)+'/'+id,'PUT',marks[id]).catch(()=>{})}
  async function pullMarks(k){if(!code())return;let m;try{m=await rest('marks/'+enc(k))}catch(e){return}if(marksKey!==k)return;m=m&&typeof m==='object'?m:{};
    let changed=false;
    for(const id in m){if(!safeId(id))continue;const r=cleanMark(m[id]);if(r&&(!marks[id]||r.at>marks[id].at)){marks[id]=r;changed=true}}
    for(const id in marks)if(!m[id]||marks[id].at>(m[id].at||0))pushMark(id);     // made offline, or before this device had the code
    if(changed){keepMarks();ensureRoom();paintMarks()}}
  const noteT={};
  function flushNotes(){for(const id in noteT){clearTimeout(noteT[id].t);noteT[id].fn()}}
  function setMark(id,r){flushNotes();r.at=Date.now();marks[id]=r;pushMark(id);paintMarks(r.p,true)}
  function dropMark(id){flushNotes();const p=marks[id]&&marks[id].p,at=Date.now();marks[id]={del:1,at};pushMark(id);
    for(const n in marks)if(live(n)&&marks[n].k==='n'&&marks[n].h===id){marks[n]={del:1,at};pushMark(n)}   // a highlight's notes go with it
    ensureRoom();paintMarks(p,true)}
  const hasNotes=()=>Object.keys(marks).some(id=>live(id)&&marks[id].k==='n');
  function paintMarks(only,force){if(!V||marksKey!==V.key)return;
    document.querySelectorAll('#bkvPages .bkv-page').forEach(d=>{const p=+d.dataset.p;if(only&&p!==only)return;
      const hs=[],ns=[];for(const id in marks){const m=marks[id];if(m.del||m.p!==p)continue;(m.k==='h'?hs:ns).push([id,m])}
      d.querySelector('.bkv-hl').innerHTML=hs.map(([id,m])=>m.r.map(q=>`<i class="bkv-h c-${m.c}" style="left:${q[0]*100}%;top:${q[1]*100}%;width:${q[2]*100}%;height:${q[3]*100}%"></i>`).join('')).join('');
      const nl=d.querySelector('.bkv-notes');if(!force&&nl.contains(document.activeElement))return;   // never wipe a note while it is being typed
      const open=new Set([...nl.querySelectorAll('.bkv-note.open')].map(x=>x.dataset.nid));
      ns.sort((a,b)=>a[1].y-b[1].y);
      nl.innerHTML=ns.map(([id,m])=>{const h=m.h&&live(m.h)?marks[m.h]:null;
        return`<div class="bkv-note${open.has(id)?' open':''}" data-nid="${id}" data-y="${m.y}"><div class="bkv-nh">${h?`<span class="dot c-${h.c}"></span><span class="q">${Hs(h.t||'Highlighted area')}</span>`:'<span class="q">Note</span>'}
          <button type="button" data-ndel aria-label="Delete note" title="Delete note">×</button></div><textarea data-ntext rows="2" placeholder="Write a note…" aria-label="Note">${Hs(m.v)}</textarea></div>`}).join('');
      arrange(d)})}
  function arrange(d){const nl=d.querySelector('.bkv-notes'),H=d.offsetHeight;let bottom=-1e9;          // stack notes near their highlight without overlapping
    nl.querySelectorAll('.bkv-note').forEach(el=>{const ta=el.querySelector('textarea');if(ta&&el.offsetParent){ta.style.height='auto';ta.style.height=ta.scrollHeight+'px'}
      const top=Math.max((+el.dataset.y)*H,bottom+8);el.style.top=top+'px';bottom=top+el.offsetHeight})}
  function ensureRoom(){if(V&&V.ready&&V.room!==roomFor())layout(true)}
  const roomFor=()=>$b().clientWidth>=900&&hasNotes()?250:0;
  function addNote(hid,p,y){const h=hid&&marks[hid],id=mid();
    setMark(id,{k:'n',p:h?h.p:p,y:h?Math.max(0,Math.min(...h.r.map(q=>q[1]))):y,h:hid||'',v:''});ensureRoom();
    requestAnimationFrame(()=>{const el=document.querySelector(`[data-nid="${id}"]`);if(!el)return;
      if(V&&V.narrow){document.querySelectorAll('.bkv-note.open').forEach(x=>x.classList.remove('open'));el.classList.add('open');arrange(el.closest('.bkv-page'))}
      el.scrollIntoView({block:'nearest',behavior:'smooth'});const ta=el.querySelector('textarea');if(ta)ta.focus({preventScroll:true})})}

  /* the little menu over a selection or a highlight */
  let P=null;
  function pop(){let el=document.getElementById('bkvPop');if(el)return el;el=document.createElement('div');el.id='bkvPop';el.className='bkv-pop';el.hidden=true;document.body.appendChild(el);
    el.addEventListener('pointerdown',e=>e.preventDefault());                    // keep the text selection while choosing
    el.addEventListener('mousedown',e=>e.preventDefault());
    el.addEventListener('click',e=>{const b=e.target.closest('button');if(!b||!P)return;const a=b.dataset.a,c=b.dataset.c;
      if(P.sel){if(c)lastC=c;const ids=P.sel.map(g=>{const id=mid();setMark(id,{k:'h',p:g.p,r:g.r,c:c||lastC,t:P.text});return id});
        try{getSelection().removeAllRanges()}catch(_){}hidePop();if(a==='note')addNote(ids[0]);return}
      if(P.hid&&live(P.hid)){if(c){lastC=c;setMark(P.hid,Object.assign({},marks[P.hid],{c}));showPop(P.x,P.y,{hid:P.hid});return}
        const hid=P.hid;hidePop();if(a==='note')addNote(hid);else if(a==='del')dropMark(hid)}});
    return el}
  function showPop(x,y,ctx){const el=pop();P=Object.assign({x,y},ctx);const cur=ctx.hid&&marks[ctx.hid]?marks[ctx.hid].c:null;
    el.innerHTML=Object.keys(HL).map(c=>`<button type="button" class="sw c-${c}${c===cur?' on':''}" data-c="${c}" aria-label="${ctx.hid?'Change to ':'Highlight '}${HL[c]}" title="${HL[c]}"></button>`).join('')
      +(ctx.sel?'<button type="button" data-a="note">Highlight + note</button>':'<button type="button" data-a="note">Add note</button><button type="button" data-a="del">Remove</button>');
    el.hidden=false;const w=el.offsetWidth,h=el.offsetHeight;
    el.style.left=Math.max(8,Math.min(innerWidth-w-8,x-w/2))+'px';el.style.top=(y+h+8>innerHeight?Math.max(8,y-h-40):y)+'px'}
  function hidePop(){P=null;const el=document.getElementById('bkvPop');if(el)el.hidden=true}
  function mergeRects(rs){rs.sort((a,b)=>a[1]-b[1]||a[0]-b[0]);const out=[];
    for(const q of rs){const l=out[out.length-1];if(l&&Math.abs(l[1]-q[1])<.004&&Math.abs(l[3]-q[3])<.006&&q[0]<=l[0]+l[2]+.012){const r=Math.max(l[0]+l[2],q[0]+q[2]);l[2]=+(r-l[0]).toFixed(4)}else out.push(q.slice())}
    return out}
  function checkSel(){if(!V)return;const s=getSelection();if(!s||s.isCollapsed||!s.rangeCount){if(P&&P.sel)hidePop();return}
    const rg=s.getRangeAt(0),box=document.getElementById('bkvPages');if(!box||!box.contains(rg.commonAncestorContainer))return;
    const pages=[...box.querySelectorAll('.bkv-page')].map(d=>[d,d.getBoundingClientRect()]).filter(([,r])=>r.bottom>0&&r.top<innerHeight),groups={};
    for(const q of rg.getClientRects()){if(q.width<1||q.height<1)continue;const cx=q.left+q.width/2,cy=q.top+q.height/2;
      const hit=pages.find(([,r])=>cx>=r.left&&cx<=r.right&&cy>=r.top&&cy<=r.bottom);if(!hit)continue;const [d,r]=hit;
      (groups[d.dataset.p]=groups[d.dataset.p]||[]).push([(q.left-r.left)/r.width,(q.top-r.top)/r.height,q.width/r.width,q.height/r.height].map(v=>+v.toFixed(4)))}
    const sel=Object.keys(groups).map(p=>({p:+p,r:mergeRects(groups[p])}));if(!sel.length)return;
    const b=rg.getBoundingClientRect();showPop(b.left+b.width/2,b.bottom+10,{sel,text:s.toString().replace(/\s+/g,' ').trim().slice(0,2000)})}

  function shell(){
    let el=document.getElementById('bkv');if(el)return el;
    el=document.createElement('div');el.id='bkv';el.className='bkv';el.setAttribute('role','dialog');el.setAttribute('aria-label','Textbook');
    el.innerHTML=`<div class="bkv-top"><div class="bkv-tabs" id="bkvTabs"></div><span class="sp"></span>
      <div class="bkv-nav"><button class="bkv-b" id="bkvPrev" aria-label="Previous page">‹</button><label class="bkv-pg"><span id="bkvPre">p.</span><input id="bkvIn" inputmode="numeric" aria-label="Go to page"><span id="bkvOf"></span></label><button class="bkv-b" id="bkvNext" aria-label="Next page">›</button></div>
      <div class="bkv-nav"><button class="bkv-b" id="bkvOut" aria-label="Zoom out">−</button><button class="bkv-b" id="bkvFit" aria-label="Fit width">Fit</button><button class="bkv-b" id="bkvZin" aria-label="Zoom in">+</button></div>
      <div class="bkv-nav"><button class="bkv-b" id="bkvArea" aria-pressed="false" title="Highlight an area by dragging a box (for scanned pages)"><span class="bkv-wide">Highlight a</span><span class="bkv-narrow">A</span>rea</button><button class="bkv-b" id="bkvNote" title="Add a sticky note on this page">+ Note</button></div>
      <button class="bkv-b bkv-x" id="bkvClose" aria-label="Close">${icon('x')}</button></div>
      <div class="bkv-body" id="bkvBody"><div class="bkv-msg" id="bkvMsg">Opening…</div><div class="bkv-pages" id="bkvPages"></div></div>`;
    document.body.appendChild(el);
    const $=id=>el.querySelector('#'+id),pages=$('bkvPages');
    $('bkvClose').onclick=close;
    $('bkvPrev').onclick=()=>V&&go(V.cur-1);$('bkvNext').onclick=()=>V&&go(V.cur+1);
    $('bkvOut').onclick=()=>V&&zoom(V.z/1.25);$('bkvZin').onclick=()=>V&&zoom(V.z*1.25);$('bkvFit').onclick=()=>V&&zoom(1);
    $('bkvArea').onclick=()=>{if(!V)return;V.area=!V.area;$('bkvArea').classList.toggle('on',V.area);$('bkvArea').setAttribute('aria-pressed',String(V.area));pages.classList.toggle('area',V.area);hidePop()};
    $('bkvNote').onclick=()=>{if(!V||!V.ready)return;const d=pageDiv(V.cur),body=$b();if(!d)return;
      addNote('',V.cur,Math.max(0,Math.min(.95,(body.scrollTop+body.clientHeight*.3-d.offsetTop)/d.offsetHeight)))};
    $('bkvIn').addEventListener('keydown',e=>{if(e.key!=='Enter'||!V)return;const n=parseInt($('bkvIn').value,10);if(!isFinite(n))return;go(toPdf(V.tid,V.doc,n))});
    $('bkvBody').addEventListener('scroll',()=>{if(V){track();sweep();savePosSoon();if(P&&P.hid)hidePop()}},{passive:true});
    $('bkvBody').addEventListener('click',e=>{if(!V||e.target.closest('.bkv-note'))return;const s=getSelection();if(s&&!s.isCollapsed)return;
      document.querySelectorAll('.bkv-note.open').forEach(x=>x.classList.remove('open'));
      const d=e.target.closest('.bkv-page');if(!d||V.area){if(!V.area)hidePop();return}
      const p=+d.dataset.p,r=d.getBoundingClientRect(),x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height;
      const id=Object.keys(marks).find(k=>live(k)&&marks[k].k==='h'&&marks[k].p===p&&marks[k].r.some(q=>x>=q[0]&&x<=q[0]+q[2]&&y>=q[1]-.004&&y<=q[1]+q[3]+.004));
      if(id)showPop(e.clientX,e.clientY+14,{hid:id});else hidePop()});
    /* sticky notes: type to edit (saved as you go), × to delete; on phones they fold into pins on the page edge */
    pages.addEventListener('input',e=>{const ta=e.target.closest('[data-ntext]');if(!ta)return;const el=ta.closest('.bkv-note'),id=el.dataset.nid;arrange(el.closest('.bkv-page'));
      if(noteT[id])clearTimeout(noteT[id].t);const fn=()=>{delete noteT[id];if(live(id)){marks[id]=Object.assign({},marks[id],{v:ta.value.slice(0,5000),at:Date.now()});pushMark(id)}};
      noteT[id]={fn,t:setTimeout(fn,500)}});
    pages.addEventListener('click',e=>{const del=e.target.closest('[data-ndel]');
      if(del){const id=del.closest('.bkv-note').dataset.nid;flushNotes();if(marks[id]&&marks[id].v&&!confirm('Delete this note?'))return;dropMark(id);return}
      const n=e.target.closest('.bkv-note');if(n&&V&&V.narrow&&!n.classList.contains('open')){document.querySelectorAll('.bkv-note.open').forEach(x=>x.classList.remove('open'));n.classList.add('open');arrange(n.closest('.bkv-page'));const ta=n.querySelector('textarea');if(ta)ta.focus({preventScroll:true})}});
    /* area highlights: drag a box on the page */
    let drag=null;
    pages.addEventListener('pointerdown',e=>{if(!V||!V.area||e.button>0||e.target.closest('.bkv-note'))return;const d=e.target.closest('.bkv-page');if(!d)return;
      e.preventDefault();try{d.setPointerCapture(e.pointerId)}catch(_){}const r=d.getBoundingClientRect();
      drag={d,r,id:e.pointerId,x0:(e.clientX-r.left)/r.width,y0:(e.clientY-r.top)/r.height,el:document.createElement('div')};drag.el.className='bkv-drag';d.appendChild(drag.el)});
    const box=e=>{const {r,x0,y0}=drag,x1=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y1=Math.max(0,Math.min(1,(e.clientY-r.top)/r.height));
      return[Math.min(x0,x1),Math.min(y0,y1),Math.abs(x1-x0),Math.abs(y1-y0)].map(v=>+v.toFixed(4))};
    pages.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;const q=box(e);Object.assign(drag.el.style,{left:q[0]*100+'%',top:q[1]*100+'%',width:q[2]*100+'%',height:q[3]*100+'%'})});
    const endDrag=e=>{if(!drag||drag.id!==e.pointerId)return;const q=box(e),p=+drag.d.dataset.p;drag.el.remove();drag=null;
      if(e.type==='pointerup'&&q[2]>.01&&q[3]>.006){const id=mid();setMark(id,{k:'h',p,r:[q],c:lastC,t:''});showPop(e.clientX,e.clientY+14,{hid:id})}};
    pages.addEventListener('pointerup',endDrag);pages.addEventListener('pointercancel',endDrag);
    let selT=null;document.addEventListener('selectionchange',()=>{if(!V||!el.classList.contains('open'))return;clearTimeout(selT);selT=setTimeout(checkSel,250)});
    document.addEventListener('keydown',e=>{if(!V||!el.classList.contains('open'))return;
      if(e.target.tagName==='TEXTAREA'){if(e.key==='Escape')e.target.blur();return}
      if(e.key==='Escape'){if(P)hidePop();else close()}
      else if(e.target.tagName!=='INPUT'&&(e.key==='ArrowRight'||e.key==='PageDown'))go(V.cur+1);else if(e.target.tagName!=='INPUT'&&(e.key==='ArrowLeft'||e.key==='PageUp'))go(V.cur-1)});
    window.addEventListener('resize',()=>{if(V&&el.classList.contains('open'))layout(true)});
    document.addEventListener('visibilitychange',()=>{if(!document.hidden&&V&&el.classList.contains('open'))pullMarks(V.key)});
    document.addEventListener('amcprep:code',()=>{if(V){loadMarks(V.key);paintMarks(0,true);pullMarks(V.key)}});
    return el;
  }
  async function open(key,page){
    const [tid,doc]=key.split(':');const el=shell(),$=id=>el.querySelector('#'+id);
    el.classList.add('open');document.body.classList.add('bkv-on');hidePop();
    $('bkvTabs').innerHTML=DATA[tid].docs.filter(d=>avail(tid+':'+d[0])).map(d=>`<button class="bkv-tab${d[0]===doc?' on':''}" data-bk-open="${tid}:${d[0]}">${d[1]}</button>`).join('');
    if(V&&V.key===key){if(page)go(page);return}
    if(V){savePos();flushNotes();teardown()}
    $('bkvMsg').hidden=false;$('bkvMsg').textContent='Opening…';$('bkvPages').innerHTML='';
    try{
      if(cloud[key]&&(!has.has(key)||(localAt[key]||0)<cloud[key].at)){
        await download(key,p=>{const m=document.getElementById('bkvMsg');if(m)m.textContent='Downloading from your code… '+p+'%'})}
      const rec=await get(key);if(!rec)throw new Error('That PDF is not on this device or in your code yet.');
      const pdfjs=await loadLib();const data=new Uint8Array(await rec.blob.arrayBuffer());
      const pdf=await pdfjs.getDocument({data,isEvalSupported:false}).promise;const p1=await pdf.getPage(1);const vp=p1.getViewport({scale:1});
      const saved=posAll()[key];
      V={key,tid,doc,isBook:pageLabel(tid,doc,1)!=null,pdf,n:pdf.numPages,ar:vp.height/vp.width,z:saved&&num(saved.z,.5,3)?saved.z:1,cur:1,rendered:new Map(),obs:null,area:false};
      $('bkvArea').classList.remove('on');$('bkvArea').setAttribute('aria-pressed','false');$('bkvPages').classList.remove('area');
      $('bkvMsg').hidden=true;
      const want=doc==='book'?DATA[tid].pages:(readOf(tid,doc)||[]).length;if(V.isBook&&V.n!==want){$('bkvMsg').hidden=false;$('bkvMsg').textContent=`This file has ${V.n} pages, but this ${doc==='book'?'chapter':'reading'} should have ${want}, so page numbers may be off.`}
      loadMarks(key);build();V.ready=true;
      if(page)go(page,true);                                   // a link to a section opens its page
      else if(saved){go(saved.p,true);const d=pageDiv(V.cur);if(d)$b().scrollTop=d.offsetTop-10+(saved.f||0)*d.offsetHeight}   // otherwise, back where you were
      else go(1,true);
      pullMarks(key);
    }catch(e){$('bkvMsg').hidden=false;$('bkvMsg').textContent=e.message||'Could not open this PDF.'}
  }
  function build(){
    const box=document.getElementById('bkvPages');box.innerHTML='';
    for(let i=1;i<=V.n;i++){const d=document.createElement('div');d.className='bkv-page';d.dataset.p=i;
      d.innerHTML=`<div class="bkv-hl"></div><div class="textLayer"></div><div class="bkv-notes"></div><span class="bkv-num">${V.isBook?'p. '+pageLabel(V.tid,V.doc,i):'page '+i}</span>`;box.appendChild(d)}
    layout(false);
    document.getElementById('bkvOf').textContent=V.isBook?` (${V.n} pages)`:` of ${V.n}`;document.getElementById('bkvPre').textContent=V.isBook?'p.':'';
  }
  function layout(keep){
    const body=$b(),box=document.getElementById('bkvPages');const p=keep?V.cur:null;
    V.narrow=body.clientWidth<900;V.room=roomFor();box.classList.toggle('nn',V.narrow);box.style.paddingRight=V.room+'px';   // a column for sticky notes on wide screens
    const w=Math.min(body.clientWidth-24-V.room,980)*V.z;V.w=w;
    document.querySelectorAll('#bkvPages .bkv-page').forEach(d=>{d.style.width=w+'px';d.style.height=(w*V.ar)+'px'});
    V.rendered.forEach((c,pg)=>{if(c.w!==w)unpaint(pg,pageDiv(pg))});
    paintMarks(0,true);
    if(keep&&p)go(p,true);else sweep();
  }
  async function paint(p,d){
    if(!V||V.rendered.has(p))return;const tok={w:V.w};V.rendered.set(p,tok);
    try{const page=await V.pdf.getPage(p);if(V.rendered.get(p)!==tok)return;
      const dpr=Math.min(2,window.devicePixelRatio||1),base=page.getViewport({scale:1}),sc=tok.w/base.width,vp=page.getViewport({scale:sc*dpr});
      const c=document.createElement('canvas');c.width=Math.floor(vp.width);c.height=Math.floor(vp.height);c.style.width=tok.w+'px';c.style.height=(tok.w*base.height/base.width)+'px';
      await page.render({canvasContext:c.getContext('2d'),viewport:vp}).promise;
      if(V.rendered.get(p)!==tok)return;d.querySelectorAll('canvas').forEach(x=>x.remove());d.appendChild(c);
      const tl=d.querySelector('.textLayer');                  // selectable text over the page (scans have none: use "Highlight area")
      if(tl&&window.pdfjsLib&&pdfjsLib.renderTextLayer){tl.innerHTML='';tl.style.setProperty('--scale-factor',sc);
        try{const tc=await page.getTextContent();if(V.rendered.get(p)!==tok)return;await pdfjsLib.renderTextLayer({textContentSource:tc,container:tl,viewport:page.getViewport({scale:sc}),textDivs:[]}).promise}catch(e){}}
    }catch(e){if(V)V.rendered.delete(p)}
  }
  /* draw the pages near the visible area and free canvases far away (keeps memory low on phones) */
  function sweep(){if(!V)return;const body=$b();const top=body.scrollTop,h=body.clientHeight;
    document.querySelectorAll('#bkvPages .bkv-page').forEach(d=>{const p=+d.dataset.p,y0=d.offsetTop,y1=y0+d.offsetHeight;
      if(y1>top-h&&y0<top+2*h)paint(p,d);else if(y1<top-3*h||y0>top+4*h)unpaint(p,d)})}
  function unpaint(p,d){if(!V||!V.rendered.has(p))return;V.rendered.delete(p);if(d){d.querySelectorAll('canvas').forEach(c=>{c.width=c.height=0;c.remove()});const tl=d.querySelector('.textLayer');if(tl&&!tl.contains(document.activeElement))tl.innerHTML=''}}
  function go(p,instant){if(!V)return;p=Math.max(1,Math.min(V.n,p|0));const d=pageDiv(p);const body=$b();
    if(d)body.scrollTo({top:d.offsetTop-10,behavior:instant?'auto':'smooth'});V.cur=p;label();sweep();setTimeout(sweep,450)}
  function track(){const body=$b();const mid=body.scrollTop+body.clientHeight*0.35;let cur=1;
    document.querySelectorAll('#bkvPages .bkv-page').forEach(d=>{if(d.offsetTop<=mid)cur=+d.dataset.p});if(cur!==V.cur){V.cur=cur;label()}}
  function label(){const inp=document.getElementById('bkvIn');if(document.activeElement!==inp)inp.value=V.isBook?pageLabel(V.tid,V.doc,V.cur):V.cur}
  function zoom(z){V.z=Math.max(0.5,Math.min(3,z));layout(true);savePos()}
  function teardown(){if(!V)return;V.rendered.forEach((_,p)=>unpaint(p,pageDiv(p)));try{V.pdf.destroy()}catch(e){}V=null}
  function close(){if(V){savePos();flushNotes()}hidePop();const el=document.getElementById('bkv');if(el)el.classList.remove('open');document.body.classList.remove('bkv-on')}

  if(typeof document!=='undefined')document.addEventListener('click',e=>{
    const u=e.target.closest('[data-bk-up]');if(u){e.preventDefault();delete busy[u.dataset.bkUp];upload(u.dataset.bkUp);return}
    const o=e.target.closest('[data-bk-open]'),a=e.target.closest('[data-bk-add]'),d=e.target.closest('[data-bk-del]');
    if(o){e.preventDefault();const [t,doc,p]=o.dataset.bkOpen.split(':');open(t+':'+doc,p?+p:0)}   // no page: back where you left off
    else if(a){e.preventDefault();pick(a.dataset.bkAdd,a.dataset.bkThen)}
    else if(d){e.preventDefault();remove(d.dataset.bkDel)}
  });
  ready.then(()=>{if(has.size&&/^#\/(t|s)\/(pc|wh)/.test(location.hash||''))refresh();if(code())loadCloud()});   // stored files load after the first render
  return{lessonBar,chapterCard,ready,DATA,has};
})();
