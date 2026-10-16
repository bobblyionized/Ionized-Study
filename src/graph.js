/* ====================== Graph tab: a Desmos-style graphing calculator ======================
   Type expressions on the left, see them graphed on the right. Supports y=f(x), x=g(y), f(x)=… definitions,
   sliders for free variables, implicit equations, inequalities, polar r=f(θ), parametric (x(t),y(t)), points,
   piecewise {cond: value, …} and domain restrictions, tracing, and points of interest (zeros, extrema, intersections). */
const GraphCalc=(()=>{
  const COLORS=['#c74440','#2d70b3','#388c46','#6042a6','#fa7e19','#000000'];
  const SK='amcprep.graph';

  /* ---------------- parser ---------------- */
  const FUNCS={sin:1,cos:1,tan:1,sec:1,csc:1,cot:1,arcsin:1,arccos:1,arctan:1,asin:1,acos:1,atan:1,sinh:1,cosh:1,tanh:1,
    sqrt:1,cbrt:1,abs:1,ln:1,log:1,exp:1,floor:1,ceil:1,round:1,sign:1,min:2,max:2,mod:2,nCr:2,nPr:2,gcd:2,lcm:2};
  const CONSTS={pi:1,e:1,theta:1,tau:1};
  const NAMES=Object.keys(FUNCS).concat(Object.keys(CONSTS)).sort((a,b)=>b.length-a.length);
  class PErr extends Error{}
  function lex(src){
    const s=src.replace(/π/g,' pi ').replace(/θ/g,' theta ').replace(/τ/g,' tau ').replace(/√/g,' sqrt ').replace(/·|×/g,'*').replace(/−/g,'-')
      .replace(/≤/g,'<=').replace(/≥/g,'>=').replace(/\*\*/g,'^');
    const out=[];let i=0;
    while(i<s.length){
      const c=s[i];
      if(/\s/.test(c)){i++;continue}
      if(/[0-9.]/.test(c)){let j=i;while(j<s.length&&/[0-9.]/.test(s[j]))j++;const t=s.slice(i,j);if((t.match(/\./g)||[]).length>1||t==='.')throw new PErr('Invalid number "'+t+'"');
        out.push({k:'num',v:parseFloat(t)});i=j;continue}
      if(/[A-Za-z]/.test(c)){let j=i;while(j<s.length&&/[A-Za-z]/.test(s[j]))j++;const w=s.slice(i,j);
        let p=0;while(p<w.length){const n=NAMES.find(n=>w.startsWith(n,p));if(n){out.push({k:'id',v:n});p+=n.length}else{out.push({k:'id',v:w[p]});p++}}   // "xy" = x·y
        i=j;continue}
      const two=s.slice(i,i+2);if(two==='<='||two==='>='){out.push({k:'op',v:two});i+=2;continue}
      if('+-*/^(),|=<>!{}:_[]'.includes(c)){out.push({k:'op',v:c});i++;continue}
      throw new PErr('Unexpected "'+c+'"');
    }
    return out;
  }
  function parse(src){
    const tk=lex(src);let p=0,absDepth=0;
    const peek=()=>tk[p],is=v=>tk[p]&&tk[p].k==='op'&&tk[p].v===v,eat=v=>{if(!is(v))throw new PErr(v===')'?'Missing ")"':v==='|'?'Missing "|"':'Expected "'+v+'"');p++};
    const REL=['=','<','>','<=','>='];
    function relation(){
      const a=expr();if(tk[p]&&tk[p].k==='op'&&REL.includes(tk[p].v)){
        const ops=[],xs=[a];while(tk[p]&&tk[p].k==='op'&&REL.includes(tk[p].v)){ops.push(tk[p++].v);xs.push(expr())}
        return{t:'rel',ops,xs}}
      return a;
    }
    function list(){const xs=[relation()];while(is(',')){p++;xs.push(relation())}return xs}
    function expr(){let a=term();while(is('+')||is('-')){const o=tk[p++].v;a={t:'op',o,a,b:term()}}return a}
    const startsPrimary=()=>{const t=peek();if(!t)return false;if(t.k==='num'||t.k==='id')return true;return t.k==='op'&&(t.v==='('||t.v==='{'||(t.v==='|'&&absDepth===0)||t.v==='[')};
    function term(){let a=unary();
      for(;;){if(is('*')||is('/')){const o=tk[p++].v;a={t:'op',o,a,b:unary()}}
        else if(startsPrimary()){a={t:'op',o:'*',a,b:power(),imp:1}}
        else break}
      return a}
    function unary(){if(is('-')){p++;return{t:'neg',a:unary()}}if(is('+')){p++;return unary()}return power()}
    function power(){let b=postfix();if(is('^')){p++;return{t:'op',o:'^',a:b,b:unary()}}return b}
    function postfix(){let a=primary();while(is('!')){p++;a={t:'fact',a}}return a}
    function args(){eat('(');const xs=[expr()];while(is(',')){p++;xs.push(expr())}eat(')');return xs}
    function primary(){
      const t=peek();if(!t)throw new PErr('Incomplete expression');
      if(t.k==='num'){p++;return{t:'num',v:t.v}}
      if(t.k==='id'){
        p++;const n=t.v;
        if(FUNCS[n]){
          let base=null,pw=null;
          if(n==='log'&&is('_')){p++;base=is('(')?(p++,(()=>{const e=expr();eat(')');return e})()):primary()}
          if(is('^')){p++;pw=is('(')?(p++,(()=>{const e=expr();eat(')');return e})()):(is('-')?(p++,{t:'neg',a:primary()}):primary())}   // sin^2 x
          let as;
          if(is('('))as=args();else as=[power()];
          let node={t:'fn',n,args:as};if(base)node={t:'fn',n:'logb',args:[as[0],base]};
          return pw?{t:'op',o:'^',a:node,b:pw}:node;
        }
        if(CONSTS[n])return{t:'var',n};
        if(is('(')&&GraphCalc._userFns&&GraphCalc._userFns.has(n)){return{t:'call',n,args:args()}}
        return{t:'var',n};
      }
      if(t.v==='('){p++;const xs=[expr()];while(is(',')){p++;xs.push(expr())}eat(')');return xs.length>1?{t:'tuple',xs}:{t:'par',a:xs[0]}}
      if(t.v==='|'){p++;absDepth++;const a=expr();absDepth--;eat('|');return{t:'fn',n:'abs',args:[a]}}
      if(t.v==='{'){p++;const cases=[];let def=null;
        if(is('}'))throw new PErr('Empty { }');
        for(;;){const c=relation();if(is(':')){p++;cases.push([c,expr()])}else{if(c.t==='rel')cases.push([c,{t:'num',v:1}]);else def=c}
          if(is(',')){p++;continue}eat('}');break}
        return{t:'pw',cases,def}}
      throw new PErr(t.v===')'?'Unexpected ")"':'Unexpected "'+t.v+'"');
    }
    const xs=list();if(p<tk.length)throw new PErr('Unexpected "'+tk[p].v+'"');
    return xs.length>1?{t:'tuple',xs,top:1}:xs[0];
  }

  /* ---------------- free variables / LaTeX / codegen ---------------- */
  function vars(n,set=new Set()){if(!n)return set;
    if(n.t==='var')set.add(n.n);
    for(const k of ['a','b'])if(n[k])vars(n[k],set);
    for(const k of ['xs','args'])if(n[k])n[k].forEach(c=>vars(c,set));
    if(n.t==='pw'){n.cases.forEach(([c,e])=>{vars(c,set);vars(e,set)});vars(n.def,set)}
    return set}
  function calls(n,set=new Set()){if(!n)return set;if(n.t==='call')set.add(n.n);
    for(const k of ['a','b'])if(n[k])calls(n[k],set);for(const k of ['xs','args'])if(n[k])n[k].forEach(c=>calls(c,set));
    if(n.t==='pw'){n.cases.forEach(([c,e])=>{calls(c,set);calls(e,set)});calls(n.def,set)}return set}
  const PREC={'+':1,'-':1,'*':2,'/':2,'^':3};
  const LTX={sin:'\\sin',cos:'\\cos',tan:'\\tan',sec:'\\sec',csc:'\\csc',cot:'\\cot',arcsin:'\\arcsin',arccos:'\\arccos',arctan:'\\arctan',asin:'\\arcsin',
    acos:'\\arccos',atan:'\\arctan',sinh:'\\sinh',cosh:'\\cosh',tanh:'\\tanh',ln:'\\ln',log:'\\log',exp:'\\exp',min:'\\min',max:'\\max',gcd:'\\gcd'};
  const vtex=n=>n==='pi'?'\\pi':n==='theta'?'\\theta':n==='tau'?'\\tau':n;
  function tex(n,parentPrec=0){
    const wrap=(s,pr)=>pr<parentPrec?'\\left('+s+'\\right)':s;
    switch(n.t){
      case 'num':return String(n.v);
      case 'var':return vtex(n.n);
      case 'par':return'\\left('+tex(n.a)+'\\right)';
      case 'neg':return wrap('-'+tex(n.a,2.5),2);
      case 'fact':return tex(n.a,4)+'!';
      case 'tuple':return n.top?n.xs.map(x=>tex(x)).join(',\\ '):'\\left('+n.xs.map(x=>tex(x)).join(',')+'\\right)';
      case 'rel':{let s=tex(n.xs[0]);n.ops.forEach((o,i)=>{s+={'=':'=','<':'<','>':'>','<=':'\\le ','>=':'\\ge '}[o]+tex(n.xs[i+1])});return s}
      case 'pw':return'\\left\\{'+n.cases.map(([c,e])=>tex(c)+(e.t==='num'&&e.v===1&&c.t==='rel'&&!n.def&&n.cases.length===1?'':':'+tex(e))).join(',')+(n.def?','+tex(n.def):'')+'\\right\\}';
      case 'call':return n.n+'\\left('+n.args.map(a=>tex(a)).join(',')+'\\right)';
      case 'fn':{
        const a=n.args;
        if(n.n==='sqrt')return'\\sqrt{'+tex(a[0])+'}';
        if(n.n==='cbrt')return'\\sqrt[3]{'+tex(a[0])+'}';
        if(n.n==='abs')return'\\left|'+tex(a[0])+'\\right|';
        if(n.n==='floor')return'\\left\\lfloor '+tex(a[0])+'\\right\\rfloor ';
        if(n.n==='ceil')return'\\left\\lceil '+tex(a[0])+'\\right\\rceil ';
        if(n.n==='logb')return'\\log_{'+tex(a[1])+'}\\left('+tex(a[0])+'\\right)';
        if(n.n==='nCr')return'\\binom{'+tex(a[0])+'}{'+tex(a[1])+'}';
        const name=LTX[n.n]||'\\operatorname{'+n.n+'}';
        return name+'\\left('+a.map(x=>tex(x)).join(',')+'\\right)';
      }
      case 'op':{
        const pr=PREC[n.o];
        if(n.o==='/'){const un=x=>x.t==='par'?x.a:x;return'\\dfrac{'+tex(un(n.a))+'}{'+tex(un(n.b))+'}'}
        if(n.o==='^'){const base=n.a.t==='fn'&&!['sqrt','abs','floor','ceil','cbrt'].includes(n.a.n)?'\\left('+tex(n.a)+'\\right)':tex(n.a,4);return base+'^{'+tex(n.b)+'}'}
        if(n.o==='*'){const l=tex(n.a,2),r=tex(n.b,2.5);
          const needDot=!n.imp||(/[0-9.]$/.test(l)&&/^[0-9.]/.test(r));return wrap(l+(needDot?'\\cdot ':'')+r,2)}
        return wrap(tex(n.a,pr)+n.o+tex(n.b,pr+.5),pr);
      }
    }
    return'';
  }
  function code(n,P){                 // P: map of variable name -> JS expression
    const c=x=>code(x,P);
    switch(n.t){
      case 'num':return'('+n.v+')';
      case 'var':if(n.n in P)return P[n.n];if(n.n==='pi')return'Math.PI';if(n.n==='tau')return'(2*Math.PI)';if(n.n==='e')return'Math.E';
        return'S.v['+JSON.stringify(n.n)+']';
      case 'par':return c(n.a);
      case 'neg':return'(-'+c(n.a)+')';
      case 'fact':return'S.fact('+c(n.a)+')';
      case 'op':return n.o==='^'?'S.pow('+c(n.a)+','+c(n.b)+')':'('+c(n.a)+n.o+c(n.b)+')';
      case 'call':return'S.call('+JSON.stringify(n.n)+',['+n.args.map(c).join(',')+'])';
      case 'rel':{const parts=n.ops.map((o,i)=>'('+c(n.xs[i])+({'=':'==='}[o]||o)+c(n.xs[i+1])+')');return'('+parts.join('&&')+')'}
      case 'pw':return'('+n.cases.map(([cd,e])=>c(cd)+'?'+c(e)+':').join('')+(n.def?c(n.def):'NaN')+')';
      case 'tuple':throw new PErr('A point can only be used on its own');
      case 'fn':{const a=n.args.map(c);
        switch(n.n){
          case 'sin':case 'cos':case 'tan':return'Math.'+n.n+'(S.k*'+a[0]+')';
          case 'sec':return'(1/Math.cos(S.k*'+a[0]+'))';case 'csc':return'(1/Math.sin(S.k*'+a[0]+'))';case 'cot':return'(1/Math.tan(S.k*'+a[0]+'))';
          case 'arcsin':case 'asin':return'(Math.asin('+a[0]+')/S.k)';case 'arccos':case 'acos':return'(Math.acos('+a[0]+')/S.k)';
          case 'arctan':case 'atan':return a.length>1?'(Math.atan2('+a[0]+','+a[1]+')/S.k)':'(Math.atan('+a[0]+')/S.k)';
          case 'sinh':case 'cosh':case 'tanh':case 'sqrt':case 'cbrt':case 'abs':case 'exp':case 'floor':case 'ceil':case 'round':case 'sign':return'Math.'+n.n+'('+a[0]+')';
          case 'ln':return'Math.log('+a[0]+')';case 'log':return'Math.log10('+a[0]+')';case 'logb':return'(Math.log('+a[0]+')/Math.log('+a[1]+'))';
          case 'min':case 'max':return'Math.'+n.n+'('+a.join(',')+')';
          case 'mod':return'S.mod('+a[0]+','+a[1]+')';case 'nCr':return'S.ncr('+a[0]+','+a[1]+')';case 'nPr':return'S.npr('+a[0]+','+a[1]+')';
          case 'gcd':return'S.gcd('+a[0]+','+a[1]+')';case 'lcm':return'S.lcm('+a[0]+','+a[1]+')';
        }
        throw new PErr('Unknown function '+n.n);}
    }
    throw new PErr('Cannot evaluate');
  }
  const gamma=z=>{if(z<.5)return Math.PI/(Math.sin(Math.PI*z)*gamma(1-z));z-=1;const g=7,c=[0.99999999999980993,676.5203681218851,-1259.1392167224028,771.32342877765313,-176.61502916214059,12.507343278686905,-0.13857109526572012,9.9843695780195716e-6,1.5056327351493116e-7];
    let x=c[0];for(let i=1;i<g+2;i++)x+=c[i]/(z+i);const t=z+g+.5;return Math.sqrt(2*Math.PI)*Math.pow(t,z+.5)*Math.exp(-t)*x};
  const S={v:{},f:{},k:1,
    pow:(a,b)=>{if(a<0&&!Number.isInteger(b)){const r=1/b,ri=Math.round(r);if(Math.abs(r-ri)<1e-9&&ri%2)return-Math.pow(-a,b)}return Math.pow(a,b)},   // (-8)^(1/3) = -2
    fact:n=>Number.isInteger(n)?(n<0?NaN:n>170?Infinity:(()=>{let r=1;for(let i=2;i<=n;i++)r*=i;return r})()):gamma(n+1),
    mod:(a,b)=>((a%b)+b)%b,ncr:(n,r)=>{if(r<0||r>n||!Number.isInteger(r))return 0;let x=1;for(let i=1;i<=r;i++)x=x*(n-r+i)/i;return Math.round(x)},
    npr:(n,r)=>{let x=1;for(let i=0;i<r;i++)x*=n-i;return x},
    gcd:(a,b)=>{a=Math.abs(Math.round(a));b=Math.abs(Math.round(b));while(b)[a,b]=[b,a%b];return a},lcm:(a,b)=>a&&b?Math.abs(a*b)/S.gcd(a,b):0,
    call:(n,a)=>{const f=S.f[n];if(!f)return NaN;if(f.depth>60)return NaN;f.depth++;try{return f.fn(...a)}finally{f.depth--}}};
  const compile=(n,params)=>{const P={};params.forEach((p,i)=>P[p]='a'+i);return new Function('S','return function('+params.map((_,i)=>'a'+i).join(',')+'){return '+code(n,P)+'}')(S)};

  /* ---------------- number formatting ---------------- */
  function fmt(v){
    if(!isFinite(v))return isNaN(v)?'undefined':(v>0?'∞':'-∞');
    if(Math.abs(v)<1e-12)return'0';
    if(Math.abs(v)>=1e10||Math.abs(v)<1e-5){const [m,e]=v.toExponential(5).split('e');return m.replace(/\.?0+$/,'')+'×10^'+(+e)}
    return String(+v.toPrecision(10));
  }
  const fmtTex=v=>{const s=fmt(v);return s.includes('×10^')?s.replace(/×10\^(-?\d+)/,'\\times10^{$1}'):s.replace('∞','\\infty ')};

  return{parse,tex,vars,calls,compile,S,COLORS,SK,fmt,fmtTex,PErr,FUNCS,_userFns:null};
})();

/* ---------------- the calculator view ---------------- */
function graphView(body){
  const G=GraphCalc,S=G.S;
  const load=()=>{try{return JSON.parse(localStorage.getItem(G.SK))}catch(e){return null}};
  let st=load()||{rows:[{text:'y=x^2',color:0},{text:'',color:1}],view:null,deg:false,grid:true,nums:true};
  st.rows=st.rows.map((r,i)=>({id:r.id||('r'+i+Math.random().toString(36).slice(2,6)),text:r.text||'',color:r.color??i%6,hidden:!!r.hidden,sl:r.sl||null}));
  let nextColor=st.rows.length;
  const save=()=>{try{localStorage.setItem(G.SK,JSON.stringify({rows:st.rows.map(r=>({id:r.id,text:r.text,color:r.color,hidden:r.hidden,sl:r.sl})),view,deg:st.deg,grid:st.grid,nums:st.nums}))}catch(e){}};
  const hist=[],redo=[];let histT=null;
  const snap=()=>JSON.stringify(st.rows.map(r=>({id:r.id,text:r.text,color:r.color,hidden:r.hidden,sl:r.sl})));
  let lastSnap=snap();
  const pushHist=()=>{clearTimeout(histT);histT=setTimeout(()=>{const s=snap();if(s!==lastSnap){hist.push(lastSnap);if(hist.length>100)hist.shift();redo.length=0;lastSnap=s;updUndo()}},400)};

  document.body.classList.add('graph-mode');
  body.innerHTML=`<div class="gc" id="gc">
    <div class="gc-panel">
      <div class="gc-top"><button class="gc-ib" id="gcAdd" title="Add expression" aria-label="Add expression">+</button>
        <button class="gc-ib" id="gcUndo" title="Undo (Ctrl+Z)" aria-label="Undo">↶</button><button class="gc-ib" id="gcRedo" title="Redo (Ctrl+Y)" aria-label="Redo">↷</button>
        <span class="gc-sp"></span><button class="gc-ib" id="gcClear" title="Delete all expressions" aria-label="Delete all">⌫</button></div>
      <div class="gc-list" id="gcList"></div>
    </div>
    <div class="gc-graph" id="gcGraph"><canvas id="gcCv"></canvas>
      <div class="gc-zoom"><button id="gcWrench" title="Graph settings" aria-label="Graph settings"><svg viewBox="0 0 24 24"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.5-.5-.5-2.5z"/></svg></button>
        <button id="gcIn" title="Zoom in" aria-label="Zoom in">+</button><button id="gcOut" title="Zoom out" aria-label="Zoom out">−</button>
        <button id="gcHome" title="Default viewport" aria-label="Default viewport"><svg viewBox="0 0 24 24"><path d="M3 11l9-8 9 8M5 9.5V21h5v-6h4v6h5V9.5"/></svg></button></div>
      <div class="gc-set" id="gcSet" hidden>
        <label><input type="checkbox" id="gcGrid"> Grid</label><label><input type="checkbox" id="gcNums"> Axis numbers</label>
        <div class="gc-seg"><button data-a="rad">Radians</button><button data-a="deg">Degrees</button></div></div>
      <div class="gc-tip" id="gcTip" hidden></div>
    </div></div>`;
  const $=id=>body.querySelector('#'+id);
  const list=$('gcList'),cv=$('gcCv'),ctx=cv.getContext('2d'),gbox=$('gcGraph');

  /* ---------- view ---------- */
  let W=0,H=0,dpr=1,view=st.view||null;
  const homeView=()=>({cx:0,cy:0,s:Math.max(20,Math.min(W,H)/20)});
  const X=px=>view.cx+(px-W/2)/view.s,Y=py=>view.cy-(py-H/2)/view.s,PX=x=>W/2+(x-view.cx)*view.s,PY=y=>H/2-(y-view.cy)*view.s;
  function resize(){const r=gbox.getBoundingClientRect();dpr=window.devicePixelRatio||1;W=Math.max(1,r.width);H=Math.max(1,r.height);
    cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr);cv.style.width=W+'px';cv.style.height=H+'px';if(!view)view=homeView();draw()}

  /* ---------- evaluation of all rows ---------- */
  let items=[];            // per row: {kind, ...}
  let selected=null,trace=null,poiCache=null;
  function analyze(){
    S.v={};S.f={};S.k=st.deg?Math.PI/180:1;
    // pass 0: find user function names so the parser treats f( as a call
    const fnNames=new Set();
    for(const r of st.rows){const m=r.text.match(/^\s*([A-Za-z])\s*\(\s*[A-Za-z](\s*,\s*[A-Za-z])*\s*\)\s*=/);if(m&&!'xyrt'.includes(m[1]))fnNames.add(m[1])}
    G._userFns=fnNames;
    const parsed=st.rows.map(r=>{if(!r.text.trim())return{kind:'empty'};try{return{ast:G.parse(r.text)}}catch(e){return{kind:'err',err:e.message||'Invalid expression'}}});
    // definitions: a = <constant expr>, f(x) = <expr>
    const defs={},fdefs={};
    parsed.forEach((p,i)=>{const a=p.ast;if(!a)return;
      if(a.t==='rel'&&a.ops.length===1&&a.ops[0]==='='){
        const L=a.xs[0],R=a.xs[1];
        if(L.t==='var'&&!['x','y','r','t','theta','pi','e','tau'].includes(L.n)){
          if(defs[L.n]!==undefined){p.kind='err';p.err='"'+L.n+'" is defined more than once';return}
          defs[L.n]=i;p.def=L.n;p.rhs=R}
        else if(L.t==='call'||(L.t==='op'&&L.imp&&L.a.t==='var'&&L.b.t==='par'&&fnNames.has(L.a.n))){
          const name=L.t==='call'?L.n:L.a.n,params=(L.t==='call'?L.args:[L.b.a]).map(q=>q.t==='var'?q.n:null);
          if(params.some(q=>!q)){p.kind='err';p.err='Function parameters must be letters';return}
          fdefs[name]=i;p.fdef=name;p.params=params;p.rhs=R}
      }});
    // user functions
    for(const [name,i] of Object.entries(fdefs)){const p=parsed[i];try{S.f[name]={fn:G.compile(p.rhs,p.params),depth:0}}catch(e){p.kind='err';p.err=e.message}}
    // variables (repeat to resolve dependencies)
    for(let pass=0;pass<8;pass++)for(const [name,i] of Object.entries(defs)){const p=parsed[i];
      const fv=[...G.vars(p.rhs)].filter(v=>!['pi','e','tau'].includes(v));
      if(fv.some(v=>['x','y'].includes(v))){p.kind='err';p.err='"'+name+'" cannot depend on x or y';continue}
      if(fv.every(v=>v in S.v||v===name&&false)){try{const val=G.compile(p.rhs,[])();if(isFinite(val)||isNaN(val))S.v[name]=val}catch(e){p.kind='err';p.err=e.message}}}
    // classify
    items=parsed.map((p,i)=>{
      const row=st.rows[i];if(p.kind==='empty'||p.kind==='err')return p;
      const a=p.ast;const known=v=>v in S.v||['pi','e','tau'].includes(v);
      const missing=v=>[...G.vars(v)].filter(x=>!known(x)&&!['x','y','t','r','theta'].includes(x));
      try{
        if(p.def){const miss=missing(p.rhs).filter(v=>v!==p.def);if(miss.length)return{kind:'err',err:'Unknown variable '+miss.join(', '),miss};
          const isNum=p.rhs.t==='num'||(p.rhs.t==='neg'&&p.rhs.a.t==='num');
          return{kind:isNum?'slider':'value',name:p.def,val:S.v[p.def]}}
        if(p.fdef){const miss=missing(p.rhs).filter(v=>!p.params.includes(v));if(miss.length)return{kind:'err',err:'Unknown variable '+miss.join(', '),miss};
          if(p.params.length===1&&p.params[0]==='x'){const f=S.f[p.fdef].fn;return{kind:'fx',f,ast:p.rhs}}
          return{kind:'fdef'}}
        if(a.t==='tuple'){
          const pts=a.top?a.xs:[a];if(pts.some(q=>q.t!=='tuple'||q.xs.length!==2))throw new G.PErr('Points need two coordinates, like (1, 2)');
          const vs=new Set();pts.forEach(q=>G.vars(q,vs));const miss=[...vs].filter(v=>!known(v)&&v!=='t');if(miss.length)return{kind:'err',err:'Unknown variable '+miss.join(', '),miss};
          if(vs.has('t')){if(pts.length>1)throw new G.PErr('Use one parametric curve per line');
            return{kind:'param',fx:G.compile(pts[0].xs[0],['t']),fy:G.compile(pts[0].xs[1],['t']),t0:row.t0??0,t1:row.t1??1}}
          return{kind:'pts',pts:pts.map(q=>[G.compile(q.xs[0],[])(),G.compile(q.xs[1],[])()])}}
        const vs=G.vars(a),miss=[...vs].filter(v=>!known(v)&&!['x','y','r','theta','t'].includes(v));
        if(miss.length)return{kind:'err',err:'Unknown variable '+miss.join(', '),miss};
        if(a.t==='rel'){
          if(a.ops.length!==1)throw new G.PErr('Use one comparison per line, like y < x');
          const op=a.ops[0],L=a.xs[0],R=a.xs[1],lv=G.vars(L),rv=G.vars(R);
          const only=(set,ok)=>[...set].every(v=>ok.includes(v)||known(v));
          if(L.t==='var'&&L.n==='r'&&only(rv,['theta'])){if(op!=='=')throw new G.PErr('Polar inequalities are not supported');return{kind:'polar',f:G.compile(R,['theta'])}}
          if(op==='='){
            if(L.t==='var'&&L.n==='y'&&!rv.has('y'))return{kind:'fx',f:G.compile(R,['x']),ast:R};
            if(R.t==='var'&&R.n==='y'&&!lv.has('y'))return{kind:'fx',f:G.compile(L,['x']),ast:L};
            if(L.t==='var'&&L.n==='x'&&!rv.has('x'))return{kind:'fy',f:G.compile(R,['y'])};
            if(R.t==='var'&&R.n==='x'&&!lv.has('x'))return{kind:'fy',f:G.compile(L,['y'])};
            if(!vs.has('x')&&!vs.has('y')){const v=G.compile({t:'op',o:'-',a:L,b:R},[])();return{kind:'num',val:Math.abs(v)<1e-12,bool:1}}
            return{kind:'imp',F:G.compile({t:'op',o:'-',a:L,b:R},['x','y'])}}
          const F=G.compile({t:'op',o:'-',a:L,b:R},['x','y']),gt=op[0]==='>';
          return{kind:'ineq',F,gt,strict:op.length===1}}
        if(vs.has('y'))throw new G.PErr('Expressions with y need an equation, like y = …');
        if(vs.has('x'))return{kind:'fx',f:G.compile(a,['x']),ast:a};
        if(vs.has('theta'))throw new G.PErr('Write polar curves as r = …');
        return{kind:'num',val:G.compile(a,[])()};
      }catch(e){return{kind:'err',err:e.message||'Invalid expression'}}
    });
    poiCache=null;
  }

  /* ---------- drawing ---------- */
  function niceStep(px){const raw=px/view.s,e=Math.pow(10,Math.floor(Math.log10(raw))),m=raw/e;return(m<1.5?1:m<3.5?2:m<7.5?5:10)*e}
  const lbl=(v,step)=>{if(Math.abs(v)<step/1e6)return'0';const d=Math.max(0,-Math.floor(Math.log10(step)+1e-9));
    if(Math.abs(v)>=1e6||step<1e-5){const [m,e]=v.toExponential(1).split('e');return m.replace(/\.0$/,'')+'e'+(+e)}return v.toFixed(Math.min(d,10)).replace('-','−')};
  function drawGrid(){
    const major=niceStep(Math.max(70,Math.min(W,H)/8)),mm=major/Math.pow(10,Math.floor(Math.log10(major)+1e-9)),minor=major/(Math.abs(mm-2)<1e-9?4:5);
    const x0=X(0),x1=X(W),y0=Y(H),y1=Y(0);
    if(st.grid){
      ctx.lineWidth=1;ctx.strokeStyle='rgba(0,0,0,.06)';ctx.beginPath();
      for(let x=Math.ceil(x0/minor)*minor;x<=x1;x+=minor){const p=Math.round(PX(x))+.5;ctx.moveTo(p,0);ctx.lineTo(p,H)}
      for(let y=Math.ceil(y0/minor)*minor;y<=y1;y+=minor){const p=Math.round(PY(y))+.5;ctx.moveTo(0,p);ctx.lineTo(W,p)}
      ctx.stroke();ctx.strokeStyle='rgba(0,0,0,.16)';ctx.beginPath();
      for(let x=Math.ceil(x0/major)*major;x<=x1;x+=major){const p=Math.round(PX(x))+.5;ctx.moveTo(p,0);ctx.lineTo(p,H)}
      for(let y=Math.ceil(y0/major)*major;y<=y1;y+=major){const p=Math.round(PY(y))+.5;ctx.moveTo(0,p);ctx.lineTo(W,p)}
      ctx.stroke();
    }
    const ax=PX(0),ay=PY(0);ctx.strokeStyle='#222';ctx.lineWidth=1.3;ctx.beginPath();
    if(ax>=0&&ax<=W){ctx.moveTo(Math.round(ax)+.5,0);ctx.lineTo(Math.round(ax)+.5,H)}
    if(ay>=0&&ay<=H){ctx.moveTo(0,Math.round(ay)+.5);ctx.lineTo(W,Math.round(ay)+.5)}ctx.stroke();
    if(!st.nums)return;
    ctx.font='12px "Helvetica Neue",Arial,sans-serif';ctx.fillStyle='#222';
    const lx=Math.min(Math.max(ax,0),W),ly=Math.min(Math.max(ay,0),H-16);
    ctx.textAlign='center';ctx.textBaseline='top';
    for(let x=Math.ceil(x0/major)*major;x<=x1;x+=major){if(Math.abs(x)<major/1e6)continue;const p=PX(x),t=lbl(x,major),w=ctx.measureText(t).width;
      const yy=ay>H-18?H-18:ay<0?4:ly+4;ctx.fillStyle='rgba(255,255,255,.85)';ctx.fillRect(p-w/2-2,yy-1,w+4,15);ctx.fillStyle='#222';ctx.fillText(t,p,yy)}
    ctx.textBaseline='middle';
    for(let y=Math.ceil(y0/major)*major;y<=y1;y+=major){if(Math.abs(y)<major/1e6)continue;const p=PY(y),t=lbl(y,major),w=ctx.measureText(t).width;
      let xx,al;if(ax<w+10){xx=6;al='left'}else if(ax>W-4){xx=W-6;al='right'}else{xx=lx-5;al='right'}
      ctx.textAlign=al;ctx.fillStyle='rgba(255,255,255,.85)';ctx.fillRect(al==='left'?xx-2:xx-w-2,p-8,w+4,15);ctx.fillStyle='#222';ctx.fillText(t,xx,p)}
    if(ax>=0&&ax<=W&&ay>=0&&ay<=H){ctx.textAlign='right';ctx.textBaseline='top';ctx.fillText('0',ax-5,ay+4)}
  }
  function strokeExplicit(f,col,swap,width){
    ctx.strokeStyle=col;ctx.lineWidth=width||2.5;ctx.lineJoin='round';ctx.lineCap='round';ctx.beginPath();
    const N=swap?H:W,step=.5;let pen=false,lastP=null;
    const to=(u,v)=>swap?[PX(v),u]:[u,PY(v)];
    for(let u=0;u<=N+step;u+=step){
      const a=swap?Y(u):X(u);let v;try{v=f(a)}catch(e){v=NaN}
      if(!isFinite(v)){pen=false;lastP=null;continue}
      const [px,py]=to(u,v);const q=swap?px:py;
      if(lastP!==null&&Math.abs(q-lastP.q)>(swap?W:H)*1.5){                       // likely an asymptote: check the midpoint
        const am=swap?Y(u-step/2):X(u-step/2);let vm;try{vm=f(am)}catch(e){vm=NaN}
        const qm=swap?PX(vm):PY(vm);if(!isFinite(vm)||(qm-lastP.q)*(q-qm)<0||Math.abs(qm-q)>Math.abs(q-lastP.q)){pen=false}}
      const cq=Math.max(-1e4,Math.min(1e4+(swap?W:H),q));
      if(swap){if(pen)ctx.lineTo(cq,py);else ctx.moveTo(cq,py)}else{if(pen)ctx.lineTo(px,cq);else ctx.moveTo(px,cq)}
      pen=true;lastP={q};
    }
    ctx.stroke();
  }
  function strokeCurve(fx,fy,t0,t1,n,col){
    ctx.strokeStyle=col;ctx.lineWidth=2.5;ctx.lineJoin='round';ctx.beginPath();let pen=false,lx=0,ly=0;
    for(let i=0;i<=n;i++){const t=t0+(t1-t0)*i/n;let x,y;try{x=fx(t);y=fy(t)}catch(e){x=NaN}
      if(!isFinite(x)||!isFinite(y)){pen=false;continue}const px=PX(x),py=PY(y);
      if(pen&&Math.hypot(px-lx,py-ly)>Math.max(W,H))pen=false;
      if(pen)ctx.lineTo(px,py);else ctx.moveTo(px,py);pen=true;lx=px;ly=py}
    ctx.stroke();
  }
  function grid(F,cell){            // sample F(x,y) on a grid
    const nx=Math.ceil(W/cell)+1,ny=Math.ceil(H/cell)+1,v=new Float64Array(nx*ny);
    for(let j=0;j<ny;j++){const y=Y(j*cell);for(let i=0;i<nx;i++){let z;try{z=F(X(i*cell),y)}catch(e){z=NaN}v[j*nx+i]=z}}
    return{nx,ny,v};
  }
  function strokeImplicit(F,col,dashed){
    const cell=W*H>9e5?5:4,g=grid(F,cell),{nx,ny,v}=g;ctx.strokeStyle=col;ctx.lineWidth=2.5;ctx.lineCap='round';if(dashed)ctx.setLineDash([8,6]);ctx.beginPath();
    const lerp=(a,b)=>a/(a-b);
    for(let j=0;j<ny-1;j++)for(let i=0;i<nx-1;i++){
      const a=v[j*nx+i],b=v[j*nx+i+1],c=v[(j+1)*nx+i+1],d=v[(j+1)*nx+i];
      if(!isFinite(a)||!isFinite(b)||!isFinite(c)||!isFinite(d))continue;
      const pts=[];const x0=i*cell,y0=j*cell;
      if((a>0)!==(b>0))pts.push([x0+cell*lerp(a,b),y0]);
      if((b>0)!==(c>0))pts.push([x0+cell,y0+cell*lerp(b,c)]);
      if((d>0)!==(c>0))pts.push([x0+cell*lerp(d,c),y0+cell]);
      if((a>0)!==(d>0))pts.push([x0,y0+cell*lerp(a,d)]);
      if(pts.length<2)continue;
      const mx=Math.max(Math.abs(a),Math.abs(b),Math.abs(c),Math.abs(d));
      const ok=([px,py])=>{let z;try{z=F(X(px),Y(py))}catch(e){z=NaN}return isFinite(z)&&Math.abs(z)<=mx*1.2};   // skip sign flips across poles
      for(let k=0;k+1<pts.length;k+=2){const m=[(pts[k][0]+pts[k+1][0])/2,(pts[k][1]+pts[k+1][1])/2];if(!ok(m))continue;ctx.moveTo(pts[k][0],pts[k][1]);ctx.lineTo(pts[k+1][0],pts[k+1][1])}
    }
    ctx.stroke();ctx.setLineDash([]);
  }
  function fillIneq(F,gt,col){
    const cell=3,{nx,ny,v}=grid(F,cell);ctx.fillStyle=col;ctx.globalAlpha=.25;ctx.beginPath();
    for(let j=0;j<ny;j++){let run=-1;for(let i=0;i<=nx;i++){const z=i<nx?v[j*nx+i]:NaN;const on=isFinite(z)&&(gt?z>0:z<0);
      if(on&&run<0)run=i;if(!on&&run>=0){ctx.rect(run*cell-cell/2,j*cell-cell/2,(i-run)*cell,cell);run=-1}}}
    ctx.fill();ctx.globalAlpha=1;
  }
  function dot(x,y,col,r=5,ring){const px=PX(x),py=PY(y);ctx.beginPath();ctx.arc(px,py,r,0,7);ctx.fillStyle=col;ctx.fill();if(ring){ctx.lineWidth=2;ctx.strokeStyle='#fff';ctx.stroke()}}
  function draw(){
    if(!view)return;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);drawGrid();
    items.forEach((it,i)=>{const r=st.rows[i];if(!it||r.hidden)return;const col=G.COLORS[r.color%6];
      try{
        if(it.kind==='ineq'){fillIneq(it.F,it.gt,col);strokeImplicit(it.F,col,it.strict)}
        else if(it.kind==='fx')strokeExplicit(it.f,col,false,selected===i?3.5:2.5);
        else if(it.kind==='fy')strokeExplicit(it.f,col,true,selected===i?3.5:2.5);
        else if(it.kind==='imp')strokeImplicit(it.F,col);
        else if(it.kind==='polar')strokeCurve(th=>{const r_=it.f(th);return r_*Math.cos(S.k*th)},th=>{const r_=it.f(th);return r_*Math.sin(S.k*th)},0,st.deg?2160:12*Math.PI,6000,col);
        else if(it.kind==='param')strokeCurve(it.fx,it.fy,it.t0,it.t1,1500,col);
        else if(it.kind==='pts')it.pts.forEach(([x,y])=>isFinite(x)&&isFinite(y)&&dot(x,y,col,5));
      }catch(e){}
    });
    if(selected!==null&&items[selected]&&!st.rows[selected].hidden){const pois=getPOIs();pois.forEach(p=>dot(p.x,p.y,'#888',4.5,true))}
    if(trace){dot(trace.x,trace.y,G.COLORS[st.rows[trace.i].color%6],6,true)}
    // labels for clicked points
    tipPos();
  }

  /* ---------- points of interest on the selected curve ---------- */
  function getPOIs(){
    if(poiCache&&poiCache.key===viewKey())return poiCache.pts;
    const it=items[selected],pts=[];
    if(it&&it.kind==='fx'){
      const f=it.f,N=400,xs=[],ys=[];for(let k=0;k<=N;k++){const x=X(W*k/N);xs.push(x);let y;try{y=f(x)}catch(e){y=NaN}ys.push(y)}
      const bis=(g,a,b)=>{let ga=g(a);for(let k=0;k<60;k++){const m=(a+b)/2,gm=g(m);if(!isFinite(gm))return null;if((gm>0)===(ga>0)){a=m;ga=gm}else b=m}return(a+b)/2};
      for(let k=0;k<N;k++){const a=ys[k],b=ys[k+1];if(!isFinite(a)||!isFinite(b))continue;
        if(a===0)pts.push({x:xs[k],y:0,kind:'Zero'});
        else if((a>0)!==(b>0)&&Math.abs(a-b)<H/view.s){const z=bis(f,xs[k],xs[k+1]);if(z!==null&&Math.abs(f(z))<1e-6*(1+Math.abs(a)+Math.abs(b)))pts.push({x:z,y:0,kind:'Zero'})}}
      const d=x=>{const h=1e-6*Math.max(1,Math.abs(x));return(f(x+h)-f(x-h))/(2*h)};
      for(let k=1;k<N-1;k++){const a=ys[k-1],b=ys[k],c=ys[k+1];if(![a,b,c].every(isFinite))continue;
        if((b>a&&b>c)||(b<a&&b<c)){const z=bis(d,xs[k-1],xs[k+1]);if(z!==null){const y=f(z);if(isFinite(y))pts.push({x:z,y,kind:b>a?'Maximum':'Minimum'})}}}
      let y0;try{y0=f(0)}catch(e){}if(isFinite(y0))pts.push({x:0,y:y0,kind:'y-intercept'});
      items.forEach((o,j)=>{if(j===selected||!o||o.kind!=='fx'||st.rows[j].hidden)return;const g=x=>f(x)-o.f(x);
        for(let k=0;k<N;k++){let a,b;try{a=g(xs[k]);b=g(xs[k+1])}catch(e){continue}if(!isFinite(a)||!isFinite(b))continue;
          if((a>0)!==(b>0)&&Math.abs(a-b)<H/view.s){const z=bis(g,xs[k],xs[k+1]);if(z!==null&&Math.abs(g(z))<1e-6*(1+Math.abs(a)+Math.abs(b)))pts.push({x:z,y:f(z),kind:'Intersection'})}}});
    }else if(it&&it.kind==='pts')it.pts.forEach(([x,y])=>pts.push({x,y,kind:'Point'}));
    poiCache={key:viewKey(),pts};return pts;
  }
  const viewKey=()=>view.cx+','+view.cy+','+view.s+','+selected+','+W+','+H;

  /* ---------- tooltip for traced / clicked points ---------- */
  let tipAt=null;
  function tipPos(){const tip=$('gcTip');if(!tipAt){tip.hidden=true;return}
    const px=PX(tipAt.x),py=PY(tipAt.y);if(px<-20||px>W+20||py<-20||py>H+20){tip.hidden=true;return}
    tip.hidden=false;tip.innerHTML=(tipAt.kind?'<small>'+tipAt.kind+'</small>':'')+'('+G.fmt(+tipAt.x.toPrecision(6))+', '+G.fmt(+tipAt.y.toPrecision(6))+')';
    tip.style.left=Math.min(W-tip.offsetWidth-4,Math.max(4,px+10))+'px';tip.style.top=Math.max(4,py-tip.offsetHeight-10)+'px'}

  /* ---------- expression list ---------- */
  function rowHTML(r,i){
    return`<div class="gc-row${selected===i?' sel':''}" data-i="${i}">
      <div class="gc-tab"><span class="gc-n">${i+1}</span><button class="gc-ic${r.hidden?' off':''}" data-act="vis" style="--c:${G.COLORS[r.color%6]}" title="Show / hide" aria-label="Show or hide"></button></div>
      <div class="gc-ex"><div class="gc-math"></div><input class="gc-in" spellcheck="false" autocomplete="off" autocapitalize="off" value="${r.text.replace(/&/g,'&amp;').replace(/"/g,'&quot;')}" aria-label="Expression ${i+1}">
        <div class="gc-extra"></div></div>
      <button class="gc-x" data-act="del" title="Delete" aria-label="Delete">×</button></div>`;
  }
  function renderList(focusIdx,caret){
    list.innerHTML=st.rows.map(rowHTML).join('')+'<div class="gc-new" id="gcNew">Click to add an expression</div>';
    st.rows.forEach((r,i)=>updRow(i));
    if(focusIdx!=null){const inp=list.children[focusIdx]?.querySelector('.gc-in');if(inp){focusRow(inp);if(caret!=null)inp.setSelectionRange(caret,caret)}}
  }
  function focusRow(inp){inp.closest('.gc-row').classList.add('editing');inp.focus()}
  function updRow(i){
    const el=list.children[i];if(!el)return;const r=st.rows[i],it=items[i]||{kind:'empty'};
    const math=el.querySelector('.gc-math'),extra=el.querySelector('.gc-extra');
    let ast=null;try{ast=r.text.trim()?G.parse(r.text):null}catch(e){}
    if(ast&&typeof katex!=='undefined'){try{katex.render(G.tex(ast),math,{throwOnError:false,displayMode:false})}catch(e){math.textContent=r.text}}else math.textContent=r.text;
    math.classList.toggle('empty',!r.text.trim());
    let h='';
    if(it.kind==='err'){h+=`<div class="gc-err" title="${it.err.replace(/"/g,'&quot;')}">⚠ ${it.err.replace(/</g,'&lt;')}</div>`;
      if(it.miss&&it.miss.length)h+=`<div class="gc-addsl">add slider: ${it.miss.map(v=>`<button data-act="sl" data-v="${v}">${v}</button>`).join(' ')}</div>`}
    else if(it.kind==='num')h+=`<div class="gc-val">${it.bool?(it.val?'true':'false'):'= '+G.fmt(it.val)}</div>`;
    else if(it.kind==='value')h+=`<div class="gc-val">= ${G.fmt(it.val)}</div>`;
    else if(it.kind==='slider'){const sl=r.sl||{min:-10,max:10,step:0};const v=it.val;
      h+=`<div class="gc-slider"><button class="gc-play${r.play?' on':''}" data-act="play" aria-label="Animate">${r.play?'❚❚':'▶'}</button>
        <span class="gc-lim" data-act="min" title="Change minimum">${G.fmt(Math.min(sl.min,v))}</span>
        <input type="range" class="gc-range" min="${Math.min(sl.min,v)}" max="${Math.max(sl.max,v)}" step="${sl.step||'any'}" value="${v}">
        <span class="gc-lim" data-act="max" title="Change maximum">${G.fmt(Math.max(sl.max,v))}</span></div>`}
    else if(it.kind==='param')h+=`<div class="gc-dom"><input data-act="t0" value="${it.t0}"> ≤ t ≤ <input data-act="t1" value="${it.t1}"></div>`;
    extra.innerHTML=h;
    el.querySelector('.gc-ic').style.setProperty('--c',G.COLORS[r.color%6]);
    el.classList.toggle('haserr',it.kind==='err');
  }
  function recompute(keepFocus){analyze();st.rows.forEach((r,i)=>{if(!keepFocus||document.activeElement!==list.children[i]?.querySelector('.gc-in'))updRow(i);else updRowExtra(i)});draw();save()}
  function updRowExtra(i){                         // while typing, refresh only the result line (keeps the caret)
    const el=list.children[i];if(!el)return;const keep=el.querySelector('.gc-in');const r=st.rows[i];
    const tmp=document.createElement('div');tmp.innerHTML=rowHTML(r,i);const nx=tmp.firstElementChild;
    el.querySelector('.gc-extra').replaceWith(nx.querySelector('.gc-extra'));updRow(i);el.querySelector('.gc-in')!==keep&&0}
  function addRow(at,text='',focus=true){
    const r={id:'r'+Date.now().toString(36)+Math.random().toString(36).slice(2,5),text,color:nextColor++%6,hidden:false,sl:null};
    st.rows.splice(at,0,r);analyze();renderList(focus?at:null,text.length);draw();save();pushHist();return r}

  list.addEventListener('input',e=>{const inp=e.target.closest('.gc-in');if(inp){const i=+inp.closest('.gc-row').dataset.i;st.rows[i].text=inp.value;
      if(st.rows[i].play&&!/^\s*[A-Za-z]\s*=\s*-?[0-9.]+\s*$/.test(inp.value))st.rows[i].play=false;
      recompute(true);pushHist();return}
    const rg=e.target.closest('.gc-range');if(rg){const i=+rg.closest('.gc-row').dataset.i,r=st.rows[i];const m=r.text.match(/^\s*([A-Za-z])\s*=/);
      const v=+rg.value,stp=r.sl&&r.sl.step?r.sl.step:0;const val=stp?Math.round(v/stp)*stp:+(+v).toPrecision(3);
      r.text=m[1]+'='+G.fmt(val);const inp=list.children[i].querySelector('.gc-in');inp.value=r.text;analyze();updRow(i);
      st.rows.forEach((_,j)=>{if(j!==i)updRow(j)});draw();save();pushHist();return}
    const dm=e.target.closest('[data-act="t0"],[data-act="t1"]');if(dm){const i=+dm.closest('.gc-row').dataset.i;const v=parseFloat(dm.value);if(isFinite(v)){st.rows[i][dm.dataset.act]=v;analyze();draw();save()}}
  });
  list.addEventListener('focusin',e=>{const inp=e.target.closest('.gc-in');if(!inp)return;const row=inp.closest('.gc-row');row.classList.add('editing');
    const i=+row.dataset.i;if(selected!==i){selected=i;poiCache=null;list.querySelectorAll('.gc-row').forEach((el,j)=>el.classList.toggle('sel',j===i));draw()}});
  list.addEventListener('focusout',e=>{const inp=e.target.closest('.gc-in');if(!inp)return;const row=inp.closest('.gc-row');setTimeout(()=>{if(!row.contains(document.activeElement))row.classList.remove('editing')},0)});
  list.addEventListener('click',e=>{
    const a=e.target.closest('[data-act]');const row=e.target.closest('.gc-row');
    if(e.target.id==='gcNew'){addRow(st.rows.length);return}
    if(!row)return;const i=+row.dataset.i,r=st.rows[i];
    if(a){const act=a.dataset.act;
      if(act==='vis'){r.hidden=!r.hidden;a.classList.toggle('off',r.hidden);draw();save();pushHist();return}
      if(act==='del'){st.rows.splice(i,1);if(!st.rows.length)st.rows.push({id:'r0',text:'',color:nextColor++%6});if(selected===i)selected=null;trace=null;tipAt=null;analyze();renderList();draw();save();pushHist();return}
      if(act==='sl'){addRow(st.rows.length>0&&!st.rows[st.rows.length-1].text.trim()?st.rows.length-1:st.rows.length,a.dataset.v+'=1',false);recompute();renderList();return}
      if(act==='play'){r.play=!r.play;if(r.play)startAnim();updRow(i);return}
      if(act==='min'||act==='max'){const cur=r.sl||{min:-10,max:10,step:0};const v=prompt((act==='min'?'Minimum':'Maximum')+' value for the slider:',G.fmt(act==='min'?cur.min:cur.max));
        if(v!==null&&isFinite(parseFloat(v))){r.sl={...cur,[act]:parseFloat(v)};updRow(i);save()}return}
      return}
    if(!e.target.closest('input,button')){const inp=row.querySelector('.gc-in');focusRow(inp);inp.setSelectionRange(inp.value.length,inp.value.length)}
  });
  list.addEventListener('keydown',e=>{
    const inp=e.target.closest('.gc-in');if(!inp)return;const i=+inp.closest('.gc-row').dataset.i;
    if(e.key==='Enter'){e.preventDefault();addRow(i+1)}
    else if(e.key==='Backspace'&&!inp.value&&st.rows.length>1){e.preventDefault();st.rows.splice(i,1);analyze();renderList(Math.max(0,i-1),st.rows[Math.max(0,i-1)].text.length);draw();save();pushHist()}
    else if(e.key==='ArrowDown'&&i<st.rows.length-1){e.preventDefault();const n=list.children[i+1].querySelector('.gc-in');focusRow(n)}
    else if(e.key==='ArrowUp'&&i>0){e.preventDefault();const n=list.children[i-1].querySelector('.gc-in');focusRow(n)}
  });

  /* ---------- slider animation ---------- */
  let anim=null;
  function startAnim(){if(anim)return;let last=performance.now();
    const tick=now=>{const dt=Math.min(.05,(now-last)/1000);last=now;let any=false;
      st.rows.forEach((r,i)=>{if(!r.play)return;const it=items[i];if(!it||it.kind!=='slider'){r.play=false;return}any=true;
        const sl=r.sl||{min:-10,max:10};r.dir=r.dir||1;let v=it.val+r.dir*(sl.max-sl.min)*dt/4;
        if(v>sl.max){v=sl.max;r.dir=-1}if(v<sl.min){v=sl.min;r.dir=1}
        r.text=r.text.match(/^\s*([A-Za-z])/)[1]+'='+G.fmt(+v.toPrecision(4))});
      if(!any){anim=null;return}
      analyze();st.rows.forEach((r,i)=>{const el=list.children[i];if(!el)return;if(r.play){el.querySelector('.gc-in').value=r.text;updRow(i)}else if(items[i]&&items[i].kind==='value')updRow(i)});draw();
      anim=requestAnimationFrame(tick)};
    anim=requestAnimationFrame(tick)}

  /* ---------- pan / zoom / trace ---------- */
  const ptrs=new Map();let drag=null,pinch=null;
  function nearestCurve(px,py){
    let best=null;items.forEach((it,i)=>{if(!it||st.rows[i].hidden)return;
      if(it.kind==='fx'){const x=X(px);let y;try{y=it.f(x)}catch(e){return}if(!isFinite(y))return;const d=Math.abs(PY(y)-py);if(d<14&&(!best||d<best.d))best={d,i,x,y}}
      if(it.kind==='fy'){const y=Y(py);let x;try{x=it.f(y)}catch(e){return}if(!isFinite(x))return;const d=Math.abs(PX(x)-px);if(d<14&&(!best||d<best.d))best={d,i,x,y}}});
    return best}
  function nearPOI(px,py){if(selected===null)return null;let best=null;for(const p of getPOIs()){const d=Math.hypot(PX(p.x)-px,PY(p.y)-py);if(d<12&&(!best||d<best.d))best={...p,d}}
    items.forEach((it,i)=>{if(it&&it.kind==='pts'&&!st.rows[i].hidden)it.pts.forEach(([x,y])=>{const d=Math.hypot(PX(x)-px,PY(y)-py);if(d<12&&(!best||d<best.d))best={x,y,kind:'',d}})});
    return best}
  const local=e=>{const r=cv.getBoundingClientRect();return[e.clientX-r.left,e.clientY-r.top]};
  function selectRow(i){selected=i;poiCache=null;list.querySelectorAll('.gc-row').forEach((el,j)=>el.classList.toggle('sel',j===i))}
  cv.addEventListener('pointerdown',e=>{try{cv.setPointerCapture(e.pointerId)}catch(_){}const [px,py]=local(e);ptrs.set(e.pointerId,[px,py]);
    $('gcSet').hidden=true;
    if(ptrs.size===2){const [a,b]=[...ptrs.values()];pinch={d:Math.hypot(a[0]-b[0],a[1]-b[1]),s:view.s,c:[X((a[0]+b[0])/2),Y((a[1]+b[1])/2)]};drag=null;trace=null;return}
    const poi=nearPOI(px,py);if(poi){tipAt=poi;trace=null;draw();drag={moved:true,poi:1};return}
    const c=nearestCurve(px,py);
    if(c){selectRow(c.i);trace=c;tipAt={x:c.x,y:c.y};drag={trace:c.i};draw();return}
    drag={x:px,y:py,cx:view.cx,cy:view.cy,moved:false}});
  cv.addEventListener('pointermove',e=>{if(!ptrs.has(e.pointerId)){cv.style.cursor=nearestCurve(...local(e))?'pointer':'grab';return}
    const [px,py]=local(e);ptrs.set(e.pointerId,[px,py]);
    if(pinch&&ptrs.size===2){const [a,b]=[...ptrs.values()];const d=Math.hypot(a[0]-b[0],a[1]-b[1]);const m=[(a[0]+b[0])/2,(a[1]+b[1])/2];
      view.s=Math.min(1e7,Math.max(1e-4,pinch.s*d/pinch.d));view.cx=pinch.c[0]-(m[0]-W/2)/view.s;view.cy=pinch.c[1]+(m[1]-H/2)/view.s;poiCache=null;draw();return}
    if(!drag)return;
    if(drag.trace!=null){const it=items[drag.trace];if(it.kind==='fx'){const x=X(px);let y;try{y=it.f(x)}catch(_){}if(isFinite(y)){trace={i:drag.trace,x,y};tipAt={x,y}}}
      else if(it.kind==='fy'){const y=Y(py);let x;try{x=it.f(y)}catch(_){}if(isFinite(x)){trace={i:drag.trace,x,y};tipAt={x,y}}}draw();return}
    if(drag.poi)return;
    if(Math.hypot(px-drag.x,py-drag.y)>3)drag.moved=true;
    view.cx=drag.cx-(px-drag.x)/view.s;view.cy=drag.cy+(py-drag.y)/view.s;cv.style.cursor='grabbing';poiCache=null;draw()});
  const up=e=>{ptrs.delete(e.pointerId);if(ptrs.size<2)pinch=null;
    if(drag&&!drag.moved&&drag.trace==null&&!drag.poi){tipAt=null;trace=null;if(selected!==null){selectRow(null)}draw()}
    if(ptrs.size===0){drag=null;save()}cv.style.cursor='grab'};
  cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',up);
  cv.addEventListener('wheel',e=>{e.preventDefault();const [px,py]=local(e);const k=Math.exp(-e.deltaY*(e.deltaMode?.05:.0015));
    const x=X(px),y=Y(py);view.s=Math.min(1e7,Math.max(1e-4,view.s*k));view.cx=x-(px-W/2)/view.s;view.cy=y+(py-H/2)/view.s;poiCache=null;draw();clearTimeout(cv._w);cv._w=setTimeout(save,300)},{passive:false});
  const zoomBy=k=>{const s0=view.s,s1=Math.min(1e7,Math.max(1e-4,s0*k));const steps=10;let n=0;const go=()=>{n++;view.s=s0*Math.pow(s1/s0,n/steps);poiCache=null;draw();if(n<steps)requestAnimationFrame(go);else save()};go()};
  $('gcIn').addEventListener('click',()=>zoomBy(1.6));$('gcOut').addEventListener('click',()=>zoomBy(1/1.6));
  $('gcHome').addEventListener('click',()=>{view=homeView();poiCache=null;draw();save()});
  $('gcWrench').addEventListener('click',()=>{const p=$('gcSet');p.hidden=!p.hidden;syncSet()});
  function syncSet(){$('gcGrid').checked=st.grid;$('gcNums').checked=st.nums;$('gcSet').querySelectorAll('[data-a]').forEach(b=>b.classList.toggle('on',(b.dataset.a==='deg')===!!st.deg))}
  $('gcGrid').addEventListener('change',e=>{st.grid=e.target.checked;draw();save()});$('gcNums').addEventListener('change',e=>{st.nums=e.target.checked;draw();save()});
  $('gcSet').addEventListener('click',e=>{const b=e.target.closest('[data-a]');if(!b)return;st.deg=b.dataset.a==='deg';syncSet();recompute()});
  $('gcAdd').addEventListener('click',()=>addRow(st.rows.length));
  $('gcClear').addEventListener('click',()=>{if(!confirm('Delete all expressions?'))return;st.rows=[{id:'r'+Date.now(),text:'',color:nextColor++%6}];selected=null;trace=null;tipAt=null;analyze();renderList(0);draw();save();pushHist()});
  function restore(s){st.rows=JSON.parse(s).map(r=>({...r}));lastSnap=s;selected=null;trace=null;tipAt=null;analyze();renderList();draw();save();updUndo()}
  function updUndo(){$('gcUndo').disabled=!hist.length;$('gcRedo').disabled=!redo.length}
  $('gcUndo').addEventListener('click',()=>{if(!hist.length)return;clearTimeout(histT);redo.push(snap());restore(hist.pop())});
  $('gcRedo').addEventListener('click',()=>{if(!redo.length)return;hist.push(snap());restore(redo.pop())});
  const keys=e=>{if(!(e.ctrlKey||e.metaKey))return;const k=e.key.toLowerCase();if(k==='z'&&!e.shiftKey){e.preventDefault();$('gcUndo').click()}else if(k==='y'||(k==='z'&&e.shiftKey)){e.preventDefault();$('gcRedo').click()}};
  document.addEventListener('keydown',keys);

  const gcEl=$('gc');
  const fit=()=>{const t=gcEl.getBoundingClientRect().top+window.scrollY;gcEl.style.height=Math.max(420,window.innerHeight-t-16)+'px'};   // fill the screen below the tabs
  fit();window.addEventListener('resize',fit);
  const ro=new ResizeObserver(()=>resize());ro.observe(gbox);
  window.__graphOff=()=>{ro.disconnect();window.removeEventListener('resize',fit);document.removeEventListener('keydown',keys);if(anim)cancelAnimationFrame(anim);anim=null;document.body.classList.remove('graph-mode');save();window.__graphOff=null};
  analyze();renderList();updUndo();resize();
  if(st.rows.some(r=>r.play))startAnim();
}
