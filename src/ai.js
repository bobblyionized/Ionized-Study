/* ====================== Claude AI explanations ======================
   Clicking the clock on the timer menu opens a sheet for a Claude API key. The key is stored only in
   this browser's localStorage (never in the synced data). Once a test request succeeds, every revealed
   solution gets an "AI Explain" button that streams a fresh explanation from the Messages API.       */
const AI=(()=>{
  if(typeof document==='undefined'||!document.getElementById('tmAiSheet'))return null;
  const LK='amcprep.ai',API='https://api.anthropic.com/v1/messages';
  const $=id=>document.getElementById(id);
  let cfg=(()=>{try{return JSON.parse(localStorage.getItem(LK))||{}}catch(e){return{}}})();
  const save=()=>{try{localStorage.setItem(LK,JSON.stringify(cfg))}catch(e){}};
  const ready=()=>!!(cfg.key&&cfg.ok);
  function apply(){document.body.classList.toggle('ai-on',ready());$('tmClock').classList.toggle('ai',ready());$('tmAiDot').textContent=ready()?'AI on':'Claude AI'}

  function headers(key){return{'content-type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'}}
  async function errText(r){
    let m='';try{const j=await r.json();m=(j.error&&j.error.message)||''}catch(e){}
    if(r.status===401)return'That key was rejected. Check that it was copied completely.';
    if(r.status===403)return'This key is not allowed to use the API'+(m?': '+m:'.');
    if(r.status===404)return'This key cannot use the selected model. Try another model.';
    if(r.status===429)return'Rate limit reached. Wait a moment and try again.';
    if(r.status===529||r.status===503)return'Claude is overloaded right now. Try again in a minute.';
    if(r.status===400&&/credit/i.test(m))return'Your account has no API credits left.';
    return'Error '+r.status+(m?': '+m:'');
  }

  /* ---------- key sheet ---------- */
  function state(cls,txt){const el=$('tmAiState');el.className='tm-aistate'+(cls?' '+cls:'');el.textContent=txt||' '}
  function openSheet(){
    $('tmAiKey').value=cfg.key||'';$('tmAiModel').value=cfg.model||'claude-opus-5-5';
    $('tmAiRemove').disabled=!cfg.key;
    state(ready()?'ok':'',ready()?'✓ Key verified. AI Explain is on.':'');
    TM.openSheet($('tmAiSheet'));
  }
  async function verify(){
    const key=$('tmAiKey').value.trim(),model=$('tmAiModel').value,btn=$('tmAiSave');
    if(!key){state('bad','Paste your Claude API key first.');TM.sfx.invalid();return}
    btn.disabled=true;state('','Checking the key…');
    try{
      const r=await fetch(API,{method:'POST',headers:headers(key),body:JSON.stringify({model,max_tokens:1,messages:[{role:'user',content:'Hi'}]})});
      if(!r.ok){state('bad',await errText(r));TM.sfx.invalid();btn.disabled=false;return}
      cfg={key,model,ok:true};save();apply();state('ok','✓ Key verified. AI Explain is on.');$('tmAiRemove').disabled=false;TM.sfx.complete();
      setTimeout(()=>TM.closeSheet(true),900);
    }catch(e){state('bad','Could not reach Claude. Check your connection and try again.');TM.sfx.invalid()}
    btn.disabled=false;
  }
  const clock=$('tmClock');
  clock.addEventListener('click',openSheet);
  clock.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openSheet()}});
  $('tmAiSave').addEventListener('click',verify);
  $('tmAiKey').addEventListener('keydown',e=>{if(e.key==='Enter')verify()});
  $('tmAiModel').addEventListener('change',()=>{if(cfg.key&&$('tmAiKey').value.trim()===cfg.key){cfg.model=$('tmAiModel').value;save()}});
  $('tmAiRemove').addEventListener('click',()=>{cfg={};save();apply();$('tmAiKey').value='';$('tmAiRemove').disabled=true;state('','Key removed from this device.');TM.sfx.end()});

  /* ---------- turning a problem into plain text ---------- */
  function plain(html){
    const d=document.createElement('div');
    d.innerHTML=String(html).replace(/<svg[^>]*aria-label="([^"]*)"[\s\S]*?<\/svg>/gi,' [Graph: $1] ').replace(/<br\s*\/?>/gi,'\n').replace(/<\/(p|div|li|tr)>/gi,'\n');
    return d.textContent.replace(/\n{3,}/g,'\n\n').trim();
  }
  function prompt(it,chosen){
    const ch=it.choices.map((c,i)=>'('+L[i]+') '+plain(c)).join('\n');
    let u='Problem:\n'+plain(it.q)+'\n\nAnswer choices:\n'+ch+'\n\nCorrect answer: ('+L[it.ans]+') '+plain(it.choices[it.ans]);
    if(chosen!=null&&chosen!==it.ans)u+='\n\nThe student chose ('+L[chosen]+') '+plain(it.choices[chosen])+'. After the solution, add a short section explaining the most likely mistake that leads to that choice.';
    u+='\n\nReference solution from the answer key (it may be brief):\n'+plain(it.sol);
    return u;
  }
  const SYSTEM='You are an expert, encouraging math tutor for students preparing for the AMC 10/12 and for precalculus. '+
    'Explain how to solve the given multiple-choice problem so that a strong high-school student can follow every single step. '+
    'The correct answer is given to you; your explanation must arrive at exactly that answer. '+
    'Start with a one or two sentence "Key idea". Then work through numbered steps, showing every computation and saying why each step is valid. '+
    'Finish with a short "Check" that confirms the answer (for example by substituting back or estimating) and one "Takeaway" sentence the student can reuse on similar problems. '+
    'Format in Markdown. Write ALL math in LaTeX using $...$ for inline math and $$...$$ for displayed equations; never use \\( \\) or \\[ \\]. '+
    'Do not restate the problem and do not add a preamble.';

  /* ---------- tiny Markdown renderer that leaves LaTeX alone ---------- */
  function md(src){
    const math=[];
    let s=src.replace(/\\\[([\s\S]*?)\\\]/g,(m,x)=>'$$'+x+'$$').replace(/\\\(([\s\S]*?)\\\)/g,(m,x)=>'$'+x+'$');
    s=s.replace(/\$\$[\s\S]*?\$\$|\$[^$\n]+?\$/g,m=>{math.push(m);return'\u0000'+(math.length-1)+'\u0000'});
    s=s.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
    const inline=t=>t.replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/(^|[^*])\*(?!\s)([^*\n]+?)\*(?!\*)/g,'$1<i>$2</i>').replace(/`([^`]+)`/g,'<code>$1</code>');
    const out=[];let list=null,para=[];
    const flushP=()=>{if(para.length){out.push('<p>'+inline(para.join(' '))+'</p>');para=[]}};
    const flushL=()=>{if(list){out.push('<'+list.t+'>'+list.items.map(x=>'<li>'+inline(x)+'</li>').join('')+'</'+list.t+'>');list=null}};
    for(const raw of s.split('\n')){
      const line=raw.trim();let m;
      if(!line){flushP();flushL();continue}
      if((m=line.match(/^#{1,6}\s+(.*)$/))){flushP();flushL();out.push('<h4>'+inline(m[1])+'</h4>');continue}
      if((m=line.match(/^[-*•]\s+(.*)$/))){flushP();if(!list||list.t!=='ul'){flushL();list={t:'ul',items:[]}}list.items.push(m[1]);continue}
      if((m=line.match(/^\d+[.)]\s+(.*)$/))){flushP();if(!list||list.t!=='ol'){flushL();list={t:'ol',items:[]}}list.items.push(m[1]);continue}
      if(/^(-{3,}|\*{3,})$/.test(line)){flushP();flushL();continue}
      if(list&&/^\s{2,}/.test(raw)){list.items[list.items.length-1]+=' '+line;continue}
      flushL();para.push(line);
    }
    flushP();flushL();
    return out.join('').replace(/\u0000(\d+)\u0000/g,(m,i)=>math[+i].replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])));
  }

  /* ---------- streaming an explanation ---------- */
  async function explain(btn){
    const card=btn.closest('.prob'),it=ITEMS.get(card.dataset.id);if(!it)return;
    const body=card.querySelector('.solbody'),det=card.querySelector('.sol details');det.open=true;
    if(card._ai&&!card._aiBusy){                                   // toggle between AI and original
      const showAI=!body.classList.contains('ai');
      body.innerHTML=showAI?card._ai:card._orig;body.classList.toggle('ai',showAI);
      btn.textContent=showAI?'Original solution':'✦ AI Explain';renderMath(body);return;
    }
    if(!ready()){alert('Add a Claude API key first: click the clock on the timer menu.');return}
    card._orig=card._orig||body.innerHTML;card._aiBusy=true;btn.disabled=true;btn.textContent='Explaining…';
    const wrong=card.querySelector('.ch.wrong');const chosen=wrong?+wrong.dataset.i:null;
    body.classList.add('ai');body.innerHTML='<div class="ai-tag">✦ Claude explains</div><div class="ai-txt ai-cursor">Thinking…</div>';
    const txtEl=body.querySelector('.ai-txt');let text='',raf=0;
    const paint=()=>{raf=0;txtEl.innerHTML=md(text)||'Thinking…'};
    try{
      const r=await fetch(API,{method:'POST',headers:headers(cfg.key),body:JSON.stringify({model:cfg.model||'claude-opus-5-5',max_tokens:2500,stream:true,system:SYSTEM,messages:[{role:'user',content:prompt(it,chosen)}]})});
      if(!r.ok)throw new Error(await errText(r));
      const rd=r.body.getReader(),dec=new TextDecoder();let buf='';
      for(;;){
        const {done,value}=await rd.read();if(done)break;
        buf+=dec.decode(value,{stream:true});let i;
        while((i=buf.indexOf('\n'))>=0){
          const line=buf.slice(0,i).trim();buf=buf.slice(i+1);
          if(!line.startsWith('data:'))continue;
          let ev;try{ev=JSON.parse(line.slice(5))}catch(e){continue}
          if(ev.type==='content_block_delta'&&ev.delta&&ev.delta.type==='text_delta'){text+=ev.delta.text;if(!raf)raf=requestAnimationFrame(paint)}
          else if(ev.type==='error')throw new Error((ev.error&&ev.error.message)||'The stream was interrupted.');
        }
      }
      if(raf)cancelAnimationFrame(raf);paint();txtEl.classList.remove('ai-cursor');renderMath(body);
      if(!text.trim())throw new Error('Claude returned an empty explanation.');
      card._ai=body.innerHTML;btn.textContent='Original solution';
    }catch(e){
      body.classList.remove('ai');body.innerHTML=card._orig+'<p class="ai-err">AI Explain failed: '+esc(e.message||'Could not reach Claude.')+'</p>';renderMath(body);
      btn.textContent='✦ AI Explain';
      if(/rejected/.test(e.message||'')){cfg.ok=false;save();apply()}
    }
    card._aiBusy=false;btn.disabled=false;
  }
  document.addEventListener('click',e=>{const b=e.target.closest('.ai-btn');if(b&&!b.disabled){e.preventDefault();explain(b)}});

  apply();
  return{get ready(){return ready()}};
})();
