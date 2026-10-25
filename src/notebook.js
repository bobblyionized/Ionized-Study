/* ---------- Notebook: Kindle Scribe-style notebooks in folders, saved to the sync code ----------
   cloud  /codes/<code>/nb/lib/f/<id>   folder    {n name, par parent folder, at, del?}
          /codes/<code>/nb/lib/b/<id>   notebook  {n, par, tpl, pages:[pageId], at, del?}
          /codes/<code>/nb/lib/p/<id>   page stamp {b notebook, at, sz stored size, del?}
          /codes/<code>/nb/pg/<id>      the page itself, one JSON string {h, tpl, items}
   local  IndexedDB 'ionized-notes', one namespace per code ('local' before a code is set up).
   Newer 'at' wins when two copies differ; deletes are kept as {del:1} so every device sees them. */
const NOTEBOOK=(()=>{
  const FB='https://ionized-study-and-shi-default-rtdb.firebaseio.com';
  const W=1000,SH=1333,MAXH=12;                          // page width in page units; one screen of height (3:4, like the Scribe)
  const TPL=[['blank','Blank'],['lined','Lined'],['grid','Grid'],['dots','Dots']];
  const TOOLS=[['move','Select and move'],['pen','Pen'],['mark','Marker'],['hl','Highlighter'],['erase','Eraser'],['lasso','Lasso select'],['text','Text']];
  const SIZES={pen:[2.2,3.6,6],mark:[5,9,15],hl:[16,26,38],erase:[10,20,38],text:[24,32,46]};
  const INKS=['#111111','#5b6170','#2f5bd3','#d23b3b','#1f8a4c'],HLS=['#ffe14d','#7cf0a0','#7cc8ff','#ff9ad5'];
  const FONT='"Instrument Sans",system-ui,-apple-system,"Segoe UI",sans-serif';
  const code=()=>typeof SYNC!=='undefined'?SYNC.code:null;
  const H=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let lastAt=0;const stamp=()=>lastAt=Math.max(Date.now(),lastAt+1);
  const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
  const ls=(k,v)=>{try{if(v===undefined)return localStorage.getItem('amcprep.nb.'+k);localStorage.setItem('amcprep.nb.'+k,v)}catch(e){return null}};
  const live=o=>!!o&&!o.del;

  /* ---------- local store ---------- */
  let dbp=null;
  const db=()=>dbp||(dbp=new Promise((ok,no)=>{if(typeof indexedDB==='undefined')return no(new Error('no IndexedDB'));
    const r=indexedDB.open('ionized-notes',1);r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)}));
  const tx=(mode,fn)=>db().then(d=>new Promise((ok,no)=>{const t=d.transaction('kv',mode),q=fn(t.objectStore('kv'));t.oncomplete=()=>ok(q&&q.result);t.onerror=()=>no(t.error)}));
  const iget=k=>tx('readonly',st=>st.get(k)).catch(()=>undefined);
  const iput=(k,v)=>tx('readwrite',st=>st.put(v,k)).catch(()=>{});
  const idel=k=>tx('readwrite',st=>st.delete(k)).catch(()=>{});
  const ikeys=pre=>tx('readonly',st=>st.getAllKeys()).then(a=>(a||[]).filter(k=>String(k).startsWith(pre))).catch(()=>[]);

  /* points are stored as whole-number steps from the previous point, which keeps pages small */
  function encP(p){const o=[];let a=0,b=0,c=0;for(let i=0;i<p.length;i+=3){const x=Math.round(p[i]*10),y=Math.round(p[i+1]*10),z=Math.round(p[i+2]*100);o.push(x-a,y-b,z-c);a=x;b=y;c=z}return o.join(',')}
  function decP(s){const v=s?String(s).split(',').map(Number):[],o=[];let a=0,b=0,c=0;for(let i=0;i+2<v.length;i+=3){a+=v[i];b+=v[i+1];c+=v[i+2];o.push(a/10,b/10,c/100)}return o}
  const pack=pg=>JSON.stringify({h:pg.h,tpl:pg.tpl,items:pg.items.map(it=>it.k==='s'?Object.assign({},it,{p:encP(it.p)}):it)});
  function unpack(s){try{const o=JSON.parse(s);return{h:o.h||1,tpl:o.tpl||'blank',items:(o.items||[]).map(it=>it.k==='s'?Object.assign({},it,{p:decP(it.p)}):it)}}
    catch(e){return{h:1,tpl:'blank',items:[]}}}

  /* ---------- library state ---------- */
  const norm=l=>{l=l||{};return{f:l.f||{},b:l.b||{},p:l.p||{}}};
  let ns=null,lib=norm();const pages={};                 // pageId -> {h,tpl,items,_at,_dirty} for pages opened this visit
  const dirty={lib:new Set(),pg:new Set()};
  let state='';                                          // '' | 'up' | 'ok' | 'off'
  let libT=null;const saveLib=()=>{clearTimeout(libT);const n=ns,l=lib;libT=setTimeout(()=>iput(n+'|lib',l),150)};
  function mark(kind,id){dirty.lib.add(kind+'/'+id);if(kind==='p')dirty.pg.add(id);saveLib();schedulePush()}

  async function loadNs(){const n=code()||'local';if(n===ns)return;
    if(ns)await flushLocal();
    if(n!=='local'){const loc=await iget('local|lib');if(loc&&Object.keys(norm(loc).b).length)await adopt(norm(loc),n)}
    ns=n;lib=norm(await iget(ns+'|lib'));for(const k in pages)delete pages[k];dirty.lib.clear();dirty.pg.clear();
    if(ns!=='local')for(const kind of ['f','b','p'])for(const id in lib[kind])if(lib[kind][id]._new){delete lib[kind][id]._new;dirty.lib.add(kind+'/'+id);if(kind==='p')dirty.pg.add(id)}
  }
  async function adopt(loc,n){                          // notebooks made before a code was set up move into that code
    const tgt=norm(await iget(n+'|lib'));
    for(const kind of ['f','b','p'])for(const id in loc[kind]){const r=loc[kind][id];if(!tgt[kind][id]||tgt[kind][id].at<r.at)tgt[kind][id]=Object.assign({},r,{_new:1})}
    for(const k of await ikeys('local|pg|')){const v=await iget(k);if(v)await iput(n+'|pg|'+k.slice(9),v);await idel(k)}
    await iput(n+'|lib',tgt);await idel('local|lib');
  }

  /* ---------- cloud ---------- */
  async function rest(path,method,body){const c=code();if(!c)throw new Error('no code');
    const r=await fetch(`${FB}/codes/${c}/nb${path?'/'+path:''}.json`,{method:method||'GET',cache:'no-store',
      headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
    if(!r.ok)throw new Error('HTTP '+r.status);return r.json()}
  async function pull(){const c=code();if(!c||ns!==c)return null;
    let cl;try{cl=norm(await rest('lib'))}catch(e){setState('off');return null}
    if(code()!==c||ns!==c)return null;
    let changed=false;const remote=new Set();
    for(const kind of ['f','b','p']){const L=lib[kind],C=cl[kind];
      for(const id of new Set([...Object.keys(L),...Object.keys(C)])){const l=L[id],r=C[id];
        if(r&&(!l||r.at>l.at)){L[id]=r;changed=true;
          if(kind==='p'){if(r.del){delete pages[id];idel(ns+'|pg|'+id)}else remote.add(id)}}
        else if(l&&(!r||l.at>r.at)){dirty.lib.add(kind+'/'+id);if(kind==='p')dirty.pg.add(id)}}}
    if(changed)saveLib();if(dirty.lib.size)schedulePush(50);else if(!pushing)setState('ok');
    return{changed,remote}}
  let pushT=null,pushing=false;
  function schedulePush(ms){if(!code()||ns!==code())return setState('');setState('up');clearTimeout(pushT);pushT=setTimeout(push,ms==null?1200:ms)}
  async function push(){if(pushing){schedulePush(400);return}const c=code();if(!c||ns!==c)return;
    const L=[...dirty.lib],P=[...dirty.pg];if(!L.length&&!P.length)return setState('ok');
    dirty.lib.clear();dirty.pg.clear();pushing=true;setState('up');
    try{const up={};
      for(const pid of P){const m=lib.p[pid];if(!live(m)){up['pg/'+pid]=null;continue}
        const rec=await iget(ns+'|pg|'+pid);if(rec)up['pg/'+pid]=rec.s}          // not written here yet: flushLocal queues it again
      for(const k of L){const [kind,id]=k.split('/'),r=lib[kind][id];if(r)up['lib/'+kind+'/'+id]=r}
      if(Object.keys(up).length)await rest('','PATCH',up);   // one atomic multi-path write
      pushing=false;if(dirty.lib.size||dirty.pg.size)schedulePush(300);else setState('ok');
    }catch(e){pushing=false;L.forEach(k=>dirty.lib.add(k));P.forEach(p=>dirty.pg.add(p));setState('off')}}
  let es=null,esFor=null;
  function listen(){const c=code();if(esFor===c)return;if(es){es.close();es=null}esFor=c;if(!c||typeof EventSource==='undefined')return;
    es=new EventSource(`${FB}/codes/${c}/nb/lib.json`);let t;            // only the small library index, never the pages
    const on=()=>{clearTimeout(t);t=setTimeout(remoteChanged,350)};es.addEventListener('put',on);es.addEventListener('patch',on)}
  async function remoteChanged(){await ready;const r=await pull();if(!r||!r.changed)return;
    if(E){if(!live(lib.b[E.bid]))return closeEditor(true);
      const pid=E.book().pages[E.i];if(r.remote.has(pid)&&!(pages[pid]&&pages[pid]._dirty)){delete pages[pid];gotoPage(Math.min(E.i,E.book().pages.length-1),true)}else paintBar()}
    else if(libVisible())renderLib()}

  /* ---------- pages ---------- */
  async function getPage(pid){const m=lib.p[pid];if(pages[pid]&&(pages[pid]._dirty||pages[pid]._at>=(m?m.at:0)))return pages[pid];
    let rec=await iget(ns+'|pg|'+pid);
    if(live(m)&&(!rec||rec.at<m.at)&&code()){try{const s=await rest('pg/'+pid);if(typeof s==='string'){rec={at:m.at,s};iput(ns+'|pg|'+pid,rec)}}catch(e){}}
    if(pages[pid]&&pages[pid]._dirty)return pages[pid];
    const b=m&&lib.b[m.b];const pg=rec?unpack(rec.s):{h:1,tpl:b&&b.tpl||'blank',items:[]};pg._at=rec?rec.at:0;return pages[pid]=pg}
  let saveT=null;
  function touchPage(pid){const pg=pages[pid],m=lib.p[pid];if(!pg||!m)return;pg._at=m.at=stamp();pg._dirty=true;clearTimeout(saveT);saveT=setTimeout(flushLocal,500)}
  async function flushLocal(){clearTimeout(saveT);const n=ns;
    for(const pid in pages){const pg=pages[pid];if(!pg._dirty)continue;pg._dirty=false;const s=pack(pg);
      if(lib.p[pid])lib.p[pid].sz=s.length;await iput(n+'|pg|'+pid,{at:pg._at,s});if(n===ns){dirty.lib.add('p/'+pid);dirty.pg.add(pid)}}
    saveLib();if(dirty.lib.size)schedulePush()}
  function newPage(bid,tpl,at){const pid=uid();lib.p[pid]={b:bid,at,sz:0};pages[pid]={h:1,tpl,items:[],_at:at,_dirty:true};return pid}

  /* ---------- library actions ---------- */
  function addFolder(name,par){const id=uid();lib.f[id]={n:name,par,at:stamp()};mark('f',id);return id}
  function addBook(name,par,tpl){const id=uid(),at=stamp(),pid=newPage(id,tpl,at);lib.b[id]={n:name,par,tpl,pages:[pid],at};
    mark('b',id);mark('p',pid);flushLocal();return id}
  function setRec(kind,id,ch){const r=lib[kind][id];if(!live(r))return;Object.assign(r,ch,{at:stamp()});mark(kind,id)}
  function killBook(id){const b=lib.b[id];if(!b)return;for(const pid of b.pages||[]){lib.p[pid]={b:id,del:1,at:stamp()};delete pages[pid];idel(ns+'|pg|'+pid);mark('p',pid)}
    lib.b[id]={del:1,at:stamp()};mark('b',id)}
  function killFolder(id){for(const k in lib.f)if(live(lib.f[k])&&lib.f[k].par===id)killFolder(k);
    for(const k in lib.b)if(live(lib.b[k])&&lib.b[k].par===id)killBook(k);lib.f[id]={del:1,at:stamp()};mark('f',id)}
  async function dupBook(id){const b=lib.b[id];const nid=uid(),at=stamp(),ids=[];
    for(const pid of b.pages||[]){const pg=await getPage(pid);const np=newPage(nid,pg.tpl,at);Object.assign(pages[np],{h:pg.h,items:pg.items.slice()});ids.push(np);mark('p',np)}
    lib.b[nid]={n:b.n+' (copy)',par:b.par,tpl:b.tpl,pages:ids,at};mark('b',nid);await flushLocal()}
  const inside=(fid,anc)=>{for(let f=fid;f;f=(lib.f[f]||{}).par)if(f===anc)return true;return false};
  function bookEdited(b){let t=b.at;for(const pid of b.pages||[]){const m=lib.p[pid];if(m&&m.at>t)t=m.at}return t}
  function folderEdited(id){let t=lib.f[id].at;for(const k in lib.f)if(live(lib.f[k])&&lib.f[k].par===id)t=Math.max(t,folderEdited(k));
    for(const k in lib.b)if(live(lib.b[k])&&lib.b[k].par===id)t=Math.max(t,bookEdited(lib.b[k]));return t}
  function usedBytes(){let n=0;for(const pid in lib.p){const m=lib.p[pid];if(live(m))n+=m.sz||0}return n}

  /* ---------- drawing a page ---------- */
  function drawTpl(ctx,tpl,s,h){ctx.fillStyle='#fff';ctx.fillRect(0,0,W*s,h*SH*s);if(tpl==='blank')return;
    const G=40,bottom=h*SH;ctx.save();ctx.strokeStyle='#cfd8ea';ctx.fillStyle='#aab5cc';ctx.lineWidth=Math.max(.5,1.1*s);ctx.beginPath();
    if(tpl==='lined'){for(let y=110;y<bottom;y+=G){ctx.moveTo(0,y*s);ctx.lineTo(W*s,y*s)}ctx.stroke();
      ctx.strokeStyle='#f1b9b9';ctx.beginPath();ctx.moveTo(90*s,0);ctx.lineTo(90*s,bottom*s);ctx.stroke()}
    else if(tpl==='grid'){for(let y=G;y<bottom;y+=G){ctx.moveTo(0,y*s);ctx.lineTo(W*s,y*s)}for(let x=G;x<W;x+=G){ctx.moveTo(x*s,0);ctx.lineTo(x*s,bottom*s)}ctx.stroke()}
    else if(tpl==='dots'){const r=Math.max(.6,1.5*s);for(let y=G;y<bottom;y+=G)for(let x=G;x<W;x+=G)ctx.fillRect(x*s-r,y*s-r,2*r,2*r)}
    ctx.restore()}
  let mctx=null;const measure=()=>mctx||(mctx=document.createElement('canvas').getContext('2d'));
  function textLines(ctx,it,s){ctx.font=`${it.z*s}px ${FONT}`;const out=[];
    for(const para of String(it.v).split('\n')){let line='';
      for(const w of para.split(/(\s+)/)){const t=line+w;if(line.trim()&&ctx.measureText(t).width>it.w*s){out.push(line.trimEnd());line=w.trimStart()}else line=t}
      out.push(line)}return out}
  function drawItem(ctx,it,s,live){
    if(it.k==='m'){if(live)return;ctx.save();ctx.fillStyle=it.c;ctx.textBaseline='top';ctx.font=`${it.z*s}px ${FONT}`;ctx.fillText(plainTex(it.v),it.x*s,(it.y+it.z*.1)*s);ctx.restore();return}
    if(it.k==='x'){ctx.save();ctx.fillStyle=it.c;ctx.textBaseline='middle';textLines(ctx,it,s).forEach((l,i)=>ctx.fillText(l,it.x*s,(it.y+(i+.5)*it.z*1.3)*s));ctx.restore();return}
    const p=it.p,n=p.length/3;if(!n)return;ctx.save();ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle=it.c;
    if(it.t==='hl'){ctx.globalAlpha=.38;ctx.globalCompositeOperation='multiply'}
    if(it.t!=='pen'||n<3){ctx.lineWidth=it.w*s*(it.t==='pen'?.35+.9*p[2]:1);ctx.beginPath();ctx.moveTo(p[0]*s,p[1]*s);
      if(n===1)ctx.lineTo(p[0]*s+.01,p[1]*s);
      else{for(let i=1;i<n-1;i++)ctx.quadraticCurveTo(p[3*i]*s,p[3*i+1]*s,(p[3*i]+p[3*i+3])/2*s,(p[3*i+1]+p[3*i+4])/2*s);ctx.lineTo(p[3*n-3]*s,p[3*n-2]*s)}
      ctx.stroke();ctx.restore();return}
    let ax=p[0],ay=p[1];                                  // pen: the line gets thicker as you press harder
    for(let i=1;i<n;i++){const x=p[3*i],y=p[3*i+1],last=i===n-1,ex=last?x:(x+p[3*i+3])/2,ey=last?y:(y+p[3*i+4])/2;
      ctx.beginPath();ctx.moveTo(ax*s,ay*s);ctx.quadraticCurveTo(x*s,y*s,ex*s,ey*s);ctx.lineWidth=it.w*s*(.35+.9*(p[3*i-1]+p[3*i+2])/2);ctx.stroke();ax=ex;ay=ey}
    ctx.restore()}
  function drawPage(ctx,pg,s,h,seams){drawTpl(ctx,pg.tpl,s,h);
    if(seams&&pg.h>1){ctx.save();ctx.strokeStyle='#dfe4ee';ctx.setLineDash([6,6]);ctx.lineWidth=1;ctx.beginPath();for(let k=1;k<pg.h;k++){ctx.moveTo(0,k*SH*s);ctx.lineTo(W*s,k*SH*s)}ctx.stroke();ctx.restore()}
    for(const it of pg.items)drawItem(ctx,it,s,seams)}
  function bbox(it){if(it.k==='m')return[it.x,it.y,it.x+(it.bw||String(it.v).length*it.z*.45),it.y+(it.bh||it.z*1.4)];
    if(it.k==='x'){const c=measure(),L=textLines(c,it,1);let mw=10;for(const l of L)mw=Math.max(mw,c.measureText(l).width);return[it.x,it.y,it.x+mw,it.y+L.length*it.z*1.3]}
    let a=1e9,b=1e9,c=-1e9,d=-1e9;const p=it.p,r=it.w/2;for(let i=0;i<p.length;i+=3){a=Math.min(a,p[i]);b=Math.min(b,p[i+1]);c=Math.max(c,p[i]);d=Math.max(d,p[i+1])}return[a-r,b-r,c+r,d+r]}
  function thumb(cv,pg){const w=cv.clientWidth||150,hh=Math.round(w*SH/W),dpr=Math.min(2,window.devicePixelRatio||1);
    cv.width=w*dpr;cv.height=hh*dpr;const ctx=cv.getContext('2d');ctx.scale(dpr,dpr);drawPage(ctx,pg,w/W,1)}

  /* ---------- small dialogs ---------- */
  function dlg(title,inner,okLabel,onOk){
    const d=document.createElement('div');d.className='nb-dlg nb';
    d.innerHTML=`<form class="nb-dlg-box card"><h3>${H(title)}</h3>${inner}<div class="row nb-dlg-row"><span class="spacer"></span><button type="button" class="btn" data-x>Cancel</button><button class="btn pri">${H(okLabel)}</button></div></form>`;
    document.body.appendChild(d);const f=d.querySelector('form'),done=()=>d.remove();
    d.addEventListener('click',e=>{if(e.target===d||e.target.closest('[data-x]'))done()});
    f.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();done()}});
    f.onsubmit=e=>{e.preventDefault();if(onOk(f)!==false)done()};
    const inp=f.querySelector('input[type=text]');setTimeout(()=>{if(inp){inp.focus();inp.select()}},30);return d}
  const nameField=(v,ph)=>`<input type="text" class="nb-in" name="n" maxlength="80" value="${H(v||'')}" placeholder="${H(ph||'Name')}" autocomplete="off">`;
  const tplField=cur=>`<div class="nb-tpls">${TPL.map(([k,n])=>`<label class="nb-tpl"><input type="radio" name="tpl" value="${k}" ${k===cur?'checked':''}><canvas data-tpl="${k}" width="60" height="80"></canvas><span>${n}</span></label>`).join('')}</div>`;
  function tplPreviews(root){root.querySelectorAll('canvas[data-tpl]').forEach(cv=>{const ctx=cv.getContext('2d');drawTpl(ctx,cv.dataset.tpl,cv.width/W*1.6,1)})}
  function askName(title,v,ok,cb,ph){dlg(title,nameField(v,ph),ok,f=>{const n=f.n.value.trim();if(!n){f.n.focus();return false}cb(n)})}
  function folderPicker(title,kind,id,cb){
    const opts=[['','Notebook (top level)',0]];const walk=(par,dep)=>{Object.keys(lib.f).filter(k=>live(lib.f[k])&&(lib.f[k].par||'')===par)
      .sort((a,b)=>lib.f[a].n.localeCompare(lib.f[b].n)).forEach(k=>{if(kind==='f'&&inside(k,id))return;opts.push([k,lib.f[k].n,dep]);walk(k,dep+1)})};walk('',1);
    const cur=(lib[kind][id]||{}).par||'';
    dlg(title,`<div class="nb-pick">${opts.map(([k,n,dep])=>`<label style="padding-left:${10+dep*16}px"><input type="radio" name="to" value="${k}" ${k===cur?'checked':''}> ${dep?'📁 ':''}${H(n)}</label>`).join('')}</div>`,'Move',f=>cb(f.to.value))}
  let menuEl=null;
  function menu(anchor,items){closeMenu();const m=document.createElement('div');m.className='nb-menu nb';
    m.innerHTML=items.map((it,i)=>it?`<button type="button" data-i="${i}" class="${it[2]||''}">${it[0]}</button>`:'<hr>').join('');document.body.appendChild(m);
    const r=anchor.getBoundingClientRect(),mw=m.offsetWidth,mh=m.offsetHeight;
    m.style.left=Math.max(8,Math.min(innerWidth-mw-8,r.right-mw))+'px';m.style.top=(r.bottom+mh+8>innerHeight?Math.max(8,r.top-mh-4):r.bottom+4)+'px';
    m.addEventListener('click',e=>{const b=e.target.closest('[data-i]');if(!b)return;closeMenu();items[+b.dataset.i][1]()});menuEl=m}
  function closeMenu(){if(menuEl){menuEl.remove();menuEl=null}}

  /* ---------- library page ---------- */
  let here=ls('here')||'',sortBy=ls('sort')||'recent',query='',libBody=null,libSid=null;
  const libVisible=()=>libBody&&document.body.contains(libBody)&&!E;
  function view(body,sid){libBody=body;libSid=sid||null;body.innerHTML='<div class="nb nb-lib"><p class="meta">Opening your notebooks…</p></div>';
    ready.then(()=>{if(libBody!==body)return;renderLib();pull().then(r=>{if(r&&r.changed&&libVisible())renderLib()})})}
  const ago=t=>{const d=(Date.now()-t)/1000;if(d<60)return'just now';if(d<3600)return Math.floor(d/60)+' min ago';if(d<86400)return Math.floor(d/3600)+' h ago';
    if(d<86400*7)return Math.floor(d/86400)+' d ago';return new Date(t).toLocaleDateString(undefined,{month:'short',day:'numeric'})};
  const mb=n=>n<1048576?(n/1024).toFixed(n<10240?1:0)+' KB':(n/1048576).toFixed(1)+' MB';
  function stText(){const c=code();
    if(!c)return'Only on this device. Set up a sync code to save your notebooks to every device that uses it.';
    if(state==='off')return'Offline. Changes are kept on this device and upload when you reconnect.';
    if(state==='up')return'Saving to your code…';
    return'Saved to your code · '+mb(usedBytes())+' used'}
  function setState(s){state=s;document.querySelectorAll('.nb-status').forEach(el=>{el.textContent=stText();el.dataset.st=s||'local'})}
  const FOLDER_SVG='<svg viewBox="0 0 48 40" aria-hidden="true"><path d="M4 8a4 4 0 0 1 4-4h11l5 5h16a4 4 0 0 1 4 4v19a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z" fill="currentColor" opacity=".18"/><path d="M4 14h40v18a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z" fill="currentColor" opacity=".32"/></svg>';
  function renderLib(){if(!libBody||!document.body.contains(libBody))return;
    if(here&&!live(lib.f[here]))here='';
    const q=query.trim().toLowerCase();let F=[],B=[];
    for(const id in lib.f){const f=lib.f[id];if(live(f)&&(q?f.n.toLowerCase().includes(q):(f.par||'')===here))F.push([id,f,folderEdited(id)])}
    for(const id in lib.b){const b=lib.b[id];if(live(b)&&(q?b.n.toLowerCase().includes(q):(b.par||'')===here))B.push([id,b,bookEdited(b)])}
    const srt=a=>a.sort(sortBy==='name'?(x,y)=>x[1].n.localeCompare(y[1].n,undefined,{numeric:true}):(x,y)=>y[2]-x[2]);srt(F);srt(B);
    const crumbs=[['','Notebook']];for(let f=here;f;f=lib.f[f]&&lib.f[f].par)if(lib.f[f])crumbs.splice(1,0,[f,lib.f[f].n]);
    const count=id=>{let n=0;for(const k in lib.f)if(live(lib.f[k])&&lib.f[k].par===id)n++;for(const k in lib.b)if(live(lib.b[k])&&lib.b[k].par===id)n++;return n};
    libBody.innerHTML=`<div class="nb nb-lib">
      <div class="nb-head"><nav class="nb-crumbs">${q?'<span>Search results</span>':crumbs.map(([id,n],i)=>i<crumbs.length-1?`<button type="button" data-go="${id}">${H(n)}</button><span class="nb-sep">›</span>`:`<span>${H(n)}</span>`).join('')}</nav>
        <span class="spacer"></span><button class="btn sm" data-nb="folder">＋ Folder</button><button class="btn pri sm" data-nb="book">＋ Notebook</button></div>
      <div class="nb-tools"><input type="search" class="nb-in nb-q" placeholder="Search notebooks" value="${H(query)}" aria-label="Search notebooks">
        <span class="spacer"></span><button class="chip ${sortBy==='recent'?'on':''}" data-sort="recent">Recent</button><button class="chip ${sortBy==='name'?'on':''}" data-sort="name">Name</button></div>
      ${F.length+B.length?`<div class="nb-grid">${F.map(([id,f])=>`<div class="nb-tile nb-folder" data-open-f="${id}" tabindex="0" role="button">
          <div class="nb-cover nb-fcover">${FOLDER_SVG}</div><div class="nb-tname">${H(f.n)}</div><div class="nb-tmeta">${count(id)} item${count(id)===1?'':'s'}</div>
          <button type="button" class="nb-more" data-more="f:${id}" aria-label="Folder options">⋯</button></div>`).join('')}
        ${B.map(([id,b,t])=>`<div class="nb-tile nb-book" data-open-b="${id}" tabindex="0" role="button">
          <div class="nb-cover"><canvas data-thumb="${id}"></canvas></div><div class="nb-tname">${H(b.n)}</div><div class="nb-tmeta">${(b.pages||[]).length} page${(b.pages||[]).length===1?'':'s'} · ${ago(t)}</div>
          <button type="button" class="nb-more" data-more="b:${id}" aria-label="Notebook options">⋯</button></div>`).join('')}</div>`
        :`<div class="nb-empty">${q?'No notebooks match that search.':here?'This folder is empty. Add a notebook or a folder.':'Make a notebook to work problems by hand: write with a pen or stylus, highlight, type, and add as many pages as you need. Group notebooks into folders. Everything saves to your sync code.'}</div>`}
      <p class="nb-status meta" data-st="${state||'local'}">${stText()}</p></div>`;
    libBody.querySelectorAll('canvas[data-thumb]').forEach(cv=>{const b=lib.b[cv.dataset.thumb],pid=(b.pages||[])[0];if(pid)getPage(pid).then(pg=>{if(cv.isConnected)thumb(cv,pg)})})}
  function libClick(e){
    if(!libBody||!libBody.contains(e.target))return;
    const more=e.target.closest('[data-more]');if(more){e.stopPropagation();const [kind,id]=more.dataset.more.split(':');return tileMenu(more,kind,id)}
    const go=e.target.closest('[data-go]');if(go){here=go.dataset.go;ls('here',here);return renderLib()}
    const so=e.target.closest('[data-sort]');if(so){sortBy=so.dataset.sort;ls('sort',sortBy);return renderLib()}
    const nb=e.target.closest('[data-nb]');
    if(nb&&nb.dataset.nb==='folder')return askName('New folder','','Create',n=>{addFolder(n,here);renderLib()},'Folder name');
    if(nb&&nb.dataset.nb==='book'){const s=libSid&&typeof subById==='function'&&subById(libSid);
      const d=dlg('New notebook',nameField(s?s.name:'','Notebook name')+'<div class="meta" style="margin:12px 0 6px">Paper</div>'+tplField(ls('tpl')||'lined'),'Create',f=>{
        const n=f.n.value.trim();if(!n){f.n.focus();return false}const tpl=f.tpl.value||'blank';ls('tpl',tpl);const id=addBook(n,here,tpl);renderLib();openBook(id)});tplPreviews(d);return}
    const fo=e.target.closest('[data-open-f]');if(fo){here=fo.dataset.openF;query='';ls('here',here);return renderLib()}
    const bo=e.target.closest('[data-open-b]');if(bo)return openBook(bo.dataset.openB)}
  function tileMenu(btn,kind,id){const r=lib[kind][id];if(!live(r))return;
    const items=[['Open',()=>kind==='f'?(here=id,query='',ls('here',here),renderLib()):openBook(id)],
      ['Rename',()=>askName(kind==='f'?'Rename folder':'Rename notebook',r.n,'Rename',n=>{setRec(kind,id,{n});renderLib()})],
      ['Move to…',()=>folderPicker('Move “'+r.n+'” to',kind,id,to=>{setRec(kind,id,{par:to});renderLib()})]];
    if(kind==='b')items.push(['Duplicate',()=>dupBook(id).then(renderLib)]);
    items.push(null,['Delete',()=>{const msg=kind==='f'?`Delete the folder “${r.n}” and everything in it?`:`Delete the notebook “${r.n}”?`;
      if(!confirm(msg+' This removes it from every device that uses your code.'))return;kind==='f'?killFolder(id):killBook(id);renderLib()},'danger']);
    menu(btn,items)}

  /* ---------- the editor ---------- */
  let E=null;
  let tool=ls('tool')||'pen';if(!SIZES[tool]&&tool!=='lasso'&&tool!=='move')tool='pen';
  let pref={};try{pref=JSON.parse(ls('pref')||'{}')||{}}catch(e){}const size=t=>(pref['s_'+t]==null?1:pref['s_'+t]);
  const color=t=>pref['c_'+t]||(t==='hl'?HLS[0]:INKS[0]);const savePref=()=>ls('pref',JSON.stringify(pref));
  let penSeen=ls('pen')==='1',fingerDraw=ls('finger')!=='0',fit=ls('fit')||'width';
  const fingerScrolls=()=>penSeen&&!fingerDraw;
  const ICON={move:'<path d="M6 3l12 8.5-5.2 1.2 3 5.8-2.4 1.2-3-5.8L6 18z"/>',pen:'<path d="M4 20l4-1 11-11-3-3L5 16z"/><path d="M14 6l3 3"/>',mark:'<path d="M5 19l3-1 10-10-3-3L5 15z" stroke-width="3.2"/>',
    hl:'<path d="M9 15l-3 5h6l1-2"/><path d="M8 13l8-9 4 4-9 8z"/>',erase:'<path d="M8 20h11"/><path d="M4 15l9-9 6 6-8 8H8z"/>',
    lasso:'<ellipse cx="12" cy="10" rx="8" ry="5.5" stroke-dasharray="3 2.4"/><path d="M8 15c-1 2 0 4 2 4"/>',text:'<path d="M5 6V4h14v2M12 4v16M9 20h6"/>',
    undo:'<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',redo:'<path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>'};
  const ico=k=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k]}</svg>`;
  function shell(){let el=document.getElementById('nbe');if(el)return el;
    el=document.createElement('div');el.id='nbe';el.className='nbe nb';el.setAttribute('role','dialog');el.setAttribute('aria-label','Notebook');
    el.innerHTML=`<div class="nbe-top">
        <button class="nbe-b nbe-back" data-a="close" aria-label="Back to notebooks"><span>‹</span><span class="nbe-lbl">Notebooks</span></button>
        <button class="nbe-title" data-a="rename" title="Rename notebook"></button><span class="spacer"></span>
        <span class="nbe-saved" aria-live="polite"></span>
        <div class="nbe-grp"><button class="nbe-b" data-a="undo" aria-label="Undo">${ico('undo')}</button><button class="nbe-b" data-a="redo" aria-label="Redo">${ico('redo')}</button></div>
        <div class="nbe-grp nbe-tools">${TOOLS.map(([k,n])=>`<button class="nbe-b" data-tool="${k}" aria-label="${n}" title="${n}">${ico(k)}</button>`).join('')}</div>
        <div class="nbe-grp nbe-opts"></div>
        <button class="nbe-b" data-a="more" aria-label="Page options">⋯</button></div>
      <div class="nbe-body"><div class="nbe-page"><canvas class="nbe-base"></canvas><div class="nbe-mlayer"></div><canvas class="nbe-ink"></canvas>
        <div class="nbe-sel" hidden><div class="nbe-selbar"></div></div></div>
        <button class="nbe-extend" data-a="extend">＋ Extend this page down</button></div>
      <div class="nbe-bot"><button class="nbe-b" data-a="prev" aria-label="Previous page">‹</button><button class="nbe-b nbe-pgno" data-a="grid" aria-label="All pages"></button>
        <button class="nbe-b" data-a="next" aria-label="Next page">›</button><button class="nbe-b nbe-add" data-a="add">＋ Page</button></div>
      <div class="nbe-pages" hidden></div>`;
    document.body.appendChild(el);
    el.addEventListener('click',edClick);
    const ink=el.querySelector('.nbe-ink');
    ink.addEventListener('pointerdown',down);ink.addEventListener('pointermove',move);ink.addEventListener('pointerup',up);ink.addEventListener('pointercancel',cancel);
    ink.addEventListener('contextmenu',e=>e.preventDefault());
    const reopen=e=>{if(!E||(tool!=='move'&&tool!=='lasso'))return;const p=pt(e);const i=E.pg.items.findIndex(it=>it.k!=='s'&&hits(it,p[0],p[1],6));if(i<0)return;
      E.sel=new Set([i]);selAct('edit')};                                       // double-click a text or math box to edit it
    ink.addEventListener('dblclick',reopen);el.querySelector('.nbe-sel').addEventListener('dblclick',reopen);
    const stylus=e=>{for(const t of e.changedTouches)if(t.touchType==='stylus'){e.preventDefault();return}};   // a stylus draws, it never scrolls the page
    ink.addEventListener('touchstart',stylus,{passive:false});ink.addEventListener('touchmove',stylus,{passive:false});
    const sel=el.querySelector('.nbe-sel');sel.addEventListener('pointerdown',selDown);sel.addEventListener('pointermove',selMove);sel.addEventListener('pointerup',selUp);
    el.querySelector('.nbe-body').addEventListener('scroll',()=>{if(E)ls('y:'+E.pid(),Math.round(E.body.scrollTop/E.s))},{passive:true});
    return el}
  async function openBook(bid){const b=lib.b[bid];if(!live(b))return;closeMenu();
    const el=shell();el.classList.add('open');document.body.classList.add('nbe-on');
    E={bid,i:0,el,body:el.querySelector('.nbe-body'),page:el.querySelector('.nbe-page'),base:el.querySelector('.nbe-base'),ink:el.querySelector('.nbe-ink'),
      sel:null,hist:{},s:1,book:()=>lib.b[E.bid],pid:()=>E.book().pages[E.i]};
    const last=+(ls('last:'+bid)||0);paintTools();await gotoPage(Math.min(last,(b.pages||[]).length-1));
  }
  function closeEditor(remote){if(!E)return;commitText();flushLocal();closeMenu();
    E.el.classList.remove('open');E.el.querySelector('.nbe-pages').hidden=true;document.body.classList.remove('nbe-on');E=null;
    if(remote)alert('This notebook was deleted on another device.');if(libBody&&document.body.contains(libBody))renderLib()}
  async function gotoPage(i,keepScroll){if(!E)return;const b=E.book();if(!b.pages||!b.pages.length){b.pages=[newPage(E.bid,b.tpl,stamp())];setRec('b',E.bid,{});mark('p',b.pages[0])}
    commitText();clearSel();i=Math.max(0,Math.min(b.pages.length-1,i));const y=keepScroll?E.body.scrollTop:null;
    E.i=i;ls('last:'+E.bid,i);const pid=b.pages[i];E.pg=await getPage(pid);if(!E||E.pid()!==pid)return;
    if(!E.hist[pid])E.hist[pid]={u:[],r:[]};layout();paintBar();
    E.body.scrollTop=y!=null?y:(+(ls('y:'+pid)||0))*E.s}
  function paintBar(){if(!E)return;const b=E.book(),n=b.pages.length;E.el.querySelector('.nbe-title').textContent=b.n;
    E.el.querySelector('.nbe-pgno').textContent=(E.i+1)+' / '+n;E.el.querySelector('[data-a=prev]').disabled=E.i===0;E.el.querySelector('[data-a=next]').disabled=E.i>=n-1;
    const h=E.hist[E.pid()]||{u:[],r:[]};E.el.querySelector('[data-a=undo]').disabled=!h.u.length;E.el.querySelector('[data-a=redo]').disabled=!h.r.length;
    E.el.querySelector('.nbe-extend').hidden=E.pg.h>=MAXH}
  function paintTools(){if(!E)return;E.el.querySelectorAll('[data-tool]').forEach(b=>b.classList.toggle('on',b.dataset.tool===tool));
    const o=E.el.querySelector('.nbe-opts');const cols=tool==='hl'?HLS:INKS;
    o.innerHTML=(tool==='text'?[['text','Aa','Plain text'],['desmos','x²','Math, typed like Desmos'],['latex','TeX','Math, typed as LaTeX']].map(([k,l,t])=>`<button class="nbe-b nbe-tm ${tmode()===k?'on':''}" data-tm="${k}" title="${t}" aria-label="${t}">${l}</button>`).join('')+'<span class="nbe-div"></span>':'')+(SIZES[tool]&&tool!=='erase'?cols.map(c=>`<button class="nbe-sw ${c===color(tool)?'on':''}" data-col="${c}" style="--c:${c}" aria-label="Color ${c}"></button>`).join(''):'')
      +(SIZES[tool]?`<span class="nbe-div"></span>`+[0,1,2].map(k=>`<button class="nbe-b nbe-sz ${k===size(tool)?'on':''}" data-size="${k}" aria-label="${['Thin','Medium','Thick'][k]}"><i style="--d:${[4,8,13][k]}px"></i></button>`).join(''):'');
    E.ink.style.cursor=inkCursor();E.ink.style.touchAction=fingerScrolls()?'pan-x pan-y':'none'}
  function inkCursor(){                                  // a dot the size and colour of the pen, centred on the point where ink lands
    if(tool==='move')return'default';if(tool==='text')return'text';if(tool==='lasso')return'crosshair';
    const r=Math.max(2,Math.min(60,(tool==='erase'?SIZES.erase[size('erase')]:SIZES[tool][size(tool)]/2)*E.s)),d=Math.ceil(r*2+4),c=d/2;
    const fill=tool==='erase'?'none':color(tool),op=tool==='hl'?.45:1;
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${d}" height="${d}"><circle cx="${c}" cy="${c}" r="${r}" fill="${fill}" fill-opacity="${op}" stroke="${tool==='erase'?'#444':'#fff'}" stroke-width="1"/></svg>`;
    return`url("data:image/svg+xml,${encodeURIComponent(svg)}") ${Math.round(c)} ${Math.round(c)}, crosshair`}
  function layout(){if(!E)return;const bw=E.body.clientWidth-24,bh=E.body.clientHeight-24;
    let w=fit==='page'?Math.min(bw,bh*W/SH):Math.min(bw,900);w=Math.max(240,Math.floor(w));
    const h=Math.round(w*SH/W*E.pg.h);E.s=w/W;
    let dpr=Math.min(window.devicePixelRatio||1,2);dpr=Math.min(dpr,Math.sqrt(16e6/(w*h)));           // phones cap canvas size
    for(const cv of [E.base,E.ink]){cv.width=Math.round(w*dpr);cv.height=Math.round(h*dpr);cv.style.width=w+'px';cv.style.height=h+'px'}
    E.dpr=dpr;E.page.style.width=w+'px';E.page.style.height=h+'px';redraw();clearInk();if(E.sel)showSel();E.ink.style.cursor=inkCursor()}
  function redraw(skip){const ctx=E.base.getContext('2d');ctx.setTransform(E.dpr,0,0,E.dpr,0,0);
    const pg=skip?Object.assign({},E.pg,{items:E.pg.items.map((it,i)=>skip.has(i)?shift(it,E.drag.dx,E.drag.dy):it)}):E.pg;drawPage(ctx,pg,E.s,E.pg.h,true);mathLayer(pg)}
  function inkCtx(){const ctx=E.ink.getContext('2d');ctx.setTransform(E.dpr,0,0,E.dpr,0,0);return ctx}
  function clearInk(){const ctx=E.ink.getContext('2d');ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,E.ink.width,E.ink.height);
    ctx.setTransform(E.dpr,0,0,E.dpr,0,0)}                 // put the screen scale back, or live strokes draw shrunk toward the top-left
  function snap(){const h=E.hist[E.pid()];h.u.push({items:E.pg.items.slice(),h:E.pg.h});if(h.u.length>150)h.u.shift();h.r.length=0}
  function changed(){touchPage(E.pid());paintBar();flashSaved()}
  function undoRedo(redo){const h=E.hist[E.pid()],from=redo?h.r:h.u,to=redo?h.u:h.r;if(!from.length)return;
    to.push({items:E.pg.items.slice(),h:E.pg.h});const s=from.pop();E.pg.items=s.items;const re=s.h!==E.pg.h;E.pg.h=s.h;clearSel();re?layout():redraw();changed()}
  let savedT=null;function flashSaved(){const el=E&&E.el.querySelector('.nbe-saved');if(!el)return;el.textContent='Saving…';clearTimeout(savedT);
    savedT=setTimeout(()=>{el.textContent=code()?(state==='off'?'Offline · saved here':'Saved'):'Saved on this device'},1400)}

  /* pointer input: pen, marker, highlighter, eraser, lasso, text; two fingers scroll */
  let cur=null,raf=0;const touches=new Map();let pan=null;
  const pt=e=>{const r=E.ink.getBoundingClientRect();return[(e.clientX-r.left)/E.s,(e.clientY-r.top)/E.s,e.pointerType==='pen'?(e.pressure||.5):.5]};
  const avg=()=>{let x=0,y=0;for(const [a,b] of touches.values()){x+=a;y+=b}return[x/touches.size,y/touches.size]};
  function down(e){if(!E)return;
    if(e.pointerType==='pen'&&!penSeen){penSeen=true;ls('pen','1');paintTools()}
    if(e.pointerType==='touch'){touches.set(e.pointerId,[e.clientX,e.clientY]);if(fingerScrolls())return;
      if(touches.size>=2){if(cur){cur=null;clearInk();if(E.erased){E.erased=false}}const [x,y]=avg();pan={x,y,t:E.body.scrollTop,l:E.body.scrollLeft};return}}
    if(e.button>0)return;e.preventDefault();try{E.ink.setPointerCapture(e.pointerId)}catch(_){}
    if(E.editing){commitText();return}
    const p=pt(e);clearSel();
    if(tool==='text')return startText(p);
    if(tool==='lasso'){cur={lasso:[p[0],p[1]],id:e.pointerId};return}
    if(tool==='move'){let i=-1;for(let k=E.pg.items.length-1;k>=0;k--)if(hits(E.pg.items[k],p[0],p[1],8)){i=k;break}
      if(i>=0){E.sel=new Set([i]);showSel();E.drag={x:e.clientX,y:e.clientY,dx:0,dy:0,id:e.pointerId};return}     // pick it up and drag
      cur={box:[p[0],p[1]],lasso:[p[0],p[1],p[0],p[1],p[0],p[1],p[0],p[1]],id:e.pointerId};return}            // drag on empty paper: box select
    if(tool==='erase'){cur={erase:true,id:e.pointerId,r:SIZES.erase[size('erase')],snapped:false};eraseAt(p);return}
    cur={id:e.pointerId,it:{k:'s',t:tool,c:color(tool),w:SIZES[tool][size(tool)],p:[+p[0].toFixed(1),+p[1].toFixed(1),+p[2].toFixed(2)]}};frame()}
  function move(e){if(!E)return;
    if(e.pointerType==='touch'&&touches.has(e.pointerId)){touches.set(e.pointerId,[e.clientX,e.clientY]);
      if(pan&&touches.size>=2){const [x,y]=avg();E.body.scrollTop=pan.t-(y-pan.y);E.body.scrollLeft=pan.l-(x-pan.x);return}}
    if(tool==='erase'&&!cur&&e.pointerType!=='touch'){const p=pt(e);const ctx=inkCtx();clearInk();ring(ctx,p,SIZES.erase[size('erase')]);}
    if(E.drag&&E.drag.id===e.pointerId){e.preventDefault();return selMove(e)}
    if(!cur||cur.id!==e.pointerId)return;e.preventDefault();
    if(cur.box){const p=pt(e),[x0,y0]=cur.box;cur.lasso=[x0,y0,p[0],y0,p[0],p[1],x0,p[1]];return frame()}
    const evs=e.getCoalescedEvents?e.getCoalescedEvents():[e];
    for(const ev of (evs.length?evs:[e])){const p=pt(ev);
      if(cur.erase){eraseAt(p);continue}
      if(cur.lasso){cur.lasso.push(p[0],p[1]);continue}
      const a=cur.it.p,n=a.length;if(Math.hypot(p[0]-a[n-3],p[1]-a[n-2])<.8)continue;a.push(+p[0].toFixed(1),+p[1].toFixed(1),+p[2].toFixed(2))}
    frame()}
  function frame(){if(raf)return;raf=requestAnimationFrame(()=>{raf=0;if(!E)return;const ctx=inkCtx();clearInk();if(!cur)return;
    if(cur.it)drawItem(ctx,cur.it,E.s);
    else if(cur.lasso){const l=cur.lasso;ctx.save();ctx.setLineDash([6,5]);ctx.strokeStyle='#5b6cff';ctx.lineWidth=1.4;ctx.fillStyle='rgba(91,108,255,.07)';ctx.beginPath();
      for(let i=0;i<l.length;i+=2)ctx[i?'lineTo':'moveTo'](l[i]*E.s,l[i+1]*E.s);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore()}
    else if(cur.erase&&cur.at)ring(ctx,cur.at,cur.r)})}
  function ring(ctx,p,r){ctx.save();ctx.strokeStyle='rgba(60,70,90,.55)';ctx.lineWidth=1;ctx.beginPath();ctx.arc(p[0]*E.s,p[1]*E.s,r*E.s,0,7);ctx.stroke();ctx.restore()}
  function up(e){if(e.pointerType==='touch'){touches.delete(e.pointerId);if(touches.size<2)pan=null}
    if(E&&E.drag&&E.drag.id===e.pointerId)return selUp(e);
    if(!E||!cur||cur.id!==e.pointerId)return;const c=cur;cur=null;
    if(c.it){snap();E.pg.items.push(c.it);const ctx=E.base.getContext('2d');ctx.setTransform(E.dpr,0,0,E.dpr,0,0);drawItem(ctx,c.it,E.s);clearInk();changed();return}
    if(c.erase){clearInk();if(c.snapped)changed();return}
    if(c.lasso){clearInk();selectLasso(c.lasso)}}
  function cancel(e){touches.delete(e.pointerId);if(touches.size<2)pan=null;if(cur&&cur.id===e.pointerId){if(cur.erase&&cur.snapped)changed();cur=null;clearInk()}}
  function hits(it,x,y,r){const b=bbox(it);if(x<b[0]-r||x>b[2]+r||y<b[1]-r||y>b[3]+r)return false;if(it.k!=='s')return true;
    const p=it.p,rr=r+it.w/2;if(p.length===3)return Math.hypot(p[0]-x,p[1]-y)<=rr;
    for(let i=3;i<p.length;i+=3){const ax=p[i-3],ay=p[i-2],bx=p[i],by=p[i+1],dx=bx-ax,dy=by-ay,l=dx*dx+dy*dy||1;
      const t=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/l));if(Math.hypot(ax+t*dx-x,ay+t*dy-y)<=rr)return true}return false}
  function eraseAt(p){cur.at=p;const r=cur.r;const keep=E.pg.items.filter(it=>!hits(it,p[0],p[1],r));
    if(keep.length!==E.pg.items.length){if(!cur.snapped){snap();cur.snapped=true}E.pg.items=keep;redraw()}frame()}

  /* lasso selection: drag the box to move, or duplicate / delete */
  function inPoly(x,y,l){let c=false;for(let i=0,j=l.length-2;i<l.length;j=i,i+=2){const xi=l[i],yi=l[i+1],xj=l[j],yj=l[j+1];
    if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi||1e-9)+xi)c=!c}return c}
  function selectLasso(l){if(l.length<6)return;const idx=[];
    E.pg.items.forEach((it,i)=>{if(it.k!=='s'){const b=bbox(it);if(inPoly((b[0]+b[2])/2,(b[1]+b[3])/2,l))idx.push(i);return}
      const p=it.p,n=p.length/3,step=Math.max(1,Math.floor(n/24));let k=0,m=0;for(let j=0;j<n;j+=step){m++;if(inPoly(p[3*j],p[3*j+1],l))k++}if(k/m>=.6)idx.push(i)});
    if(idx.length){E.sel=new Set(idx);showSel()}}
  function selBox(){let a=1e9,b=1e9,c=-1e9,d=-1e9;for(const i of E.sel){const x=bbox(E.pg.items[i]);a=Math.min(a,x[0]);b=Math.min(b,x[1]);c=Math.max(c,x[2]);d=Math.max(d,x[3])}return[a,b,c,d]}
  function showSel(){const el=E.el.querySelector('.nbe-sel');if(!E.sel||!E.sel.size){el.hidden=true;return}const [a,b,c,d]=selBox(),s=E.s,pad=8;
    Object.assign(el.style,{left:(a*s-pad)+'px',top:(b*s-pad)+'px',width:((c-a)*s+2*pad)+'px',height:((d-b)*s+2*pad)+'px',transform:''});el.hidden=false;
    el.classList.toggle('nbe-sel-low',b*s<54);
    const one=E.sel.size===1&&E.pg.items[[...E.sel][0]],math=one&&one.k!=='s';
    el.querySelector('.nbe-selbar').innerHTML=(math?'<button type="button" data-s="solve">Solve</button><button type="button" data-s="factor">Factor</button><button type="button" data-s="expand">Expand</button><span class="nbe-selsep"></span>':'')
      +(math?'<button type="button" data-s="edit">Edit</button>':'')+'<button type="button" data-s="dup">Duplicate</button><button type="button" data-s="del">Delete</button>'}
  function clearSel(){if(!E)return;E.sel=null;E.drag=null;E.el.querySelector('.nbe-sel').hidden=true}
  function shift(it,dx,dy){if(it.k!=='s')return Object.assign({},it,{x:+(it.x+dx).toFixed(1),y:+(it.y+dy).toFixed(1)});
    const p=it.p.slice();for(let i=0;i<p.length;i+=3){p[i]=+(p[i]+dx).toFixed(1);p[i+1]=+(p[i+1]+dy).toFixed(1)}return Object.assign({},it,{p})}
  function selDown(e){if(!E||!E.sel||e.target.closest('[data-s]'))return;e.preventDefault();e.stopPropagation();try{e.currentTarget.setPointerCapture(e.pointerId)}catch(_){}
    E.drag={x:e.clientX,y:e.clientY,dx:0,dy:0,id:e.pointerId}}
  function selMove(e){if(!E||!E.drag||E.drag.id!==e.pointerId)return;E.drag.dx=(e.clientX-E.drag.x)/E.s;E.drag.dy=(e.clientY-E.drag.y)/E.s;
    E.el.querySelector('.nbe-sel').style.transform=`translate(${E.drag.dx*E.s}px,${E.drag.dy*E.s}px)`;if(!raf)raf=requestAnimationFrame(()=>{raf=0;if(E&&E.drag)redraw(E.sel)})}
  function selUp(e){if(!E||!E.drag||E.drag.id!==e.pointerId)return;const {dx,dy}=E.drag;E.drag=null;
    if(Math.abs(dx)+Math.abs(dy)>.5){snap();E.pg.items=E.pg.items.map((it,i)=>E.sel.has(i)?shift(it,dx,dy):it);
      const bottom=selBox()[3];if(bottom>E.pg.h*SH-20&&E.pg.h<MAXH){E.pg.h=Math.min(MAXH,Math.ceil((bottom+40)/SH));layout()}else redraw();changed()}
    showSel()}
  function selAct(a){if(!E||!E.sel)return;
    if(a==='solve'||a==='factor'||a==='expand'){const it=E.pg.items[[...E.sel][0]];if(it&&it.k!=='s')runCAS(a,it);return}
    if(a==='edit'){const i=[...E.sel][0],it=E.pg.items[i];clearSel();snap();E.pg.items.splice(i,1);redraw();E.textSnapped=true;return it.k==='m'?startMath(null,it):startText(null,it)}
    snap();
    if(a==='del'){E.pg.items=E.pg.items.filter((_,i)=>!E.sel.has(i));clearSel()}
    else{const add=[...E.sel].map(i=>shift(E.pg.items[i],24,24)),n0=E.pg.items.length;E.pg.items=E.pg.items.concat(add);E.sel=new Set(add.map((_,k)=>n0+k));showSel()}
    redraw();changed()}

  /* typed text boxes: plain text, Desmos-style math (MathQuill: ^ makes a superscript, / a fraction), or raw LaTeX */
  const tmode=()=>pref.tm||'desmos';
  function startText(p,edit){
    if(!edit){const hit=E.pg.items.findIndex(it=>it.k!=='s'&&hits(it,p[0],p[1],4));
      if(hit>=0){const it=E.pg.items[hit];snap();E.pg.items.splice(hit,1);redraw();E.textSnapped=true;return it.k==='m'?startMath(null,it):startText(null,it)}
      E.textSnapped=false;if(tmode()!=='text')return startMath(p)}
    const z=edit?edit.z:SIZES.text[size('text')],c=edit?edit.c:color('text');
    const x=edit?edit.x:p[0],y=edit?edit.y:p[1]-z*.65,w=edit?edit.w:Math.max(120,W-x-30);
    const ta=document.createElement('textarea');ta.className='nbe-txt';ta.value=edit?edit.v:'';ta.rows=1;ta.spellcheck=true;
    Object.assign(ta.style,{left:(x*E.s-1)+'px',top:(y*E.s-1)+'px',width:w*E.s+'px',fontSize:z*E.s+'px',lineHeight:(z*1.3*E.s)+'px',color:c});
    const fitH=()=>{ta.style.height='auto';ta.style.height=ta.scrollHeight+'px'};
    const ed={kind:'x',ta,it:{k:'x',x:+x.toFixed(1),y:+y.toFixed(1),z,c,w}};E.editing=ed;
    ta.addEventListener('input',fitH);ta.addEventListener('blur',()=>setTimeout(()=>{if(E&&E.editing===ed)commitText()},0));
    ta.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape')ta.blur()});
    E.page.appendChild(ta);fitH();setTimeout(()=>ta.focus(),0)}
  let mqP=null;
  const loadJs=src=>new Promise((ok,no)=>{const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=()=>no(new Error('Could not load '+src));document.head.appendChild(s)});
  function loadMQ(){return mqP||(mqP=(async()=>{const l=document.createElement('link');l.rel='stylesheet';l.href='https://cdnjs.cloudflare.com/ajax/libs/mathquill/0.10.1/mathquill.min.css';document.head.appendChild(l);
    if(!window.jQuery)await loadJs('https://cdnjs.cloudflare.com/ajax/libs/jquery/3.7.1/jquery.min.js');
    await loadJs('https://cdnjs.cloudflare.com/ajax/libs/mathquill/0.10.1/mathquill.min.js');return MathQuill.getInterface(2)})().catch(e=>{mqP=null;throw e}))}
  const MQ_CMDS='pi theta sqrt nthroot sum prod int infty alpha beta gamma delta epsilon lambda mu sigma phi omega rho tau degree pm',
    MQ_OPS='sin cos tan sec csc cot arcsin arccos arctan sinh cosh tanh log ln exp lim max min gcd lcm mod det';
  const texOf=ed=>ed.mq?ed.mq.latex():ed.ta?ed.ta.value:ed.latex;
  function startMath(p,edit){const z=edit?edit.z:Math.round(SIZES.text[size('text')]*1.1),c=edit?edit.c:color('text');
    const x=edit?edit.x:p[0],y=edit?edit.y:p[1]-z*.7;
    const box=document.createElement('div');box.className='nbe-mbox';Object.assign(box.style,{left:(x*E.s-9.5)+'px',top:(y*E.s-5.5)+'px',fontSize:z*E.s+'px',color:c});
    box.innerHTML='<div class="nbe-mbar"><button type="button" data-mm="desmos" title="Type like Desmos: ^ for powers, / for fractions, sqrt, pi">Desmos</button><button type="button" data-mm="latex" title="Type LaTeX, e.g. \\frac{1}{2}">LaTeX</button><span class="nbe-selsep"></span><button type="button" data-mm="solve">Solve</button><button type="button" data-mm="factor">Factor</button><button type="button" data-mm="done">Done</button></div><div class="nbe-mfield"></div>';
    E.page.appendChild(box);const field=box.querySelector('.nbe-mfield');
    const ed={kind:'m',box,it:{k:'m',x:+x.toFixed(1),y:+y.toFixed(1),z,c},latex:edit?edit.v:'',mq:null,ta:null};E.editing=ed;
    async function setMode(m){ed.latex=texOf(ed);ed.mq=ed.ta=null;field.innerHTML='';pref.tm=m;savePref();paintTools();
      box.querySelectorAll('[data-mm]').forEach(b=>b.classList.toggle('on',b.dataset.mm===m));
      if(m==='desmos'){let MQ;try{MQ=await loadMQ()}catch(e){alert('The Desmos-style math keyboard could not load (are you offline?). Switching to LaTeX.');return setMode('latex')}
        if(E.editing!==ed)return;const span=document.createElement('span');field.appendChild(span);
        ed.mq=MQ.MathField(span,{spaceBehavesLikeTab:true,leftRightIntoCmdGoes:'up',restrictMismatchedBrackets:true,sumStartsWithNEquals:true,supSubsRequireOperand:true,
          autoCommands:MQ_CMDS,autoOperatorNames:MQ_OPS,handlers:{enter:()=>commitText()}});
        ed.mq.latex(ed.latex);setTimeout(()=>ed.mq&&ed.mq.focus(),0);
        const hid=span.querySelector('textarea');            // phone keyboards that insert text without key presses
        if(hid)hid.addEventListener('input',()=>setTimeout(()=>{if(hid.value&&ed.mq){const v=hid.value;hid.value='';ed.mq.typedText(v)}},0))}
      else{const ta=document.createElement('textarea'),pv=document.createElement('div');ta.className='nbe-mtex';ta.rows=1;ta.spellcheck=false;ta.value=ed.latex;
        ta.placeholder='\\frac{x^2}{3}+\\sqrt{2}';pv.className='nbe-mprev';
        const upd=()=>{pv.innerHTML=katexHTML(ta.value);ta.style.height='auto';ta.style.height=ta.scrollHeight+'px'};
        ta.addEventListener('input',upd);ta.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();commitText()}});
        field.append(ta,pv);ed.ta=ta;upd();setTimeout(()=>ta.focus(),0)}}
    box.addEventListener('click',e=>{const b=e.target.closest('[data-mm]');e.stopPropagation();if(!b)return;const k=b.dataset.mm;if(k==='done')return commitText();
      if(k==='solve'||k==='factor'){const v=texOf(ed).trim();commitText();if(v)runCAS(k,E.pg.items[E.pg.items.length-1]);return}
      setMode(k)});
    box.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape')commitText()});
    box.addEventListener('pointerdown',e=>e.stopPropagation());
    setMode(tmode()==='latex'?'latex':'desmos')}
  function commitText(){if(!E||!E.editing)return;const ed=E.editing;E.editing=null;let it=null;
    if(ed.kind==='x'){const v=ed.ta.value.replace(/\s+$/,'');ed.ta.remove();if(v)it=Object.assign({},ed.it,{v})}
    else{const v=texOf(ed).trim();ed.box.remove();if(v)it=Object.assign({},ed.it,{v})}
    if(it){if(!E.textSnapped)snap();E.pg.items.push(it);redraw();changed()}else if(E.textSnapped){redraw();changed()}E.textSnapped=false}


  /* ---------- Solve / Factor / Expand on a math or text box (nerdamer, loaded the first time it is used) ---------- */
  let casP=null;
  function loadCAS(){return casP||(casP=(async()=>{const b='https://cdn.jsdelivr.net/npm/nerdamer@1.1.13/';
    for(const f of ['nerdamer.core.js','Algebra.js','Calculus.js','Solve.js'])await loadJs(b+f);return window.nerdamer})().catch(e=>{casP=null;throw e}))}
  const CMDS={cdot:'*',times:'*',div:'/',pi:'pi',infty:'Infinity',theta:'theta',alpha:'alpha',beta:'beta',left:'',right:'',quad:' ',qquad:' ',
    le:'<=',leq:'<=',ge:'>=',geq:'>=',ne:'!=',neq:'!='};
  function texToExpr(t){const s=String(t);let i=0;
    const group=()=>{while(s[i]===' ')i++;
      if(s[i]==='{'){let d=0,j=i;for(;j<s.length;j++){if(s[j]==='{')d++;else if(s[j]==='}'&&--d===0)break}const g=s.slice(i+1,j);i=j+1;return g}
      if(s[i]==='\\'){const m=/^\\[a-zA-Z]+/.exec(s.slice(i));if(m){i+=m[0].length;return m[0]}}return s[i++]||''};
    let o='';
    while(i<s.length){const c=s[i];
      const fr=/^\\[dt]?frac/.exec(s.slice(i));if(fr){i+=fr[0].length;const a=group(),b=group();o+=`((${texToExpr(a)})/(${texToExpr(b)}))`;continue}
      if(s.startsWith('\\sqrt',i)){i+=5;let n=null;if(s[i]==='['){const j=s.indexOf(']',i);n=s.slice(i+1,j);i=j+1}const a=group();
        o+=n?`((${texToExpr(a)})^(1/(${texToExpr(n)})))`:`sqrt(${texToExpr(a)})`;continue}
      if(c==='^'){i++;o+=`^(${texToExpr(group())})`;continue}
      if(c==='_'){i++;o+=texToExpr(group()).replace(/\W/g,'');continue}
      if(c==='{'){o+='('+texToExpr(group())+')';continue}
      if(c==='\\'){const m=/^\\([a-zA-Z]+|.)/.exec(s.slice(i));i+=m[0].length;const w=m[1];
        if(w==='operatorname'){o+=group()+' ';continue}
        if(w==='ln'){o+='log';continue}
        if(w==='log'){while(s[i]===' ')i++;if(s[i]==='_'){i++;o+=`(1/log(${texToExpr(group())}))*log`}else o+='(1/log(10))*log';continue}o+=w in CMDS?CMDS[w]:/^[a-zA-Z]+$/.test(w)?w+' ':' ';continue}
      o+=c;i++}
    return o}
  const FUNCS='sqrt|sin|cos|tan|sec|csc|cot|arcsin|arccos|arctan|asin|acos|atan|sinh|cosh|tanh|log|ln|exp|abs';
  function tidy(x){return x.replace(/\s+/g,' ')
    .replace(new RegExp(`\\b(?!(?:${FUNCS})\\b)([a-zA-Z])\\s*\\(`,'g'),'$1*(')     // x(x+1) means x times (x+1)
    .replace(/\)\s*(?=[\w(])/g,')*').replace(/(\d)\s*\(/g,'$1*(').replace(/(\d)\s+(?=\d)/g,'$1').trim()}
  function plainToExpr(v){return String(v).replace(/\blog_?(\d+)\s*\(/g,'(1/LN($1))*LN(').replace(/\blog\b/g,'(1/LN(10))*LN').replace(/\b(ln|LN)\b/g,'log').replace(/×|·/g,'*').replace(/÷/g,'/').replace(/−/g,'-').replace(/√\s*\(/g,'sqrt(').replace(/√\s*(\w+)/g,'sqrt($1)').replace(/π/g,'pi').replace(/\*\*/g,'^')}
  const itemExpr=it=>tidy(it.k==='m'?texToExpr(it.v):plainToExpr(it.v));
  /* exact rational helpers for linear and quadratic equations */
  const gcd=(a,b)=>{a=Math.abs(a);b=Math.abs(b);while(b)[a,b]=[b,a%b];return a||1};
  function rat(sym){const m=/^(-?\d+)(?:\/(\d+))?$/.exec(String(sym).replace(/\s/g,''));if(!m)return null;const n=+m[1],d=+(m[2]||1);
    if(!Number.isSafeInteger(n)||!Number.isSafeInteger(d))return null;const g=gcd(n,d);return[n/g,d/g]}
  const rmul=(a,b)=>{const n=a[0]*b[0],d=a[1]*b[1],g=gcd(n,d);return[n/g,d/g]},rsub=(a,b)=>{const n=a[0]*b[1]-b[0]*a[1],d=a[1]*b[1],g=gcd(n,d);return[n/g,d/g]};
  const rneg=a=>[-a[0],a[1]],rdiv=(a,b)=>rmul(a,b[0]<0?[-b[1],-b[0]]:[b[1],b[0]]);
  const rtex=a=>a[1]===1?String(a[0]):`${a[0]<0?'-':''}\\frac{${Math.abs(a[0])}}{${a[1]}}`;
  function quadRoots(a,b,c){                             // exact roots of a x^2 + b x + c with rational a,b,c
    const D=rsub(rmul(b,b),rmul([4,1],rmul(a,c))),P=rdiv(rneg(b),rmul([2,1],a));if(D[0]===0)return[rtex(P)];
    let k=Math.abs(D[0])*D[1],s=1;for(let f=2;f*f<=k;f++)while(k%(f*f)===0){k/=f*f;s*=f}   // sqrt(|D|) = s*sqrt(k)/D[1]
    const Q=rdiv([s,1],rmul([D[1],1],rmul([2,1],[Math.abs(a[0]),a[1]]))),im=D[0]<0;
    if(k===1&&!im){const r1=rsub(P,rneg(Q)),r2=rsub(P,Q);return[rtex(r1),rtex(r2)]}
    const L=P[1]*Q[1]/gcd(P[1],Q[1]),p=P[0]*L/P[1],q=Q[0]*L/Q[1];
    const rad=(k===1?'':`\\sqrt{${k}}`)+(im?(k===1?'i':'\\,i'):''),qr=(q===1?'':q)+rad;
    if(!p)return[L===1?`\\pm ${qr}`:`\\pm \\frac{${qr}}{${L}}`];const top=`${p} \\pm ${qr}`;return[L===1?top:`\\frac{${top}}{${L}}`]}
  function topFactors(str){const out=[];let d=0,st=0;
    for(let i=0;i<str.length;i++){const ch=str[i];if(ch==='(')d++;else if(ch===')')d--;else if(i&&d===0&&(ch==='+'||ch==='-')&&!/[*^/(e]/.test(str[i-1]))return[str]}
    d=0;for(let i=0;i<=str.length;i++){const ch=str[i];
      if(ch==='(')d++;else if(ch===')')d--;else if((ch==='*'||ch===undefined)&&d===0){out.push(str.slice(st,i));st=i+1}}
    return out.map(f=>f.replace(/^\((.*)\)(\^\d+)?$/,(m,a,p)=>p?a:m).replace(/^\((.*)\)$/,'$1'))}
  function approx(sym){let t;try{t=nerdamer(sym).evaluate().text('decimals')}catch(e){return null}
    const num=x=>{const v=+x;return Math.abs(v)<1e-10?0:+v.toPrecision(6)};
    const m=/^(-?[\d.e+-]+)?\s*([+-])?\s*(?:([\d.e+-]*)\*?i)?$/.exec(t.replace(/\s/g,''));
    if(!/i/.test(t)){const v=num(t);return isFinite(v)?String(v):null}
    if(!m)return null;const re=num(m[1]||0),imv=num((m[2]==='-'?'-':'')+(m[3]||'1'));if(imv===0)return String(re);
    return(re?re+(imv<0?' - ':' + '):(imv<0?'-':''))+(Math.abs(imv)===1?'':Math.abs(imv))+'i'}
  function solveFor(expr,v){                             // roots of expr = 0 as TeX strings; '≈' marks decimals
    const N=nerdamer;let ex;try{ex=N.expand(expr)}catch(e){ex=N(expr)}
    if(ex.symbol.isPoly&&ex.symbol.isPoly()){
      const roots=[];
      for(const f of topFactors(N.factor(ex.toString()).toString())){if(!f.includes(v))continue;
        let cs;try{cs=N.coeffs(N.expand(f),v).toString().replace(/^\[|\]$/g,'').split(',')}catch(e){cs=null}
        const rs=cs&&cs.map(rat);
        if(rs&&rs.every(Boolean)&&rs.length===2)roots.push(rtex(rdiv(rneg(rs[0]),rs[1])));
        else if(rs&&rs.every(Boolean)&&rs.length===3)roots.push(...quadRoots(rs[2],rs[1],rs[0]));
        else if(rs&&rs.every(Boolean)&&rs.length>3&&rs.slice(1,-1).every(r=>r[0]===0)){const n=rs.length-1,c=rdiv(rneg(rs[0]),rs[n]);   // a x^n + b = 0
          if(c[0]===0)roots.push('0');else if(n%2||c[0]>0){const v=Math.pow(Math.abs(c[0]/c[1]),1/n),iv=Math.round(v),ok=Math.abs(iv-v)<1e-9;
            const body=ok?String(iv):`\\sqrt[${n}]{${rtex([Math.abs(c[0]),c[1]])}}`;roots.push(n%2?(c[0]<0?'-':'')+body:'\\pm '+body)}}
        else{let sol;try{sol=N.solve(f,v).symbol.elements}catch(e){sol=[]}
          for(const s of sol)roots.push(nice(s.toString(),false))}}
      return roots.filter(Boolean)}
    let f;try{f=N(expr).buildFunction([v])}catch(e){return null}            // anything else: find the real roots numerically
    const trig=/sin|cos|tan|sec|csc|cot/.test(expr),xs=numRoots(f,trig);
    if(trig){const out=xs.map(piTex);if(out.length)out.push('\\text{(in }[0,2\\pi)\\text{; add }2\\pi k\\text{ for all)}');return out}
    return xs.map(numTex)}
  function numRoots(f,trig){const pts=[];
    if(trig)for(let i=0;i<=6000;i++)pts.push(i*2*Math.PI/6000);
    else{for(let i=-4000;i<=4000;i++)pts.push(i/40);for(let e=-6;e<=7;e+=.005){const y=Math.pow(10,e);pts.push(y,-y)}pts.sort((p,q)=>p-q)}
    const F=x=>{try{const y=f(x);return typeof y==='number'?y:NaN}catch(e){return NaN}},roots=[];
    const keep=r=>{const y=F(r);if(isFinite(y)&&Math.abs(y)<1e-7*(1+Math.abs(r))&&!roots.some(q=>Math.abs(q-r)<1e-7*(1+Math.abs(r))))roots.push(r)};
    let px=pts[0],pf=F(px);
    for(let k=1;k<pts.length;k++){const x=pts[k],fx=F(x);
      if(isFinite(fx)&&fx===0)keep(x);
      else if(isFinite(pf)&&isFinite(fx)&&pf*fx<0){let lo=px,hi=x,fl=pf;for(let it=0;it<90;it++){const m=(lo+hi)/2,fm=F(m);if(!isFinite(fm))break;if(fl*fm<=0)hi=m;else{lo=m;fl=fm}}keep((lo+hi)/2)}
      px=x;pf=fx}
    if(trig)return roots.filter(r=>r<2*Math.PI-1e-9).sort((p,q)=>p-q);return roots.sort((p,q)=>p-q)}
  function numTex(x){if(Math.abs(x-Math.round(x))<1e-8*(1+Math.abs(x)))return String(Math.round(x));
    for(let d=2;d<=12;d++){const n=Math.round(x*d);if(Math.abs(n/d-x)<1e-9)return rtex([n/gcd(n,d),d/gcd(n,d)])}
    const pi=piTex(x);if(!pi.startsWith('\\approx'))return pi;return'\\approx '+(+x.toPrecision(6))}
  function piTex(x){for(let d=1;d<=12;d++){const n=Math.round(x/Math.PI*d);if(Math.abs(n/d*Math.PI-x)<1e-7){const g=gcd(n,d),a=n/g,b=d/g;
        if(a===0)return'0';const num=(a===1?'':a)+'\\pi';return b===1?num:`\\frac{${num}}{${b}}`}}return'\\approx '+(+x.toPrecision(6))}
  function nice(st,dec){                                // exact TeX when nerdamer found it exactly, a rounded decimal otherwise, nothing for complex noise
    if(!/\d{7,}/.test(st)&&!(dec&&/\./.test(st)))return cleanTex(nerdamer(st).toTeX());
    const a=approx(st);return a&&!/i/.test(a)?'\\approx '+a:null}
  const cleanTex=t=>String(t).replace(/\^\{1\}/g,'').replace(/\\frac\{\\left\(([^()]*)\\right\)\}/g,'\\frac{$1}').replace(/\s*\\cdot\s*(?=\\left\(|[a-zA-Z(])/g,' ').replace(/\\left\(/g,'(').replace(/\\right\)/g,')');
  async function runCAS(op,it){
    let N;try{N=await loadCAS()}catch(e){return toast('The math engine could not load. Check your connection and try again.')}
    if(!E)return;const src=itemExpr(it);if(!src.trim())return;
    let out;
    try{const sides=src.split(/(?<![<>!])=(?!=)/);
      if(/[<>]|!=/.test(src))throw new Error('Inequalities are not supported yet.');
      if(op==='solve'){if(sides.length>2)throw new Error('Use one equation at a time.');
        const expr=sides.length===2?`(${sides[0]})-(${sides[1]})`:sides[0];const vars=N(expr).variables().filter(x=>!/^(pi|e|i)$/.test(x));
        const flat=N.expand(expr).toString();if(!N(flat).variables().length&&sides.length===2){out=flat==='0'?'\\text{true for every value}':'\\text{no solution}';throw{done:1}}
        if(!vars.length)throw new Error('There is no variable to solve for.');
        const v=vars.includes('x')?'x':vars.includes('y')?'y':vars[0];
        {const r=solveFor(expr,v);if(!r)throw new Error('Could not solve that.');
          const uniq=[...new Set(r)];out=uniq.length?uniq.map(x=>x.startsWith('\\text')?x:`${v} ${x.startsWith('\\approx')?x:'= '+x}`).join(',\\quad ').replace(/,\\quad \\text/,'\\quad\\text'):'\\text{no solution}'}}
      else{const f=x=>cleanTex((op==='factor'?N.factor(x):N.expand(x)).toTeX());out=sides.length===2?`${f(sides[0])} = ${f(sides[1])}`:'= '+f(sides[0])}
    }catch(e){if(!(e&&e.done))return toast((e&&e.message&&!/^[A-Z_]+$/.test(e.message)&&e.message.length<80?e.message:'Could not '+op+' that.')+' Check how it is written.')}
    const b=bbox(it),z=it.k==='m'?it.z:Math.round(it.z*1.1);
    const res={k:'m',x:it.x,y:+(b[3]+z*.35).toFixed(1),z,c:'#2f5bd3',v:out};
    snap();E.pg.items.push(res);if(res.y+z*2.2>E.pg.h*SH&&E.pg.h<MAXH){E.pg.h++;layout()}else redraw();changed();
    if(E.sel)showSel()}                                 // the question stays selected, the answer sits just below it
  let toastT=null;function toast(msg){if(!E)return;let t=E.el.querySelector('.nbe-toast');if(!t){t=document.createElement('div');t.className='nbe-toast';E.el.appendChild(t)}
    t.textContent=msg;t.classList.add('on');clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('on'),3800)}

  /* math is drawn with KaTeX in a layer over the page; thumbnails and images get a plain-text version */
  const kcache=new Map();
  function katexHTML(v){if(kcache.has(v))return kcache.get(v);let h;
    try{h=window.katex?katex.renderToString(v?'\\displaystyle '+v:'\\square',{throwOnError:false,displayMode:false}):H(v)}catch(e){h=H(v)}
    if(kcache.size>400)kcache.clear();kcache.set(v,h);return h}
  function mathLayer(pg){const L=E.el.querySelector('.nbe-mlayer');let h='';
    pg.items.forEach((it,i)=>{if(it.k==='m')h+=`<div class="nbe-m" data-i="${i}" style="left:${it.x*E.s}px;top:${it.y*E.s}px;font-size:${it.z*E.s}px;color:${it.c}">${katexHTML(it.v)}</div>`});
    L.innerHTML=h;if(pg!==E.pg)return;
    L.querySelectorAll('.nbe-m').forEach(el=>{const it=pg.items[+el.dataset.i];if(!it.bw&&el.offsetWidth){it.bw=+(el.offsetWidth/E.s).toFixed(1);it.bh=+(el.offsetHeight/E.s).toFixed(1)}})}
  function plainTex(v){let s=String(v);
    for(let k=0;k<4;k++)s=s.replace(/\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}/g,'($1)/($2)').replace(/\\sqrt\{([^{}]*)\}/g,'√($1)');
    return s.replace(/\\left|\\right/g,'').replace(/\\cdot/g,'·').replace(/\\times/g,'×').replace(/\\pi/g,'π').replace(/\\theta/g,'θ').replace(/\\le(q)?\b/g,'≤').replace(/\\ge(q)?\b/g,'≥')
      .replace(/\\infty/g,'∞').replace(/\\pm/g,'±').replace(/\\(operatorname\{(\w+)\}|(\w+))/g,'$2$3').replace(/[{}]/g,'').replace(/\\ /g,' ')}

  /* page operations */
  function addPage(){const b=E.book(),pid=newPage(E.bid,E.pg.tpl,stamp());b.pages.splice(E.i+1,0,pid);setRec('b',E.bid,{pages:b.pages});mark('p',pid);flushLocal();gotoPage(E.i+1)}
  function delPage(){const b=E.book();if(b.pages.length===1){if(!E.pg.items.length||confirm('Clear this page? It is the only page in the notebook.')){snap();E.pg.items=[];redraw();changed()}return}
    if(!confirm('Delete page '+(E.i+1)+'?'))return;const pid=b.pages[E.i];b.pages.splice(E.i,1);lib.p[pid]={b:E.bid,del:1,at:stamp()};delete pages[pid];idel(ns+'|pg|'+pid);
    mark('p',pid);setRec('b',E.bid,{pages:b.pages});gotoPage(Math.min(E.i,b.pages.length-1))}
  function dupPage(){const b=E.book(),pid=newPage(E.bid,E.pg.tpl,stamp());Object.assign(pages[pid],{h:E.pg.h,items:E.pg.items.slice()});
    b.pages.splice(E.i+1,0,pid);setRec('b',E.bid,{pages:b.pages});mark('p',pid);flushLocal();gotoPage(E.i+1)}
  function extend(){if(E.pg.h>=MAXH)return;snap();const y=E.pg.h*SH;E.pg.h++;layout();changed();E.body.scrollTo({top:y*E.s-80,behavior:'smooth'})}
  function trim(){let bottom=0;for(const it of E.pg.items)bottom=Math.max(bottom,bbox(it)[3]);const h=Math.max(1,Math.ceil((bottom+40)/SH));if(h===E.pg.h)return;snap();E.pg.h=h;layout();changed()}
  function exportPng(){const cv=document.createElement('canvas'),w=1400,s=w/W;cv.width=w;cv.height=Math.round(E.pg.h*SH*s);drawPage(cv.getContext('2d'),E.pg,s,E.pg.h);
    const a=document.createElement('a');a.download=(E.book().n||'page').replace(/[^\w\- ]+/g,'')+' p'+(E.i+1)+'.png';a.href=cv.toDataURL('image/png');a.click()}
  function moreMenu(btn){const tick=b=>b?'✓ ':'';
    menu(btn,[...TPL.map(([k,n])=>[tick(E.pg.tpl===k)+n+' paper',()=>{E.pg.tpl=k;redraw();changed()}]),null,
      ['Extend page down',extend],['Remove empty space at the bottom',trim],null,['Add page after this one',addPage],['Duplicate page',dupPage],['Clear page',()=>{if(!E.pg.items.length)return;snap();E.pg.items=[];redraw();changed()}],
      ['Delete page',delPage,'danger'],null,[fit==='width'?'View: fit whole page on screen':'View: fit page width',()=>{fit=fit==='width'?'page':'width';ls('fit',fit);layout()}],
      [(fingerDraw?'✓ ':'')+'Draw with finger'+(penSeen?' (off: fingers scroll, only the stylus draws)':''),()=>{fingerDraw=!fingerDraw;ls('finger',fingerDraw?'1':'0');paintTools()}],
      ['Save page as image',exportPng]])}
  async function pageGrid(){const g=E.el.querySelector('.nbe-pages');if(!g.hidden){g.hidden=true;return}const b=E.book();
    g.innerHTML=`<div class="nbe-pghead"><b>${H(b.n)}</b><span class="meta">${b.pages.length} page${b.pages.length===1?'':'s'}</span><span class="spacer"></span><button class="btn sm" data-g="close">Done</button></div>
      <div class="nbe-pggrid">${b.pages.map((pid,i)=>`<div class="nbe-pgt ${i===E.i?'on':''}"><button type="button" data-g="go" data-i="${i}"><canvas data-pt="${pid}"></canvas></button>
        <div class="nbe-pgn"><button type="button" data-g="l" data-i="${i}" ${i?'':'disabled'} aria-label="Move earlier">‹</button><span>${i+1}</span><button type="button" data-g="r" data-i="${i}" ${i<b.pages.length-1?'':'disabled'} aria-label="Move later">›</button></div></div>`).join('')}</div>`;
    g.hidden=false;g.querySelectorAll('canvas[data-pt]').forEach(cv=>getPage(cv.dataset.pt).then(pg=>{if(cv.isConnected)thumb(cv,pg)}))}
  function gridClick(t){const g=E.el.querySelector('.nbe-pages'),a=t.dataset.g,i=+t.dataset.i,b=E.book();
    if(a==='close'){g.hidden=true;return}if(a==='go'){g.hidden=true;gotoPage(i);return}
    const j=a==='l'?i-1:i+1;if(j<0||j>=b.pages.length)return;const cp=b.pages[E.i];[b.pages[i],b.pages[j]]=[b.pages[j],b.pages[i]];E.i=b.pages.indexOf(cp);
    setRec('b',E.bid,{pages:b.pages});g.hidden=true;pageGrid();paintBar()}
  function edClick(e){if(!E)return;
    const g=e.target.closest('[data-g]');if(g)return gridClick(g);
    const s=e.target.closest('[data-s]');if(s)return selAct(s.dataset.s);
    const t=e.target.closest('[data-tool]');if(t){commitText();clearSel();tool=t.dataset.tool;ls('tool',tool);return paintTools()}
    const tm=e.target.closest('[data-tm]');if(tm){pref.tm=tm.dataset.tm;savePref();return paintTools()}
    const c=e.target.closest('[data-col]');if(c){pref['c_'+tool]=c.dataset.col;savePref();return paintTools()}
    const z=e.target.closest('[data-size]');if(z){pref['s_'+tool]=+z.dataset.size;savePref();return paintTools()}
    const a=e.target.closest('[data-a]');if(!a)return;const k=a.dataset.a;
    if(k==='close')return closeEditor();if(k==='undo')return undoRedo(false);if(k==='redo')return undoRedo(true);
    if(k==='prev')return gotoPage(E.i-1);if(k==='next')return gotoPage(E.i+1);if(k==='add')return addPage();if(k==='extend')return extend();
    if(k==='grid')return pageGrid();if(k==='more'){e.stopPropagation();return moreMenu(a)}
    if(k==='rename')return askName('Rename notebook',E.book().n,'Rename',n=>{setRec('b',E.bid,{n});paintBar()})}

  /* ---------- wiring ---------- */
  let ready=Promise.resolve();
  if(typeof document!=='undefined'){
    ready=loadNs().catch(()=>{}).then(()=>{listen();return pull()}).catch(()=>{});
    document.addEventListener('amcprep:code',()=>{if(E)closeEditor();ready=ready.then(loadNs).then(()=>{listen();return pull()}).catch(()=>{}).then(()=>{if(libVisible())renderLib()})});
    document.addEventListener('click',e=>{if(menuEl&&!menuEl.contains(e.target))closeMenu();libClick(e)});
    document.addEventListener('input',e=>{if(e.target.classList&&e.target.classList.contains('nb-q')){query=e.target.value;const pos=e.target.selectionStart;renderLib();
      const q=libBody&&libBody.querySelector('.nb-q');if(q){q.focus();try{q.setSelectionRange(pos,pos)}catch(_){}}}});
    document.addEventListener('keydown',e=>{
      if(!E){const t=e.target.closest&&e.target.closest('[data-open-b],[data-open-f]');if(t&&(e.key==='Enter'||e.key===' ')){e.preventDefault();t.click()}return}
      if(document.querySelector('.nb-dlg')||/^(INPUT|TEXTAREA)$/.test(e.target.tagName))return;
      const mod=e.ctrlKey||e.metaKey;e.stopPropagation();
      if(mod&&e.key.toLowerCase()==='z'){e.preventDefault();undoRedo(e.shiftKey)}else if(mod&&e.key.toLowerCase()==='y'){e.preventDefault();undoRedo(true)}
      else if(e.key==='Escape'){if(menuEl)closeMenu();else if(E.sel)clearSel();else closeEditor()}
      else if((e.key==='Delete'||e.key==='Backspace')&&E.sel){e.preventDefault();selAct('del')}
      else if(e.key==='PageDown'||e.key==='ArrowRight')gotoPage(E.i+1);else if(e.key==='PageUp'||e.key==='ArrowLeft')gotoPage(E.i-1)},true);
    window.addEventListener('hashchange',()=>{if(E)closeEditor()});
    window.addEventListener('resize',()=>{if(E)layout()});
    window.addEventListener('online',()=>{if(dirty.lib.size||dirty.pg.size)schedulePush(100)});
    const bye=()=>{commitText();flushLocal()};window.addEventListener('pagehide',bye);
    document.addEventListener('visibilitychange',()=>{if(document.hidden)bye();else if(code())pull().then(r=>{if(r&&r.changed&&libVisible())renderLib()})});
    if(document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>{if(E)redraw()});
  }
  return{view,open:openBook,get lib(){return lib},flush:flushLocal,push,pull,usedBytes};
})();
