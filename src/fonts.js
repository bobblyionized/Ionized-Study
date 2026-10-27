/* ---------- Custom fonts for notebook text: font files saved on this device and under the sync code ----------
   cloud  /codes/<code>/fonts/meta/<id>      {name, size, at, n}   ({del:1, at} once removed)
          /codes/<code>/fonts/data/<id>/<i>  512K base64 pieces
   local  IndexedDB 'ionized-fonts', store 'files': id -> {buf, name, size, at}
   A font is used as the CSS family "nbf-<id>", loaded with FontFace from the file's bytes (no URL fetch). */
const FONTS=(()=>{
  if(typeof document==='undefined')return null;
  const FB='https://ionized-study-and-shi-default-rtdb.firebaseio.com',CHUNK=512*1024,MAX=8*1048576;
  const code=()=>typeof SYNC!=='undefined'?SYNC.code:null;
  const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
  let dbp=null;
  const db=()=>dbp||(dbp=new Promise((ok,no)=>{if(typeof indexedDB==='undefined')return no(new Error('no IndexedDB'));
    const r=indexedDB.open('ionized-fonts',1);r.onupgradeneeded=()=>r.result.createObjectStore('files');r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)}));
  const tx=(mode,fn)=>db().then(d=>new Promise((ok,no)=>{const t=d.transaction('files',mode),q=fn(t.objectStore('files'));t.oncomplete=()=>ok(q&&q.result);t.onerror=()=>no(t.error)}));
  const iget=k=>tx('readonly',st=>st.get(k)).catch(()=>undefined),iput=(k,v)=>tx('readwrite',st=>st.put(v,k)),idel=k=>tx('readwrite',st=>st.delete(k)).catch(()=>{});
  const local={},listeners=new Set();let cloud={};
  const notify=()=>listeners.forEach(f=>{try{f()}catch(e){}});
  const ready=tx('readonly',st=>st.getAll()).then(async vals=>{const keys=await tx('readonly',st=>st.getAllKeys());
    (keys||[]).forEach((k,i)=>{const v=vals[i]||{};local[k]={name:v.name,size:v.size,at:v.at||0}})}).catch(()=>{});
  async function rest(path,method,body){const c=code();if(!c)throw new Error('no code');
    const r=await fetch(`${FB}/codes/${c}/fonts/${path}.json`,{method:method||'GET',cache:'no-store',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
    if(!r.ok)throw new Error('HTTP '+r.status);return r.json()}
  const gone=id=>!!(cloud[id]&&cloud[id].del);
  async function loadCloud(){if(!code())return;let m;try{m=(await rest('meta'))||{}}catch(e){return}
    cloud={};for(const k in m)if(safeId(k)&&m[k]&&typeof m[k]==='object')cloud[k]=m[k];
    for(const id in local){if(gone(id)){idel(id);delete local[id]}else if(!cloud[id])upload(id)}notify()}
  const b64=buf=>{let s='';const u=new Uint8Array(buf);for(let i=0;i<u.length;i+=0x8000)s+=String.fromCharCode.apply(null,u.subarray(i,i+0x8000));return btoa(s)};
  async function upload(id){if(!code()||cloud[id])return;try{const rec=await iget(id);if(!rec)return;const s=b64(rec.buf),n=Math.max(1,Math.ceil(s.length/CHUNK));
      for(let i=0;i<n;i++)await rest(`data/${id}/${i}`,'PUT',s.slice(i*CHUNK,(i+1)*CHUNK));
      const meta={name:rec.name,size:rec.size,at:rec.at,n};await rest('meta/'+id,'PUT',meta);cloud[id]=meta}catch(e){}}
  async function download(id){const m=cloud[id];if(!m||m.del)throw new Error('missing');const parts=[];
    for(let i=0;i<m.n;i++){const p=await rest(`data/${id}/${i}`);if(typeof p!=='string')throw new Error('incomplete');parts.push(p)}
    const bin=atob(parts.join(''));const u8=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u8[i]=bin.charCodeAt(i);
    const rec={buf:u8.buffer,name:m.name,size:m.size,at:m.at};await iput(id,rec);local[id]={name:m.name,size:m.size,at:m.at};return rec}
  const family=id=>'nbf-'+id;
  const loaded={};
  function load(id){if(!safeId(id))return Promise.reject(new Error('bad id'));
    return loaded[id]||(loaded[id]=(async()=>{await ready;let rec=await iget(id);if(!rec)rec=await download(id);
      const ff=new FontFace(family(id),rec.buf);await ff.load();document.fonts.add(ff);return true})().catch(e=>{delete loaded[id];throw e}))}
  async function add(file){
    if(!/\.(ttf|otf|woff2?)$/i.test(file.name))throw new Error('Choose a .ttf, .otf or .woff font file.');
    if(file.size>MAX)throw new Error('That font file is over 8 MB.');
    const buf=await file.arrayBuffer();const id=uid();
    try{const ff=new FontFace(family(id),buf.slice(0));await ff.load();document.fonts.add(ff);loaded[id]=Promise.resolve(true)}catch(e){throw new Error('That file is not a font this browser can read.')}
    const name=file.name.replace(/\.(ttf|otf|woff2?)$/i,'').replace(/[_-]+/g,' ').trim().slice(0,40)||'Font',at=Date.now();
    await iput(id,{buf,name,size:file.size,at});local[id]={name,size:file.size,at};upload(id);notify();return id}
  async function remove(id){await idel(id);delete local[id];cloud[id]={del:1,at:Date.now()};
    if(code()){try{await rest('meta/'+id,'PUT',cloud[id]);await rest('data/'+id,'DELETE')}catch(e){}}notify()}
  function list(){const all={};for(const id in cloud)if(!gone(id))all[id]=cloud[id].name;for(const id in local)if(!gone(id))all[id]=local[id].name;
    return Object.keys(all).map(id=>({id,name:String(all[id]||'Font')})).sort((a,b)=>a.name.localeCompare(b.name))}
  document.addEventListener('amcprep:code',()=>{cloud={};ready.then(loadCloud)});
  window.addEventListener('online',()=>{for(const id in local)if(!cloud[id])upload(id)});
  ready.then(()=>{if(code())loadCloud();notify()});
  return{list,family,load,add,remove,onChange:f=>listeners.add(f)};
})();
