/* ====================== content model ====================== */
const SET_SIZE=50;
let BANK={},SETS={};

function parseBank(txt){
  const bank={};
  for(const sec of txt.split(/^@@\s*/m).slice(1)){
    const nl=sec.indexOf('\n');const sub=sec.slice(0,nl).trim();bank[sub]=[];
    for(const blk of sec.slice(nl+1).split(/^---\s*$/m)){
      const f={W:[]};let key=null;
      for(const line of blk.split(/\r?\n/)){
        const m=line.match(/^([QALWS]):\s?(.*)$/);
        if(m){key=m[1];if(key==='W')f.W.push(m[2]);else f[key]=m[2]}
        else if(key&&line.trim()!==''){if(key==='W')f.W[f.W.length-1]+='\n'+line;else f[key]+='\n'+line}
      }
      if(f.Q)bank[sub].push(f);
    }
  }
  return bank;
}
const fmt=s=>(s||'').trim().split(/\r?\n/).join('<br>');
const wrapM=s=>{s=s.trim();return s.replace(/\\\$/g,'').includes('$')?s:'$'+s+'$'};   // \$ is a literal dollar sign, not a delimiter

function mkClassic(sub,f,i){
  const id=sub+'-c'+(i+1);const r=rng(hash(id));
  const all=[f.A,...f.W].map(wrapM);const order=shuffle(r,[0,1,2,3,4]);
  return{id,sub,src:'c',lvl:+f.L||2,q:fmt(f.Q),choices:order.map(k=>all[k]),ans:order.indexOf(0),sol:fmt(f.S)};
}
function mkGen(sub,gen,seed,id){
  const r=rng(seed);const g=gen(r);const b=build(g.a,g.w);
  return{id,sub,src:'g',lvl:g.lvl||1,q:g.q,choices:b.choices,ans:b.ans,sol:g.s};
}
function buildSet(sub){
  const classics=(BANK[sub]||[]).map((f,i)=>mkClassic(sub,f,i));
  const gens=GENS[sub]||[];const out=classics.slice();const seen=new Set(out.map(x=>x.q));
  let n=0;
  while(gens.length&&out.length<Math.max(SET_SIZE,classics.length+20)&&n<3000){
    const g=gens[n%gens.length];let it;try{it=mkGen(sub,g,hash(sub+'#'+n),sub+'-g'+n)}catch(e){n++;continue}n++;
    if(seen.has(it.q))continue;seen.add(it.q);out.push(it);
  }
  return out;
}
function loadData(bankText){BANK=parseBank(bankText);for(const s of SUBS)SETS[s.id]=buildSet(s.id)}
function freshGen(sub,count){
  const gens=GENS[sub];const out=[];const base=(Date.now()^Math.floor(Math.random()*1e9))>>>0;
  for(let i=0;out.length<count&&i<count*5;i++){const g=gens[Math.floor(Math.random()*gens.length)];let it;try{it=mkGen(sub,g,base+i*7919,'p'+base+'-'+i)}catch(e){continue}if(!out.some(o=>o.q===it.q))out.push(it)}
  return out;
}

