/* ---------- Focus music: tracks saved under the sync code, shuffled, cached on each device ----------
   cloud  /codes/<code>/music/meta/<id>      {name, size, type, at, n}
          /codes/<code>/music/data/<id>/<i>  512K base64 pieces
          /codes/<code>/music/lists/<id>     {n, ids:[track ids], at} playlists ({del:1, at} once deleted)
   local  IndexedDB 'ionized-music', store 'files': id -> {blob, name, type, size, at}
   Only devices that know the code can fetch the tracks; nothing is in the public site. */
const MUSIC=(()=>{
  if(typeof document==='undefined')return null;
  const FB='https://ionized-study-and-shi-default-rtdb.firebaseio.com',CHUNK=512*1024;
  const code=()=>typeof SYNC!=='undefined'?SYNC.code:null;
  const H=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
  const pref=(()=>{try{return JSON.parse(localStorage.getItem('amcprep.music')||'{}')||{}}catch(e){return{}}})();
  const savePref=()=>{try{localStorage.setItem('amcprep.music',JSON.stringify(pref))}catch(e){}};

  /* ---------- this device's copies ---------- */
  let dbp=null;
  const db=()=>dbp||(dbp=new Promise((ok,no)=>{if(typeof indexedDB==='undefined')return no(new Error('no IndexedDB'));
    const r=indexedDB.open('ionized-music',1);r.onupgradeneeded=()=>r.result.createObjectStore('files');r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)}));
  const tx=(mode,fn)=>db().then(d=>new Promise((ok,no)=>{const t=d.transaction('files',mode),q=fn(t.objectStore('files'));t.oncomplete=()=>ok(q&&q.result);t.onerror=()=>no(t.error)}));
  const iget=k=>tx('readonly',st=>st.get(k)).catch(()=>undefined);
  const iput=(k,v)=>tx('readwrite',st=>st.put(v,k));
  const idel=k=>tx('readwrite',st=>st.delete(k)).catch(()=>{});
  const local={};                                       // id -> {name,size,at} for tracks stored on this device
  const ready=tx('readonly',st=>st.getAll()).then(async vals=>{const keys=await tx('readonly',st=>st.getAllKeys());
    (keys||[]).forEach((k,i)=>{const v=vals[i]||{};local[k]={name:v.name,size:v.size,at:v.at||0}})}).catch(()=>{});

  /* ---------- the copy under the sync code ---------- */
  let cloud={};const busy={};                            // busy[id] = 'up 40' / 'down 40' / 'failed'
  async function rest(path,method,body){const c=code();if(!c)throw new Error('no code');
    const r=await fetch(`${FB}/codes/${c}/music/${path}.json`,{method:method||'GET',cache:'no-store',
      headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
    if(!r.ok)throw new Error('HTTP '+r.status);return r.json()}
  async function loadCloud(){if(!code())return;let m;try{m=(await rest('meta'))||{}}catch(e){return}
    cloud={};for(const k in m)if(safeId(k)&&m[k]&&typeof m[k]==='object')cloud[k]=m[k];
    for(const id in local){if(cloud[id]&&cloud[id].del){idel(id);delete local[id]}else if(!cloud[id])queueUpload(id)}
    try{mergeLists(await rest('lists'))}catch(e){}paint()}

  /* ---------- playlists (kept on this device too, so they work offline and before a code exists) ---------- */
  const lists=pref.lists&&typeof pref.lists==='object'?pref.lists:(pref.lists={});
  const liveList=id=>!!(lists[id]&&!lists[id].del);
  function saveList(id){savePref();if(code())rest('lists/'+id,'PUT',lists[id]).catch(()=>{})}
  function mergeLists(m){m=m&&typeof m==='object'?m:{};
    for(const id in m){const r=m[id];if(!safeId(id)||!r||typeof r!=='object')continue;
      if(!lists[id]||(r.at||0)>(lists[id].at||0))lists[id]=r.del?{del:1,at:r.at||0}:{n:String(r.n||'Playlist').slice(0,60),ids:(Array.isArray(r.ids)?r.ids:Object.values(r.ids||{})).filter(x=>typeof x==='string'&&safeId(x)),at:r.at||0}}
    for(const id in lists)if(!m[id]||(lists[id].at||0)>(m[id].at||0))saveList(id);           // made offline or before the code existed
    savePref()}
  const active=()=>liveList(pref.list)?pref.list:'';
  const listNames=()=>Object.keys(lists).filter(liveList).sort((a,b)=>lists[a].n.localeCompare(lists[b].n));
  function pool(){const all=tracks(),l=active();if(!l)return all;const s=new Set(lists[l].ids);return all.filter(t=>s.has(t.id))}
  function useList(id){pref.list=id;savePref();order=[];pos=-1;editing=false;
    if(!audio.paused&&audio.src){if(pool().length)next();else{audio.pause();msg('This playlist is empty. Tap Edit to choose its tracks.')}}paint()}
  function makeList(n){const id=uid();lists[id]={n,ids:[],at:Date.now()};saveList(id);useList(id);editing=true;paint()}
  function renameList(id,n){lists[id]=Object.assign({},lists[id],{n,at:Date.now()});saveList(id);paint()}
  function dropList(id){if(!confirm(`Delete the playlist “${lists[id].n}”? Its tracks stay in your music.`))return;
    lists[id]={del:1,at:Date.now()};saveList(id);useList('')}
  function toggleIn(id,tid){const L=lists[id],ids=L.ids.includes(tid)?L.ids.filter(x=>x!==tid):L.ids.concat(tid);
    lists[id]=Object.assign({},L,{ids,at:Date.now()});saveList(id);order=[];pos=-1;paint()}
  const b64of=blob=>new Promise((ok,no)=>{const fr=new FileReader();fr.onload=()=>ok(String(fr.result).split(',')[1]||'');fr.onerror=()=>no(fr.error);fr.readAsDataURL(blob)});
  function setBusy(id,v){if(v)busy[id]=v;else delete busy[id];paintRow(id)}
  let upChain=Promise.resolve();
  const queueUpload=id=>{upChain=upChain.then(()=>upload(id)).catch(()=>{})};   // one at a time
  async function upload(id){if(!code()||cloud[id])return;
    try{const rec=await iget(id);if(!rec)return;setBusy(id,'up 0');const b=await b64of(rec.blob),n=Math.max(1,Math.ceil(b.length/CHUNK));
      for(let i=0;i<n;i++){await rest(`data/${id}/${i}`,'PUT',b.slice(i*CHUNK,(i+1)*CHUNK));setBusy(id,'up '+Math.round((i+1)/n*100))}
      const meta={name:rec.name,size:rec.size,type:rec.type||'audio/mpeg',at:rec.at,n};await rest('meta/'+id,'PUT',meta);cloud[id]=meta;setBusy(id)}
    catch(e){setBusy(id,'failed')}}
  const downloading={};
  function download(id){if(downloading[id])return downloading[id];
    return downloading[id]=(async()=>{const m=cloud[id];if(!m)throw new Error('missing');setBusy(id,'down 0');const parts=[];
      try{for(let i=0;i<m.n;i++){const p=await rest(`data/${id}/${i}`);if(typeof p!=='string')throw new Error('incomplete');parts.push(p);setBusy(id,'down '+Math.round((i+1)/m.n*100))}
        const bin=atob(parts.join(''));const u8=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u8[i]=bin.charCodeAt(i);
        const rec={blob:new Blob([u8],{type:m.type||'audio/mpeg'}),name:m.name,type:m.type,size:m.size,at:m.at};
        await iput(id,rec);local[id]={name:m.name,size:m.size,at:m.at};setBusy(id);return rec.blob}
      catch(e){setBusy(id);throw e}finally{delete downloading[id]}})()}
  async function blobFor(id){const rec=await iget(id);if(rec&&rec.blob)return rec.blob;return download(id)}

  /* ---------- the track list and shuffle order ---------- */
  const gone=id=>!!(cloud[id]&&cloud[id].del);         // removed on some device: a marker stays so no copy comes back
  function tracks(){const all={};for(const id in cloud)if(!gone(id))all[id]=cloud[id].name;for(const id in local)if(!gone(id))all[id]=local[id].name;
    return Object.keys(all).map(id=>({id,name:all[id]||'Track'})).sort((a,b)=>a.name.localeCompare(b.name))}
  let order=[],pos=-1;
  function shuffle(){const ids=pool().map(t=>t.id);for(let i=ids.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[ids[i],ids[j]]=[ids[j],ids[i]]}
    if(order[pos]&&ids.length>1&&ids[0]===order[pos])ids.push(ids.shift());order=ids;pos=-1}
  const nameOf=id=>{const t=tracks().find(x=>x.id===id);return t?t.name:''};
  const pretty=n=>String(n).replace(/\.(mp3|m4a|aac|wav|ogg|flac)$/i,'').replace(/\s*-\s*DeepWork Research$/i,'').trim();

  /* ---------- playback ---------- */
  const audio=new Audio();audio.preload='auto';let url=null,cur=null,wantPlay=false,loadingId=null;
  audio.volume=pref.vol==null?.6:pref.vol;
  const volumeWorks=(()=>{const v=audio.volume;try{audio.volume=v===.5?.4:.5;const ok=audio.volume!==1;audio.volume=v;return ok}catch(e){return false}})();   // iPhones fix volume at 100%
  async function playId(id){if(!id)return;loadingId=id;cur=id;pref.last=id;savePref();paint();
    let blob;try{blob=await blobFor(id)}catch(e){if(loadingId===id){loadingId=null;msg(navigator.onLine?'Could not load that track.':'That track is not on this device yet. Connect to the internet to download it.');skipToLocal()}return}
    if(loadingId!==id)return;loadingId=null;
    if(url)URL.revokeObjectURL(url);url=URL.createObjectURL(blob);audio.src=url;
    try{await audio.play();wantPlay=true;pref.on=true;savePref()}catch(e){wantPlay=false}
    mediaInfo();paint();prefetchNext()}
  function skipToLocal(){const ids=order.slice(pos+1).concat(order.slice(0,pos+1));const id=ids.find(i=>local[i]);if(id&&id!==cur){pos=order.indexOf(id);playId(id)}else{wantPlay=false;paint()}}
  function next(){if(!order.length||pos>=order.length-1)shuffle();if(!order.length)return msg(active()?'This playlist is empty. Tap Edit to choose its tracks.':'Add some music first.');pos++;playId(order[pos])}
  function prev(){if(audio.currentTime>3||pos<=0){audio.currentTime=0;return}pos--;playId(order[pos])}
  function toggle(){if(!tracks().length){open();return msg('Add your music with “Add music…” below.')}
    if(!audio.src||!cur){next();return}
    if(audio.paused){audio.play().then(()=>{wantPlay=true;pref.on=true;savePref();paint()}).catch(()=>{})}
    else{audio.pause();wantPlay=false;pref.on=false;savePref();paint()}}
  function prefetchNext(){if(!navigator.onLine)return;if(pos>=order.length-1)return;const id=order[pos+1];if(id&&!local[id]&&cloud[id])download(id).catch(()=>{})}
  audio.addEventListener('ended',next);
  audio.addEventListener('play',paint);audio.addEventListener('pause',paint);
  function mediaInfo(){if(!('mediaSession' in navigator))return;try{
    navigator.mediaSession.metadata=new MediaMetadata({title:pretty(nameOf(cur)),artist:'Ionized Study',album:'Focus music'});
    navigator.mediaSession.setActionHandler('play',()=>toggle());navigator.mediaSession.setActionHandler('pause',()=>toggle());
    navigator.mediaSession.setActionHandler('nexttrack',next);navigator.mediaSession.setActionHandler('previoustrack',prev)}catch(e){}}

  /* ---------- adding and removing tracks ---------- */
  async function addFiles(files){let n=0;
    for(const f of files){if(!/^audio\//.test(f.type)&&!/\.(mp3|m4a|aac|wav|ogg)$/i.test(f.name))continue;
      const id=uid(),at=Date.now();try{await iput(id,{blob:f,name:f.name,type:f.type||'audio/mpeg',size:f.size,at})}catch(e){msg('Could not save '+f.name+' on this device.');continue}
      local[id]={name:f.name,size:f.size,at};n++;if(code())queueUpload(id)}
    order=[];pos=-1;paint();if(n)msg(code()?`Added ${n} track${n===1?'':'s'}. Saving to your code…`:`Added ${n} track${n===1?'':'s'} on this device.`)}
  async function removeTrack(id){if(!confirm(`Remove “${pretty(nameOf(id))}” from your music on every device?`))return;
    if(cur===id){audio.pause();cur=null}
    await idel(id);delete local[id];
    if(code()){try{await rest('meta/'+id,'PUT',{del:1,at:Date.now()});await rest('data/'+id,'DELETE')}catch(e){}}
    cloud[id]={del:1};order=order.filter(x=>x!==id);pos=Math.min(pos,order.length-1);paint()}
  async function downloadAll(){for(const t of tracks())if(!local[t.id]&&cloud[t.id]){try{await download(t.id)}catch(e){msg('Download stopped. Try again when you are online.');return}}msg('All tracks are on this device and play offline.')}

  /* ---------- the button and panel ---------- */
  const NOTE='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/></svg>';
  const ICON={play:'<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" fill="currentColor" stroke="none"/></svg>',
    pause:'<svg viewBox="0 0 24 24"><path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor" stroke="none"/></svg>',
    prev:'<svg viewBox="0 0 24 24"><path d="M6 5v14M19 5L9 12l10 7z"/></svg>',next:'<svg viewBox="0 0 24 24"><path d="M18 5v14M5 5l10 7-10 7z"/></svg>'};
  const btn=document.createElement('button');btn.className='mu-btn';btn.type='button';btn.setAttribute('aria-label','Focus music');
  btn.innerHTML=NOTE+'<span class="mu-eq" aria-hidden="true"><i></i><i></i><i></i></span>';
  const panel=document.createElement('div');panel.className='mu-panel';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Focus music');
  const mount=()=>{document.body.appendChild(btn);document.body.appendChild(panel)};
  if(document.body)mount();else document.addEventListener('DOMContentLoaded',mount);
  let msgText='',msgT=null;function msg(t){msgText=t;clearTimeout(msgT);msgT=setTimeout(()=>{msgText='';paint()},6000);paint()}
  const mb=n=>(n/1048576).toFixed(1)+' MB';
  function rowStatus(id){const b=busy[id];if(b==='failed')return'not saved (offline)';if(b&&b.startsWith('up'))return'saving '+b.slice(3)+'%';
    if(b&&b.startsWith('down'))return'downloading '+b.slice(5)+'%';if(local[id])return'';return'tap to download'}
  let editing=false,naming=null;                         // naming: 'new' | 'rename' while the name field is open
  function open(){panel.hidden=false;paint()}
  function close(){panel.hidden=true;naming=null}
  function listBar(){const l=active();
    return`<div class="mu-lists"><label class="mu-sel-w"><span class="mu-dim">Playlist</span><select class="mu-sel" data-mu-list aria-label="Playlist">
        <option value="">All music</option>${listNames().map(id=>`<option value="${H(id)}"${id===l?' selected':''}>${H(lists[id].n)}</option>`).join('')}<option value="+new">New playlist…</option></select></label>
      ${l?`<button type="button" class="mu-link" data-mu="edit">${editing?'Done':'Edit'}</button><button type="button" class="mu-link" data-mu="rename">Rename</button><button type="button" class="mu-link mu-danger" data-mu="droplist">Delete</button>`:''}</div>
      ${naming?`<form class="mu-namef" data-mu-form><input class="mu-in" name="n" maxlength="60" autocomplete="off" placeholder="Playlist name" value="${naming==='rename'&&l?H(lists[l].n):''}">
        <button type="submit" class="mu-link">${naming==='rename'?'Save':'Create'}</button><button type="button" class="mu-link" data-mu="noname">Cancel</button></form>`:''}`}
  function listRows(){const l=active(),ts=tracks();
    if(editing&&l){const s=new Set(lists[l].ids);
      return ts.map(t=>`<div class="mu-row"><button type="button" class="mu-name mu-pick${s.has(t.id)?' on':''}" data-mu-tog="${H(t.id)}" aria-pressed="${s.has(t.id)}"><i class="mu-box" aria-hidden="true"></i>${H(pretty(t.name))}</button></div>`).join('')
        ||'<p class="mu-dim mu-empty">Add music first, then choose tracks for this playlist.</p>'}
    const ps=pool();
    return ps.length?ps.map(t=>`<div class="mu-row ${t.id===cur?'cur':''}" data-mu-row="${H(t.id)}"><button type="button" class="mu-name" data-mu-play="${H(t.id)}">${H(pretty(t.name))}</button>
        <span class="mu-st" data-mu-st="${H(t.id)}">${rowStatus(t.id)}</span>${l?'':`<button type="button" class="mu-del" data-mu-del="${H(t.id)}" aria-label="Remove">${icon('x')}</button>`}</div>`).join('')
      :l?'<p class="mu-dim mu-empty">This playlist is empty. Tap Edit to choose its tracks.</p>'
      :'<p class="mu-dim mu-empty">No music yet. Add MP3 files from this device; they are saved to your sync code so your other devices get them too.</p>'}
  function paint(){
    const playing=!audio.paused&&!!audio.src;btn.classList.toggle('on',playing);
    if(panel.hidden)return;
    const f=panel.querySelector('.mu-in'),keep=f&&{v:f.value,focus:document.activeElement===f};   // a repaint must not wipe a name being typed
    const ts=tracks(),missing=ts.filter(t=>!local[t.id]).length,size=ts.reduce((a,t)=>a+((cloud[t.id]||local[t.id]||{}).size||0),0),l=active();
    panel.innerHTML=`<div class="mu-head"><b>Focus music</b><span class="mu-sp"></span><button type="button" class="mu-x" data-mu="close" aria-label="Close">${icon('x')}</button></div>
      <div class="mu-now">${cur?H(pretty(nameOf(cur)))+(loadingId===cur?' <span class="mu-dim">· loading…</span>':''):`<span class="mu-dim">Shuffle plays ${l?'“'+H(lists[l].n)+'”':'your tracks'} in a random order.</span>`}</div>
      <div class="mu-ctl"><button type="button" data-mu="prev" aria-label="Previous">${ICON.prev}</button>
        <button type="button" class="mu-play" data-mu="toggle" aria-label="${playing?'Pause':'Play'}">${playing?ICON.pause:ICON.play}</button>
        <button type="button" data-mu="next" aria-label="Next">${ICON.next}</button></div>
      ${volumeWorks?`<label class="mu-vol"><span>Volume</span><input type="range" min="0" max="1" step="0.02" value="${audio.volume}" data-mu-vol></label>`:''}
      ${ts.length||listNames().length?listBar():''}
      <div class="mu-list">${listRows()}</div>
      <div class="mu-foot"><label class="mu-add">Add music…<input type="file" accept="audio/*,.mp3,.m4a" multiple hidden data-mu-file></label>
        ${missing&&code()?`<button type="button" class="mu-link" data-mu="all">Download all for offline (${missing})</button>`:''}</div>
      <p class="mu-note">${msgText?H(msgText):code()?(ts.length?`Saved under your sync code (${ts.length} track${ts.length===1?'':'s'}, ${mb(size)}). Only devices with your code can play them.`:'Tracks you add are saved under your sync code. Only devices with your code can play them.'):'On this device only. Set up a sync code to keep your music on every device.'}</p>`;
    const nf=panel.querySelector('.mu-in');if(nf&&keep){nf.value=keep.v;if(keep.focus)nf.focus()}
  }
  function paintRow(id){const el=panel.querySelector(`[data-mu-st="${CSS.escape(id)}"]`);if(el)el.textContent=rowStatus(id)}
  btn.addEventListener('click',e=>{e.stopPropagation();panel.hidden?open():close()});
  panel.addEventListener('click',e=>{e.stopPropagation();const a=e.target.closest('[data-mu]');
    if(a){const k=a.dataset.mu;if(k==='close')close();else if(k==='toggle')toggle();else if(k==='next')next();else if(k==='prev')prev();else if(k==='all')downloadAll();
      else if(k==='edit'){editing=!editing;naming=null;paint()}else if(k==='rename'){naming='rename';paint();focusName()}else if(k==='droplist')dropList(active());
      else if(k==='noname'){naming=null;paint()}return}
    const g=e.target.closest('[data-mu-tog]');if(g&&active()){toggleIn(active(),g.dataset.muTog);return}
    const p=e.target.closest('[data-mu-play]');if(p){const id=p.dataset.muPlay;if(!order.includes(id))shuffle();pos=order.indexOf(id);playId(id);return}
    const d=e.target.closest('[data-mu-del]');if(d)removeTrack(d.dataset.muDel)});
  const focusName=()=>{const f=panel.querySelector('.mu-in');if(f){f.focus();f.select()}};
  panel.addEventListener('submit',e=>{e.preventDefault();const n=(panel.querySelector('.mu-in')||{}).value;const name=String(n||'').trim().slice(0,60);if(!name)return focusName();
    const was=naming;naming=null;if(was==='rename'&&active())renameList(active(),name);else makeList(name)});
  panel.addEventListener('keydown',e=>{if(e.key==='Escape'&&naming){e.stopPropagation();naming=null;paint()}});
  panel.addEventListener('input',e=>{if(e.target.matches('[data-mu-vol]')){audio.volume=+e.target.value;pref.vol=audio.volume;savePref()}});
  panel.addEventListener('change',e=>{if(e.target.matches('[data-mu-file]')){addFiles([...e.target.files]);e.target.value=''}
    if(e.target.matches('[data-mu-list]')){const v=e.target.value;if(v==='+new'){naming='new';paint();focusName()}else{naming=null;useList(v)}}});
  document.addEventListener('click',e=>{if(!panel.hidden&&!panel.contains(e.target)&&e.target!==btn)close()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden)close()});
  let lastY=window.scrollY;
  window.addEventListener('scroll',()=>{const y=window.scrollY,d=y-lastY;if(Math.abs(d)<8)return;
    btn.classList.toggle('mu-away',d>0&&y>160&&panel.hidden);lastY=y},{passive:true});

  /* music that was playing keeps going after a reload; browsers need one tap before sound can start */
  if(pref.on){const resume=e=>{if(btn.contains(e.target)||panel.contains(e.target))return;document.removeEventListener('pointerdown',resume,true);
      if(audio.paused&&tracks().length){const id=pref.last&&tracks().some(t=>t.id===pref.last)?pref.last:null;shuffle();pos=Math.max(0,id?order.indexOf(id):0);playId(order[pos])}};
    document.addEventListener('pointerdown',resume,true)}

  document.addEventListener('amcprep:code',()=>{cloud={};ready.then(loadCloud).then(paint)});
  window.addEventListener('online',()=>{for(const id in busy)if(busy[id]==='failed'){delete busy[id];queueUpload(id)}loadCloud()});
  ready.then(()=>{if(code())loadCloud();paint()});
  return{play:toggle,next,prev,get tracks(){return tracks()}};
})();
