/* ====================== live tab icon, world-time sheet, saved scroll position ====================== */
(()=>{
  if(typeof document==='undefined')return;
  const $=id=>document.getElementById(id);

  /* ---------- tab icon: a clock showing the real hour and minute ---------- */
  const icon=document.querySelector('link[rel="icon"]');
  function drawIcon(){
    const d=new Date(),m=d.getMinutes(),h=d.getHours()%12+m/60;
    const hand=(deg,len)=>{const a=deg*Math.PI/180;return'M32 32L'+(32+len*Math.sin(a)).toFixed(2)+' '+(32-len*Math.cos(a)).toFixed(2)};
    const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="29" fill="#fbfaf8" stroke="#1d1d1f" stroke-width="3.5"/>'+
      '<g stroke="#1d1d1f" stroke-linecap="round" stroke-width="3"><path d="M32 7v6M32 51v6M7 32h6M51 32h6"/></g>'+
      '<g stroke="#1d1d1f" stroke-linecap="round"><path d="'+hand(h*30,13)+'" stroke-width="4.5"/><path d="'+hand(m*6,20)+'" stroke-width="3.2"/></g>'+
      '<circle cx="32" cy="32" r="3.4" fill="#1d1d1f"/></svg>';
    if(icon)icon.href='data:image/svg+xml,'+encodeURIComponent(svg);
    setTimeout(drawIcon,60000-(Date.now()%60000)+50);             // redraw right after the next minute ticks over
  }
  drawIcon();
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&icon)drawIcon()});

  /* ---------- clicking the big clock: local time and UTC ---------- */
  const sheet=$('tmTimeSheet'),clock=$('tmClock');
  if(sheet&&clock&&typeof TM!=='undefined'){
    let tick=null;
    const zone=Intl.DateTimeFormat().resolvedOptions().timeZone||'Local time';
    const off=d=>{const o=-d.getTimezoneOffset(),s=o<0?'−':'+',a=Math.abs(o);return'UTC'+s+Math.floor(a/60)+(a%60?':'+String(a%60).padStart(2,'0'):'')};
    const fmt=(d,tz,h12)=>({
      t:d.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit',second:'2-digit',hour12:h12,timeZone:tz}),
      d:d.toLocaleDateString(undefined,{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:tz})});
    function paint(){
      if(!sheet.classList.contains('open')){clearInterval(tick);tick=null;return}
      const d=new Date(),l=fmt(d,undefined,undefined),u=fmt(d,'UTC',false);
      $('tmLocT').textContent=l.t;$('tmLocD').textContent=l.d;$('tmLocZ').textContent=zone.replace(/_/g,' ')+' · '+off(d);
      $('tmUtcT').textContent=u.t;$('tmUtcD').textContent=u.d;
    }
    const open=()=>{TM.openSheet(sheet);paint();clearInterval(tick);
      setTimeout(()=>{paint();tick=setInterval(paint,1000)},1000-(Date.now()%1000))};   // tick on the second
    clock.addEventListener('click',open);
    clock.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open()}});
    $('tmTimeClose').addEventListener('click',()=>TM.closeSheet());
  }

  /* ---------- remember how far down each page was scrolled ---------- */
  try{history.scrollRestoration='manual'}catch(e){}                   // we restore positions ourselves
  const SK='amcprep.scroll';let pos={};try{pos=JSON.parse(localStorage.getItem(SK))||{}}catch(e){}
  let restoring=0,saveT=null,userMoved=false;
  const key=()=>location.hash||'';
  function save(k,y){saveT=null;k=k||key();if(!k||k==='#/'||document.body.classList.contains('landing'))return;
    y=Math.round(y==null?window.scrollY:y);if(y>40)pos[k]=y;else delete pos[k];
    const ks=Object.keys(pos);if(ks.length>300)delete pos[ks[0]];      // keep the list small
    try{localStorage.setItem(SK,JSON.stringify(pos))}catch(e){}}
  window.addEventListener('scroll',()=>{if(restoring)return;const k=key(),y=window.scrollY;clearTimeout(saveT);saveT=setTimeout(()=>save(k,y),250)},{passive:true});
  ['wheel','touchstart','keydown','mousedown'].forEach(ev=>window.addEventListener(ev,()=>{userMoved=true},{passive:true}));
  window.restoreScroll=function(){
    const y=pos[key()];if(!y)return;userMoved=false;restoring++;
    const html=document.documentElement;html.style.overflowAnchor='none';   // pin the pixel offset while layout settles
    const go=()=>{if(!userMoved)window.scrollTo(0,y)};
    go();requestAnimationFrame(go);setTimeout(go,120);setTimeout(go,450);
    setTimeout(()=>{go();restoring--;if(!restoring)html.style.overflowAnchor=''},900);   // math and graphs can still change heights
  };
  window.addEventListener('pagehide',()=>{if(!restoring)save()});
  if(location.hash&&!document.body.classList.contains('landing'))restoreScroll();   // the first route() ran before this file loaded
})();
