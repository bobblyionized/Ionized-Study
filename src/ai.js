/* ====================== Ask AI (Google AI Mode) ======================
   Every revealed solution has an "Ask AI" button. It opens a new tab with Google's AI Mode
   (google.com/search?udm=50) already asked to explain the problem, its choices, and the correct answer.
   Math is converted from LaTeX to plain text so the query reads naturally.                            */
const AI=(()=>{
  if(typeof document==='undefined')return null;
  try{localStorage.removeItem('amcprep.ai')}catch(e){}            // forget any key saved by the old Claude feature

  /* ---------- LaTeX -> readable plain text ---------- */
  const SYM={cdot:'·',times:'×',div:'÷',le:'≤',leq:'≤',ge:'≥',geq:'≥',lt:'<',gt:'>',ne:'≠',neq:'≠',approx:'≈',pm:'±',mp:'∓',
    pi:'π',theta:'θ',alpha:'α',beta:'β',gamma:'γ',delta:'δ',Delta:'Δ',lambda:'λ',mu:'μ',sigma:'σ',phi:'φ',omega:'ω',infty:'∞',
    circ:'°',angle:'∠',triangle:'△',parallel:'∥',perp:'⊥',sim:'~',cong:'≅',in:'∈',cup:'∪',cap:'∩',to:'→',Rightarrow:'⇒',
    implies:'⇒',iff:'⇔',ldots:'...',cdots:'...',dots:'...',mid:'|',equiv:'≡',sum:'Σ',prod:'Π',int:'∫',lfloor:'⌊',rfloor:'⌋',
    lceil:'⌈',rceil:'⌉',emptyset:'∅',neg:'¬',quad:' ',qquad:' ',displaystyle:'',left:'',right:'',big:'',Big:'',bigg:'',
    limits:'',nolimits:'',checkmark:'✓'};
  const grp='\\{((?:[^{}]|\\{(?:[^{}]|\\{[^{}]*\\})*\\})*)\\}';     // a {...} group, up to 3 levels deep
  const G=n=>new RegExp(n,'g');
  function tex(t){
    let s=t.replace(/\\([dt]?frac|binom)\s*([A-Za-z0-9])/g,'\\$1{$2}')        // \frac12 -> \frac{1}2
           .replace(G('\\\\([dt]?frac|binom)\\s*'+grp+'\\s*([A-Za-z0-9])'),'\\$1{$2}{$3}');
    for(let k=0;k<4;k++){
      s=s.replace(G('\\\\[dt]?frac\\s*'+grp+'\\s*'+grp),(m,a,b)=>'('+a+')/('+b+')')
         .replace(G('\\\\binom\\s*'+grp+'\\s*'+grp),(m,a,b)=>'C('+a+','+b+')')
         .replace(G('\\\\sqrt\\s*\\[([^\\]]*)\\]\\s*'+grp),(m,n,a)=>n+'th root of ('+a+')')
         .replace(G('\\\\sqrt\\s*'+grp),(m,a)=>'√('+a+')')
         .replace(G('\\\\overline\\s*'+grp),(m,a)=>a+' (repeating)')
         .replace(G('\\\\(?:text|textbf|mathrm|mathbf|operatorname|mbox|hbox)\\s*'+grp),(m,a)=>a);
    }
    s=s.replace(/\\sqrt\s*(\w)/g,'√$1').replace(/\^\s*\\circ/g,'°')
       .replace(/\\[,;:! ]/g,' ').replace(/\\\\/g,'; ').replace(/\\([{}$%&#_])/g,'$1')
       .replace(/\\([A-Za-z]+)/g,(m,w)=>w in SYM?SYM[w]:w)
       .replace(/\^\{([^{}]*)\}/g,(m,a)=>a.length===1?'^'+a:'^('+a+')').replace(/_\{([^{}]*)\}/g,'_$1')
       .replace(/[{}]/g,'').replace(/\(([A-Za-z0-9.]+)\)\/\(([A-Za-z0-9.]+)\)/g,'$1/$2')
       .replace(/[ \t]{2,}/g,' ');
    return s.trim();
  }
  function plain(html){
    const d=document.createElement('template');                 // inert: nothing inside loads or runs
    d.innerHTML=String(html).replace(/<svg[^>]*aria-label="([^"]*)"[\s\S]*?<\/svg>/gi,' [Graph: $1] ').replace(/<svg[\s\S]*?<\/svg>/gi,' [graph] ')
      .replace(/<br\s*\/?>/gi,'\n').replace(/<\/(p|div|li|tr)>/gi,'\n');
    const t=d.content.textContent.replace(/\\\$/g,'\u0001');             // keep literal dollar signs
    return t.replace(/\$\$([\s\S]*?)\$\$|\$([^$]*)\$/g,(m,a,b)=>tex(a!=null?a:b)).replace(/\u0001/g,'$')
      .replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
  }

  function query(it,chosen){
    const ans='('+L[it.ans]+') '+plain(it.choices[it.ans]);
    const ch=it.choices.map((c,i)=>'('+L[i]+') '+plain(c)).join('   ');
    const tail='\n\nAnswer choices: '+ch+'\n\nThe correct answer is '+ans+'.'+
      (chosen!=null&&chosen!==it.ans?' I chose ('+L[chosen]+') '+plain(it.choices[chosen])+'. What mistake leads to that answer?':'');
    const head=typeof isTextSub==='function'&&isTextSub(it.sub)
      ?'Explain this world history question and why the answer is '+ans+', using the history behind it.\n\nQuestion: '
      :'Explain step by step how to solve this math problem and why the answer is '+ans+'.\n\nProblem: ';
    let q=plain(it.q);const room=1700-head.length-tail.length;  // keep the URL a safe length
    if(q.length>room)q=q.slice(0,Math.max(200,room-3))+'...';
    return head+q+tail;
  }
  function ask(btn){
    const card=btn.closest('.prob'),it=card&&ITEMS.get(card.dataset.id);if(!it)return;
    const wrong=card.querySelector('.ch.wrong');const chosen=wrong?+wrong.dataset.i:null;
    window.open('https://www.google.com/search?udm=50&q='+encodeURIComponent(query(it,chosen)),'_blank','noopener');
  }
  document.addEventListener('click',e=>{const b=e.target.closest('.ai-btn');if(b){e.preventDefault();ask(b)}});
  return{query,plain};
})();
