/* ====================== cloud sync (Firebase Realtime Database, REST) ======================
   Each device holds a code. Everything lives under /codes/<CODE>:
     q/<problemId>   answers        pr/<subtopic>  practice stats
     mock/m<time>    mock results   hist/h<start>  study sessions
   Every change runs a three-way merge (local, server, last-synced snapshot) and PATCHes only
   the entries that differ, so two devices never overwrite each other's new work.          */
const SYNC=(()=>{
  if(typeof document==='undefined'||!document.getElementById('tmCodeBox'))return null;
  const DB='https://ionized-study-and-shi-default-rtdb.firebaseio.com';
  const LK='amcprep.sync', ALPH='ABCDEFGHJKMNPQRSTUVWXYZ23456789', CATS=['q','pr','mock','hist'];
  const $=id=>document.getElementById(id);
  const empty=()=>({q:{},pr:{},mock:{},hist:{}});
  let st=(()=>{try{return JSON.parse(localStorage.getItem(LK))||{}}catch(e){return{}}})();
  if(!st.last)st.last=empty();
  const persist=()=>{try{localStorage.setItem(LK,JSON.stringify(st))}catch(e){}};
  const fmt=c=>c?c.slice(0,4)+'-'+c.slice(4):'········';
  const norm=s=>String(s||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
  const J=x=>x===undefined||x===null?undefined:JSON.stringify(x);

  async function api(path,method,body){
    const r=await fetch(DB+'/codes/'+path+'.json',{method:method||'GET',cache:'no-store',
      headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
    if(!r.ok)throw new Error('HTTP '+r.status);
    return r.json();
  }

  /* ---------- local data <-> keyed string maps ---------- */
  function localMap(){
    const o=empty();
    for(const k in PROG.q)o.q[k]=J(PROG.q[k]);
    for(const k in PROG.pr)o.pr[k]=J(PROG.pr[k]);
    for(const m of PROG.mock)o.mock['m'+m.at]=J(m);
    for(const h of TM.getHist())o.hist['h'+h.start]=J(h);
    return o;
  }
  function applyLocal(M){
    const val=c=>Object.values(M[c]).map(s=>JSON.parse(s));
    PROG.q={};for(const k in M.q)PROG.q[k]=JSON.parse(M.q[k]);
    PROG.pr={};for(const k in M.pr)PROG.pr[k]=JSON.parse(M.pr[k]);
    PROG.mock=val('mock').sort((a,b)=>a.at-b.at);
    try{localStorage.setItem(KEY,JSON.stringify(PROG))}catch(e){}
    TM.setHist(val('hist').sort((a,b)=>a.start-b.start));
  }
  function remoteMap(d){const o=empty();d=d||{};for(const c of CATS){const s=d[c]||{};for(const k in s)o[c][k]=J(s[k])}return o}
  function merge3(L,R,B){
    const out=empty();
    for(const c of CATS){
      const keys=new Set([...Object.keys(L[c]),...Object.keys(R[c]),...Object.keys(B[c]||{})]);
      for(const k of keys){
        const l=L[c][k],r=R[c][k],b=(B[c]||{})[k];
        const v=l===b?r:r===b?l:(l!==undefined?l:r);   // changed on one side wins; both changed: keep local
        if(v!==undefined)out[c][k]=v;
      }
    }
    return out;
  }
  const same=(a,b)=>CATS.every(c=>{const ka=Object.keys(a[c]),kb=Object.keys(b[c]);return ka.length===kb.length&&ka.every(k=>a[c][k]===b[c][k])});

  /* ---------- status UI ---------- */
  function status(kind,text){const el=$('tmSync');el.className='tm-sync'+(kind?' '+kind:'');el.querySelector('b').textContent=text}
  let hidden=(()=>{try{return localStorage.getItem('amcprep.codeHidden')==='1'}catch(e){return false}})();
  function showCode(){
    $('tmCode').textContent=hidden?'••••-••••':fmt(st.code);$('tmCodeCur').textContent=hidden?'••••-••••':fmt(st.code);
    $('tmCodeBox').classList.toggle('hid',hidden);$('tmCode').title=hidden?'Code hidden':'Click to copy';
    const hb=$('tmCodeHide');hb.textContent=hidden?'Show':'Hide';hb.setAttribute('aria-pressed',String(hidden));
  }

  /* ---------- reconcile: pull, merge, push the difference ---------- */
  let busy=false,again=false,debounce=null;
  async function reconcile(){
    if(!st.code)return;
    if(busy){again=true;return}
    busy=true;status('','Syncing…');
    try{
      const code=st.code;
      const d=await api(code);
      if(code!==st.code)throw new Error('code changed');
      const R=remoteMap(d),L=localMap(),M=merge3(L,R,st.last);
      if(!same(M,L)){applyLocal(M);refreshView()}
      const patch={};
      for(const c of CATS){
        for(const k in M[c])if(M[c][k]!==R[c][k])patch[c+'/'+k]=JSON.parse(M[c][k]);
        for(const k in R[c])if(!(k in M[c]))patch[c+'/'+k]=null;
      }
      if(!d||!d.created)patch.created=Date.now();
      if(Object.keys(patch).length){patch.updated=Date.now();await api(code,'PATCH',patch)}
      st.last=M;persist();status('ok','Synced');
    }catch(e){status('off',navigator.onLine===false?'Offline':'Not synced')}
    busy=false;
    if(again){again=false;reconcile()}
  }
  function changed(){clearTimeout(debounce);debounce=setTimeout(reconcile,700)}

  /* ---------- live updates from other devices ---------- */
  let es=null,pull=null;
  function listen(){
    if(es)es.close();
    if(!st.code||typeof EventSource==='undefined')return;
    es=new EventSource(DB+'/codes/'+st.code+'.json');
    const onEvt=()=>{clearTimeout(pull);pull=setTimeout(reconcile,400)};
    es.addEventListener('put',onEvt);es.addEventListener('patch',onEvt);
    es.onerror=()=>status('off','Reconnecting…');
  }

  /* re-render the current page so new data shows, without interrupting a practice session or mock test */
  function refreshView(){
    const h=location.hash;
    if(/^#\/(home|t\/[^/]+|s\/[^/]+\/(lesson|set))?$/.test(h)&&h!==''&&h!=='#/'){const y=window.scrollY;route();window.scrollTo(0,y)}
  }

  /* ---------- codes ---------- */
  function randomCode(){const a=new Uint32Array(8);crypto.getRandomValues(a);return Array.from(a,x=>ALPH[x%ALPH.length]).join('')}
  async function newCode(){
    for(let i=0;i<6;i++){const c=randomCode();try{const ex=await api(c+'/created');if(ex===null)return c}catch(e){return c}}
    return randomCode();
  }
  async function setCode(raw){
    const c=norm(raw);
    if(c.length!==8)return 'Codes are 8 letters and numbers, like K7QH-3XPM.';
    if(c===st.code)return 'That is already this device’s code.';
    let d;
    try{d=await api(c)}catch(e){return 'Could not reach the server. Check your connection and try again.'}
    if(!d||!d.created)return 'No saved progress was found for that code.';
    clearTimeout(debounce);
    if(busy){await new Promise(r=>{const t=setInterval(()=>{if(!busy){clearInterval(t);r()}},100)})}
    await reconcile();                       // save anything pending under the old code first
    st.code=c;st.last=remoteMap(d);persist();
    applyLocal(st.last);refreshView();showCode();listen();status('ok','Synced');
    return null;
  }

  /* ---------- UI wiring ---------- */
  $('tmCodeHide').addEventListener('click',()=>{hidden=!hidden;try{localStorage.setItem('amcprep.codeHidden',hidden?'1':'0')}catch(e){}showCode();TM.sfx.tap()});
  $('tmCode').addEventListener('click',async()=>{
    if(hidden)return;
    try{await navigator.clipboard.writeText(fmt(st.code));const b=$('tmSync').querySelector('b'),t=b.textContent;b.textContent='Copied!';setTimeout(()=>{b.textContent=t},1200)}catch(e){}
  });
  $('tmSetCode').addEventListener('click',()=>{$('tmCodeIn').value='';$('tmCodeHint').textContent=' ';$('tmCodeHint').classList.remove('err');showCode();TM.openSheet($('tmCodeSheet'));setTimeout(()=>$('tmCodeIn').focus(),350)});
  $('tmCodeCancel').addEventListener('click',()=>TM.closeSheet());
  $('tmCodeIn').addEventListener('input',e=>{const c=norm(e.target.value).slice(0,8);e.target.value=c.length>4?c.slice(0,4)+'-'+c.slice(4):c});
  $('tmCodeIn').addEventListener('keydown',e=>{if(e.key==='Enter')$('tmCodeGo').click()});
  $('tmCodeGo').addEventListener('click',async()=>{
    const btn=$('tmCodeGo'),hint=$('tmCodeHint');btn.disabled=true;hint.classList.remove('err');hint.textContent='Checking…';
    const err=await setCode($('tmCodeIn').value);btn.disabled=false;
    if(err){hint.textContent=err;hint.classList.add('err');TM.sfx.invalid()}
    else{hint.textContent=' ';TM.closeSheet(true);TM.sfx.complete()}
  });
  window.addEventListener('online',()=>reconcile());
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)changed()});

  /* ---------- boot ---------- */
  showCode();
  (async()=>{
    if(!st.code){st.code=await newCode();st.last=empty();persist();showCode()}
    listen();reconcile();
  })();
  return{changed,reconcile,get code(){return st.code}};
})();
