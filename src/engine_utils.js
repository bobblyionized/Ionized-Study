
'use strict';
/* ====================== utilities ====================== */
const T = String.raw;
const KEY = 'amc1012prep.v1';
function hash(s){let h=2166136261>>>0;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function rng(a){a=a>>>0;return function(){a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296}}
const ri=(r,a,b)=>a+Math.floor(r()*(b-a+1));
const pick=(r,a)=>a[Math.floor(r()*a.length)];
function shuffle(r,a){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function gcd(a,b){a=Math.abs(a);b=Math.abs(b);while(b){[a,b]=[b,a%b]}return a}
class Fr{
  constructor(n,d=1){if(d===0)throw new Error('zero denominator');if(d<0){n=-n;d=-d}const g=gcd(n,d)||1;this.n=n/g;this.d=d/g}
  static of(x){return x instanceof Fr?x:new Fr(x,1)}
  add(o){o=Fr.of(o);return new Fr(this.n*o.d+o.n*this.d,this.d*o.d)}
  sub(o){o=Fr.of(o);return new Fr(this.n*o.d-o.n*this.d,this.d*o.d)}
  mul(o){o=Fr.of(o);return new Fr(this.n*o.n,this.d*o.d)}
  div(o){o=Fr.of(o);return new Fr(this.n*o.d,this.d*o.n)}
  neg(){return new Fr(-this.n,this.d)}
  pow(k){let r=new Fr(1);for(let i=0;i<k;i++)r=r.mul(this);return r}
  get v(){return this.n/this.d}
  isInt(){return this.d===1}
  tex(){if(this.d===1)return String(this.n);return(this.n<0?'-':'')+'\\frac{'+Math.abs(this.n)+'}{'+this.d+'}'}
}
const F=(n,d=1)=>new Fr(n,d);
const tx=x=>x instanceof Fr?x.tex():String(x);
const isNeg=x=>x instanceof Fr?x.n<0:x<0;
const P=x=>isNeg(x)?'\\left('+tx(x)+'\\right)':tx(x);       // parenthesize negatives
function ord(n){const s=['th','st','nd','rd'],v=n%100;return n+(s[(v-20)%10]||s[v]||s[0])}
function seriesStr(ts){let s=tx(ts[0]);for(let i=1;i<ts.length;i++){const t=Fr.of(ts[i]);s+=t.n<0?' - '+t.neg().tex():' + '+t.tex()}return s}
function poly(cs,v='n'){ // cs: [[coef,power],...] -> tex
  let s='';for(const [c,p] of cs){if(!c)continue;const a=Math.abs(c);const var_=p===0?'':p===1?v:v+'^'+p;
    const body=(a===1&&p!==0)?var_:a+var_;s+=(s===''?(c<0?'-':''):(c<0?' - ':' + '))+body}return s||'0'}
const fib=(()=>{const f=[0,1,1];for(let i=3;i<80;i++)f[i]=f[i-1]+f[i-2];return f})();
const fact=n=>{let r=1;for(let i=2;i<=n;i++)r*=i;return r};
const sq=n=>n*(n+1)*(2*n+1)/6, tri=n=>n*(n+1)/2;

/* turn generator output into 5 sorted answer choices */
function toOpt(x){if(x==null)return null;if(x instanceof Fr)return{tex:x.tex(),v:x.v};if(typeof x==='number')return Number.isFinite(x)?{tex:String(x),v:x}:null;return x}
function build(a,ws){
  const c=toOpt(a);const opts=[c];const seenT=new Set([c.tex]);const seenV=new Set([c.v]);
  const add=o=>{if(!o||!Number.isFinite(o.v)||seenT.has(o.tex)||seenV.has(o.v))return;seenT.add(o.tex);seenV.add(o.v);opts.push(o)};
  for(const w of ws){if(opts.length>=5)break;add(toOpt(w))}
  let k=1;
  while(opts.length<5&&k<80&&(typeof a==='number'||a instanceof Fr)){
    const base=Fr.of(a);const step=base.isInt()?F(1):F(1,base.d);const m=Math.ceil(k/2);
    const s=k%2?base.add(step.mul(m)):base.sub(step.mul(m));
    add(toOpt(typeof a==='number'?s.v:s));k++;
  }
  const mods=[[t=>String.raw`2\left(`+t+String.raw`\right)`,v=>2*v],[t=>String.raw`\tfrac{1}{2}\left(`+t+String.raw`\right)`,v=>v/2],[t=>t+'+1',v=>v+1],[t=>t+'-1',v=>v-1],[t=>String.raw`-\left(`+t+String.raw`\right)`,v=>-v],[t=>t+'+2',v=>v+2]];
  const textual=/=|\\text|^\s*[\[(]|\\cup/.test(c.tex);   // equations, words, intervals, points: no arithmetic variants
  if(!textual)for(const [ft,fv] of mods){if(opts.length>=5)break;add({tex:ft(c.tex),v:fv(c.v)})}
  opts.sort((x,y)=>x.v-y.v);
  return{choices:opts.map(o=>'$'+o.tex+'$'),ans:opts.indexOf(c)};
}


const GENS={};
/* ---------- extra helpers for generators ---------- */
const O=(tex,v)=>({tex,v});
const lcm=(a,b)=>a/gcd(a,b)*b;
function isPrime(n){if(n<2)return false;for(let i=2;i*i<=n;i++)if(n%i===0)return false;return true}
function factorize(n){const f={};for(let p=2;p*p<=n;p++)while(n%p===0){f[p]=(f[p]||0)+1;n/=p}if(n>1)f[n]=(f[n]||0)+1;return f}
const ndiv=n=>Object.values(factorize(n)).reduce((a,e)=>a*(e+1),1);
function sigmaDiv(n){let s=0;for(let i=1;i*i<=n;i++)if(n%i===0){s+=i;if(i*i!==n)s+=n/i}return s}
function comb(n,k){if(k<0||k>n)return 0;k=Math.min(k,n-k);let r=1;for(let i=1;i<=k;i++)r=r*(n-k+i)/i;return Math.round(r)}
function modpow(b,e,m){let r=1%m;b%=m;while(e>0){if(e&1)r=r*b%m;b=b*b%m;e=Math.floor(e/2)}return r}
const digsum=n=>String(Math.abs(n)).split('').reduce((a,d)=>a+ +d,0);
function phi(n){let r=n;for(const p of Object.keys(factorize(n)))r=r/ +p*(p-1);return r}
function factTex(n){return Object.entries(factorize(n)).map(([p,e])=>e>1?p+'^{'+e+'}':p).join(String.raw`\cdot `)}
/* c·√n simplified, returned as an answer option {tex,v} */
function R(c,n){let k=1,m=n;for(let i=2;i*i<=m;i++)while(m%(i*i)===0){m/=i*i;k*=i}c*=k;
  if(m===1)return O(String(c),c);return O((c===1?'':c===-1?'-':c)+String.raw`\sqrt{`+m+'}',c*Math.sqrt(m))}
/* fraction (or integer) times π */
function PI(x){x=Fr.of(x);const n=x.n,d=x.d;const num=(Math.abs(n)===1?'':Math.abs(n))+String.raw`\pi`;
  const tex=(n<0?'-':'')+(d===1?num:String.raw`\frac{`+num+'}{'+d+'}');return O(tex,x.v*Math.PI)}
/* fraction times √m */
function FR(x,m){x=Fr.of(x);if(m===1)return O(x.tex(),x.v);const n=x.n,d=x.d;const num=(Math.abs(n)===1?'':Math.abs(n))+String.raw`\sqrt{`+m+'}';
  return O((n<0?'-':'')+(d===1?num:String.raw`\frac{`+num+'}{'+d+'}'),x.v*Math.sqrt(m))}
const sample=(r,arr,k)=>shuffle(r,arr).slice(0,k);
function sqd(n){let k=1,m=n;for(let i=2;i*i<=m;i++)while(m%(i*i)===0){m/=i*i;k*=i}return[k,m]}
/* data that arrives from the sync database is untrusted: keys must not touch object internals,
   ids must be plain tokens before they go anywhere near HTML */
const safeKey=k=>typeof k==='string'&&!/^(__proto__|constructor|prototype)$/.test(k);
const safeId=k=>typeof k==='string'&&/^[A-Za-z0-9_-]{1,64}$/.test(k);
const safeColor=c=>typeof c==='string'&&/^#[0-9a-fA-F]{3,8}$/.test(c);
/* fingerprints of the libraries loaded on demand: a changed or tampered copy is refused by the browser */
const SRI={
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js':'sha384-/1qUCSGwTur9vjf/z9lmu/eCUYbpOTgSjmpbMQZ1/CtX2v/WcAIKqRv+U1DUCG6e',
  'https://cdnjs.cloudflare.com/ajax/libs/jquery/3.7.1/jquery.min.js':'sha384-1H217gwSVyLSIfaLxHbE7dRb3v4mYCKbpQvzx0cegeju1MVsGrX5xXxAvs/HgeFs',
  'https://cdnjs.cloudflare.com/ajax/libs/mathquill/0.10.1/mathquill.min.css':'sha384-HE6mLTh5BORvU8h5XUAu/rs2s1+04dQTYoMsAAQd7wK5DtzQVFjtQdEtaPXtoeh3',
  'https://cdnjs.cloudflare.com/ajax/libs/mathquill/0.10.1/mathquill.min.js':'sha384-/RBk1jltzHKz5l1cUO7JrI/xiKAtaZjvvBvu1/wSkohgWoJ2toB+6IRzMvemWy+f',
  'https://cdn.jsdelivr.net/npm/nerdamer@1.1.13/nerdamer.core.js':'sha384-xQSEWC9U3TkEcP2wa+TfVlioD35y0B9w5UDICbHR1VbBRt/Sta9vVtiI7OipX2YP',
  'https://cdn.jsdelivr.net/npm/nerdamer@1.1.13/Algebra.js':'sha384-Fe6m/6uHCTl86ItmvzSPYPzE16B0zARqm1Bo5Z8oKGHcnQnvkBe0hYavSadUjSqV',
  'https://cdn.jsdelivr.net/npm/nerdamer@1.1.13/Calculus.js':'sha384-zEv30J3CdpM8w5+WYPmcuv8lUhq3n8qzbDYU3sbZqHluSTmdsjJMBHJWHoqw6Cla',
  'https://cdn.jsdelivr.net/npm/nerdamer@1.1.13/Solve.js':'sha384-Cd8aK9hE0bOs/4mmDSGOQ3XiHDSs4LMlFFpd8/SzTbVyr07tooiOnw2wkA4D2Off'
};
function loadScript(src){return new Promise((ok,no)=>{const s=document.createElement('script');s.src=src;
  if(SRI[src]){s.integrity=SRI[src];s.crossOrigin='anonymous'}s.onload=ok;s.onerror=()=>no(new Error('Could not load '+src));document.head.appendChild(s)})}
function loadStyle(href){const l=document.createElement('link');l.rel='stylesheet';l.href=href;if(SRI[href]){l.integrity=SRI[href];l.crossOrigin='anonymous'}document.head.appendChild(l);return l}
