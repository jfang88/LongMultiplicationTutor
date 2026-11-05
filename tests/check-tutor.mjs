// Dependency-free regression checks: node tests/check-tutor.mjs
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const inline=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(inline,'Missing app script');
const compiled=new vm.Script(inline,{filename:'index.html inline JS'});

const elements=new Map();
function get(id){
  if(elements.has(id))return elements.get(id);
  const classes=new Set(),handlers={};
  const el={
    value:'',textContent:'',innerHTML:'',style:{},
    classList:{
      toggle:(c,on)=>{if(on===undefined)on=!classes.has(c);if(on)classes.add(c);else classes.delete(c);},
      contains:c=>classes.has(c)
    },
    addEventListener:(event,handler)=>{handlers[event]=handler;},
    trigger:(event)=>{assert.ok(handlers[event],id+': missing '+event);handlers[event]({preventDefault(){}});},
    querySelector:()=>get(id+'-span'),
    replaceChildren:(...nodes)=>{el.innerHTML=nodes.map(n=>n.textContent).join('');},
    focus(){}
  };
  el.parentElement={classList:el.classList};
  elements.set(id,el);
  return el;
}
get('path').value='guided';
get('level').value='medium';
get('top').value='324';
get('bottom').value='16';
const win={};
compiled.runInNewContext({
  document:{getElementById:get,createElement:()=>({textContent:'',className:''})},
  window:win,Intl
});
assert.equal(get('problem').textContent,'324 × 16','Tutor must start');
const calculate=win.LongMultiplicationTutor?.generateSteps;
assert.equal(typeof calculate,'function');

function finish(path,a,b){
  get('path').value=path;
  get('path').trigger('change');
  get('top').value=String(a);
  get('bottom').value=String(b);
  get('use').trigger('click');
  const steps=calculate(a,b,path);
  if(path==='area'){
    const view=get('visual').innerHTML;
    assert.ok(view.includes('place-addition'),'Area addition grid missing');
    assert.ok(view.includes('Line up the digits on the RIGHT'),'Alignment reminder missing');
    assert.equal((view.match(/place-add-row working/g)||[]).length,6);
  }
  steps.forEach((step,i)=>{
    if(step.kind==='choice')get('choice').value=step.expected;
    else{
      get('answer').value=String(step.expected);
      if(step.expectedCarry!==undefined&&step.expectedCarry!==null)
        get('carry').value=String(step.expectedCarry);
    }
    get('answer-form').trigger('submit');
    assert.ok(get('feedback').innerHTML,'Missing feedback');
    if(i<steps.length-1)get('next').trigger('click');
  });
  assert.ok(get('feedback').innerHTML.includes('Fantastic'),'Exercise did not complete');
}
for(const [a,b] of [[234,12],[708,42],[999,99],[100,10]])finish('area',a,b);
finish('guided',324,16);
finish('expanded',243,14);
finish('formal',708,42);

let total=0;
for(let a=100;a<=999;a++)for(let b=10;b<=99;b++){
  const steps=calculate(a,b,'area').filter(s=>s.kind==='area-add');
  assert.equal(steps.length,String(a*b).length);
  for(const s of steps){
    assert.equal(s.expected,Math.floor(a*b/10**s.col)%10);
    if(s.expectedCarry!==null)
      assert.equal(s.expectedCarry,Math.floor((s.carryIn+s.digits.reduce((x,y)=>x+y,0))/10));
  }
  total++;
}
console.log('PASS: app startup, four lesson pathways, carrying and '+total+' calculations');
