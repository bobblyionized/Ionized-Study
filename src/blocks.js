/* ====================== Belmont High School blocks (2026-27) ======================
   Sources: BHS "7 Day Rotation Schedule & Times" page, the "BMHS Days of Cycle Calendar 2026-2027"
   spreadsheet, and the Belmont Public Schools 2026-2027 district calendar.
   Every school day gets the next day of a 7-day cycle (Sept 2 is Day 0). G block replaces one period
   each day and the X block meets with a rotating block. Wednesdays use shorter periods.           */
const BHS=(()=>{
  const FIRST='2026-09-02',LAST='2027-06-23';
  const OFF={'09-07':'Labor Day','10-12':"Indigenous Peoples' Day",'11-11':"Veterans' Day",'11-26':'Thanksgiving Recess','11-27':'Thanksgiving Recess',
    '12-23':'Winter Recess','12-24':'Winter Recess','12-25':'Winter Recess','12-28':'Winter Recess','12-29':'Winter Recess','12-30':'Winter Recess',
    '12-31':'Winter Recess','01-01':'Winter Recess','01-18':'Martin Luther King Jr. Day','02-15':'February Recess','02-16':'February Recess',
    '02-17':'February Recess','02-18':'February Recess','02-19':'February Recess','04-19':'April Recess','04-20':'April Recess','04-21':'April Recess',
    '04-22':'April Recess','04-23':'April Recess','05-31':'Memorial Day','06-18':'Juneteenth'};
  const EARLY={'2026-09-02':'First day of school','2026-11-04':'Early release','2026-11-18':'Early release','2026-11-25':'Thanksgiving early release',
    '2027-03-10':'Early release','2027-05-12':'Early release','2027-06-23':'Last day of school'};
  /* letters in periods 1-6 and the X block, by cycle day */
  const ROT={1:'GBCDEF',2:'AGCDEF',3:'ABGDEF',4:'ABCGEF',5:'ABCDGF',6:'ABCDEG',7:'ABCDEF'},XR={1:'B',2:'C',3:'D',4:'E',5:'F',6:'G',7:'A'};
  const T=s=>{const [h,m]=s.split(':').map(Number);return(h<7?h+12:h)*60+m};           // "1:07" -> minutes after midnight (afternoon for 1-6)
  const SLOTS={
    reg:{p:[['7:55','8:48'],['8:52','9:45'],['9:49','10:42'],null,['12:14','1:07'],['1:42','2:35']],x:['1:11','1:38'],
         l1:[['10:46','11:13'],['11:17','12:10']],l2:[['10:46','11:39'],['11:43','12:10']]},     // [lunch, class] / [class, lunch]
    wed:{p:[['7:55','8:35'],['8:39','9:19'],['9:23','10:03'],null,['11:28','12:08'],['12:45','1:25']],x:['12:12','12:41'],
         l1:[['10:07','10:40'],['10:44','11:24']],l2:[['10:07','10:47'],['10:51','11:24']]}};
  const pad=n=>String(n).padStart(2,'0');
  const iso=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
  /* school days in order -> cycle day */
  const CYC={};(()=>{const d=new Date(2026,8,2);let i=0;
    while(iso(d)<=LAST){const k=iso(d),wd=d.getDay();if(wd>0&&wd<6&&!OFF[k.slice(5)]){CYC[k]=i===0?0:((i-1)%7)+1;i++}d.setDate(d.getDate()+1)}})();

  /* the schedule for one date: {kind:'school'|'off'|'weekend'|'summer', day, rows:[{a,b,label,blk}]} */
  function dayInfo(date,lunch){
    const k=iso(date),wd=date.getDay();
    if(k<FIRST||k>LAST)return{kind:'summer',why:k<FIRST?'Summer break':'Summer break (the 2027-28 calendar is not out yet)'};
    if(wd===0||wd===6)return{kind:'weekend',why:'Weekend'};
    if(OFF[k.slice(5)])return{kind:'off',why:OFF[k.slice(5)]};
    const day=CYC[k],wed=wd===3;
    if(EARLY[k]||day===0)return{kind:'school',day,early:EARLY[k]||'Early release',wed,rows:[{a:T('7:55'),b:T('11:10'),label:'Early release schedule',blk:null}]};
    const S=SLOTS[wed?'wed':'reg'],L=ROT[day],rows=[];
    const add=(ab,label,blk)=>rows.push({a:T(ab[0]),b:T(ab[1]),label,blk});
    S.p.forEach((ab,i)=>{
      if(ab){add(ab,L[i]+' block',L[i]);if(i===4)add(S.x,'X block · '+XR[day],XR[day]);return}
      const [p,q]=S[lunch===1?'l1':'l2'];                                   // period 4 holds lunch
      if(lunch===1){add(p,'Lunch',null);add(q,L[3]+' block',L[3])}else{add(p,L[3]+' block',L[3]);add(q,'Lunch',null)}
    });
    return{kind:'school',day,wed,rows};
  }
  /* what is happening at `now`, plus the next block (looking ahead to the next school day if needed) */
  function status(now,lunch){
    const info=dayInfo(now,lunch),base=new Date(now.getFullYear(),now.getMonth(),now.getDate());
    const m=now.getHours()*60+now.getMinutes()+now.getSeconds()/60;
    const at=(day,min)=>{const x=new Date(day);x.setMinutes(min);return x};
    let cur=null,next=null,nextDay=base,nextInfo=null;
    if(info.kind==='school'){cur=info.rows.find(r=>m>=r.a&&m<r.b)||null;next=info.rows.find(r=>r.a>m)||null}
    if(!next){                                                              // look ahead to the next school day
      const d=new Date(base);
      for(let i=1;i<200;i++){d.setDate(d.getDate()+1);const di=dayInfo(d,lunch);
        if(di.kind==='school'){next=di.rows[0];nextDay=new Date(d);nextInfo=di;break}
        if(di.kind==='summer'&&iso(d)>LAST)break}
    }
    return{info,cur,next,nextInfo,m,nextAt:next?at(nextDay,next.a):null,curEnd:cur?at(base,cur.b):null};
  }
  const hm=min=>{const h=Math.floor(min/60),m=Math.round(min%60);return((h+11)%12+1)+':'+pad(m)};
  return{dayInfo,status,hm,iso,CYC};
})();

/* ---------- the Blocks section in the time sheet ---------- */
(()=>{
  if(typeof document==='undefined')return;
  const $=id=>document.getElementById(id);const box=$('tmBlocks');if(!box)return;
  const LK='amcprep.lunch',NK='amcprep.blocknames';
  let lunch=(()=>{try{return+localStorage.getItem(LK)===1?1:2}catch(e){return 2}})();
  let names=(()=>{try{return JSON.parse(localStorage.getItem(NK))||{}}catch(e){return{}}})();
  const esc_=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const nm=r=>r&&r.blk&&names[r.blk]?names[r.blk]:'';
  const label=r=>r?(r.label+(nm(r)?' · '+esc_(nm(r)):'')):'';
  const dur=ms=>{let s=Math.max(0,Math.round(ms/1000));const d=Math.floor(s/86400);s%=86400;const h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=s%60;
    return d?d+'d '+h+'h '+m+'m':h?h+':'+String(m).padStart(2,'0')+':'+String(x).padStart(2,'0'):m+':'+String(x).padStart(2,'0')};
  const DAYS=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

  box.innerHTML=`<div class="bk-head"><div class="tm-tz-h">Blocks</div>
      <div class="bk-seg" role="group" aria-label="Lunch"><button data-l="1" type="button">1st lunch</button><button data-l="2" type="button">2nd lunch</button></div></div>
    <div class="bk-day" id="bkDay"></div><div class="bk-now" id="bkNow"></div><div class="bk-list" id="bkList"></div>
    <details class="bk-names"><summary>Name your blocks</summary><div class="bk-grid">${'ABCDEFG'.split('').map(b=>`<label><span>${b}</span><input data-b="${b}" maxlength="24" placeholder="${b} block" value="${esc_(names[b]||'')}"></label>`).join('')}</div>
      <div class="bk-src">Times and the 7-day cycle come from the Belmont High School 2026–27 schedule and calendar. A snow day can shift the cycle, and early-release days only show dismissal (period times for those days are not published).</div></details>`;
  const segs=box.querySelectorAll('.bk-seg button');
  const setSeg=()=>segs.forEach(b=>b.classList.toggle('on',+b.dataset.l===lunch));setSeg();
  segs.forEach(b=>b.addEventListener('click',()=>{lunch=+b.dataset.l;try{localStorage.setItem(LK,String(lunch))}catch(e){}setSeg();paint(true)}));
  box.querySelectorAll('.bk-grid input').forEach(inp=>inp.addEventListener('input',()=>{const v=inp.value.trim();if(v)names[inp.dataset.b]=v;else delete names[inp.dataset.b];
    try{localStorage.setItem(NK,JSON.stringify(names))}catch(e){}paint(true)}));

  let lastList='';
  function paint(force){
    const now=new Date(),st=BHS.status(now,lunch),inf=st.info;
    const dateTxt=DAYS[now.getDay()];
    $('bkDay').innerHTML=inf.kind==='school'?`${dateTxt} · <b>Day ${inf.day}</b>${inf.day===0?'':' of 7'}${inf.early?' · '+inf.early+' (out at 11:10)':inf.wed?' · Wednesday schedule':''}`
      :`${dateTxt} · <b>No school</b> · ${esc_(inf.why)}`;
    let h='';
    if(st.cur){const left=st.curEnd-now,len=(st.cur.b-st.cur.a)*60000,pct=Math.min(100,Math.max(0,100-left/len*100));
      h+=`<div class="bk-cur"><span class="bk-k">Now</span><b>${label(st.cur)}</b><span class="bk-t">${dur(left)} left</span></div><div class="bk-bar"><i style="width:${pct}%"></i></div>`}
    else if(inf.kind==='school'&&st.m>inf.rows[0].a&&st.nextAt&&st.nextAt.toDateString()===now.toDateString())
      h+=`<div class="bk-cur"><span class="bk-k">Now</span><b>Passing time</b></div>`;
    if(st.next&&st.nextAt){const same=st.nextAt.toDateString()===now.toDateString();
      const when=same?'at '+BHS.hm(st.next.a):DAYS[st.nextAt.getDay()]+', '+st.nextAt.toLocaleDateString(undefined,{month:'short',day:'numeric'})+' at '+BHS.hm(st.next.a)+(st.nextInfo?' (Day '+st.nextInfo.day+')':'');
      h+=`<div class="bk-next"><span class="bk-k">Next</span><b>${label(st.next)}</b><span class="bk-t">in ${dur(st.nextAt-now)}</span><span class="bk-w">${when}</span></div>`}
    else if(!st.cur)h+=`<div class="bk-next"><span class="bk-k">Next</span><b>No more school days on the 2026–27 calendar</b></div>`;
    $('bkNow').innerHTML=h;
    const m=st.m,today=inf.kind==='school'&&m<inf.rows[inf.rows.length-1].b;      // once school is out, show the next school day
    const rows=today?inf.rows:(st.nextInfo?st.nextInfo.rows:[]);
    const list=(today?'':st.nextInfo?`<div class="bk-cap">Next school day · Day ${st.nextInfo.day}${st.nextInfo.wed?' · Wednesday schedule':''}${st.nextInfo.early?' · '+st.nextInfo.early:''}</div>`:'')+rows.map(r=>{
      const cls=today?(m>=r.b?'past':m>=r.a?'cur':''):'';
      return`<div class="bk-row ${cls}${r.blk?'':' lunch'}"><span>${BHS.hm(r.a)}–${BHS.hm(r.b)}</span><b>${r.label}</b><em>${esc_(nm(r))}</em></div>`}).join('');
    if(force||list!==lastList){$('bkList').innerHTML=list;lastList=list}
  }
  window.paintBlocks=paint;
})();
