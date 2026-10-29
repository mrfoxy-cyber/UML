(function(root){
  'use strict';
  const U=root.UmlViewer ||= {};
  const TYPES={class:'Class diagram',aggregation:'Aggregation diagram',component:'Component diagram',sequence:'Sequence diagram',communication:'Communication diagram',object:'Object diagram',package:'Package diagram','composite-structure':'Composite structure diagram',deployment:'Deployment diagram',profile:'Profile diagram','use-case':'Use-case diagram',activity:'Activity diagram','state-machine':'State-machine diagram','interaction-overview':'Interaction overview diagram',timing:'Timing diagram'};
  const SUPPORTED=['class','aggregation','component','sequence','communication'];
  const ELEMENTS=['class','interface','enum','component','actor'];
  const RELATIONS=['dependency','association','inheritance','implementation','aggregation','composition'];
  const ID={type:'string',pattern:'^[A-Za-z][A-Za-z0-9._-]*$',minLength:1,maxLength:120};
  const text=(max=1000)=>({type:'string',minLength:1,maxLength:max});
  const array=(items,max=300,min=0)=>({type:'array',items,maxItems:max,minItems:min});
  const object=(properties,required=[])=>({type:'object',properties,required,additionalProperties:false});
  const ref=name=>({$ref:'#/$defs/'+name});
  const ids={...array(ID,200),uniqueItems:true};
  const state=object({name:text(240),show:{...array({enum:['name','kind','members','notes','count','steps','guards']},7,1),uniqueItems:true}});
  const display=object({initial:{enum:['collapsed','expanded']},collapsible:{type:'boolean'},collapsed:state,expanded:state});
  const element=object({kind:{enum:ELEMENTS},name:text(240),members:array(text(1600),200),notes:text(6000),display:ref('display')},['kind','name']);
  const group=object({id:ID,name:text(240),members:{...ids,minItems:1},notes:text(6000),display:ref('display')},['id','name','members']);
  const relation=object({id:ID,kind:{enum:RELATIONS},from:ID,to:ID,label:text(500),fromMultiplicity:text(40),toMultiplicity:text(40)},['id','kind','from','to']);
  const message=object({id:ID,kind:{enum:['call','reply']},from:ID,to:ID,label:text(1200)},['id','kind','from','to','label']);
  const alternative=object({id:ID,kind:{const:'alt'},name:text(240),display:ref('display'),branches:array(object({guard:text(500),steps:array(ref('step'),600)},['guard','steps']),8,2)},['id','kind','branches']);
  const interaction=object({story:ID,scenario:ID,participants:{...ids,minItems:1,maxItems:24},steps:array(ref('step'),600,1)},['participants','steps']);
  const dictionary=(values,max)=>({type:'object',propertyNames:ID,additionalProperties:values,maxProperties:max});
  const schema={
    $schema:'https://json-schema.org/draft/2020-12/schema',
    $id:'urn:uml-json-viewer:document:1',title:'UML viewer document',
    ...object({$schema:text(500),version:{const:1},id:ID,title:text(240),elements:{...dictionary(ref('element'),150),minProperties:1},groups:array(ref('group'),50),relationships:array(ref('relationship'),600),interactions:dictionary(ref('interaction'),12),views:array(object({id:ID,type:{enum:SUPPORTED},title:text(240),elements:ids,interaction:ID},['id','type','title']),30,1)},['version','id','title','elements','views']),
    $defs:{display,element,group,relationship:relation,step:{oneOf:[message,alternative]},interaction}
  };
  class InputError extends Error {
    constructor(path,message){super(message);this.name='InputError';this.path=path;}
  }
  const fail=(path,message)=>{throw new InputError(path,message);};
  function scan(text){
    const stack=[];
    for(let i=0;i<text.length;i++){
      const c=text[i];
      if(c==='{'||c==='['){stack.push(c==='{'?new Set():null);if(stack.length>40)fail('$','The JSON is nested too deeply (maximum 40 levels).');}
      else if(c==='}'||c===']')stack.pop();
      else if(c==='"'){
        const start=i;
        for(i++;i<text.length;i++){if(text[i]==='\\')i++;else if(text[i]==='"')break;}
        let next=i+1;while(/\s/.test(text[next]||'!'))next++;
        if(text[next]===':'&&stack.at(-1) instanceof Set){
          let key;try{key=JSON.parse(text.slice(start,i+1));}catch{continue;}
          if(stack.at(-1).has(key)){
            const line=text.slice(0,start).split('\n').length;
            fail('$',`Duplicate property "${key}" at line ${line}. Keep one definition.`);
          }
          stack.at(-1).add(key);
        }
      }
    }
  }
  function check(value,rule,path='$'){
    if(rule.$ref)return check(value,schema.$defs[rule.$ref.split('/').at(-1)],path);
    if(rule.oneOf){
      const matches=rule.oneOf.filter(candidate=>{try{check(value,candidate,path);return true;}catch{return false;}});
      if(matches.length!==1)fail(path,'Expected a call/reply message or an alt block with guarded branches. Check its fields and step kind.');
      return;
    }
    if(Object.hasOwn(rule,'const')&&value!==rule.const)fail(path,`Expected ${JSON.stringify(rule.const)}.`);
    if(rule.enum&&!rule.enum.includes(value))fail(path,`Expected one of: ${rule.enum.join(', ')}. Received ${JSON.stringify(value)}.`);
    if(rule.type){
      const valid=rule.type==='array'?Array.isArray(value):rule.type==='object'?value!==null&&typeof value==='object'&&!Array.isArray(value):typeof value===rule.type;
      if(!valid)fail(path,`Expected ${rule.type}.`);
    }
    if(typeof value==='string'){
      if(rule.minLength&&value.trim().length<rule.minLength)fail(path,'Provide a non-empty value.');
      if(rule.maxLength&&value.length>rule.maxLength)fail(path,`Maximum length is ${rule.maxLength} characters.`);
      if(rule.pattern&&!new RegExp(rule.pattern).test(value))fail(path,'Use an ID beginning with a letter, followed by letters, digits, dots, underscores or hyphens.');
    }
    if(Array.isArray(value)){
      if(rule.minItems&&value.length<rule.minItems)fail(path,`Provide at least ${rule.minItems} item(s).`);
      if(rule.maxItems&&value.length>rule.maxItems)fail(path,`Maximum ${rule.maxItems} items.`);
      if(rule.uniqueItems&&new Set(value.map(v=>JSON.stringify(v))).size!==value.length)fail(path,'Remove duplicate values.');
      if(rule.items)value.forEach((item,i)=>check(item,rule.items,`${path}[${i}]`));
    }else if(value&&typeof value==='object'){
      const keys=Object.keys(value);
      if(rule.maxProperties&&keys.length>rule.maxProperties)fail(path,`Maximum ${rule.maxProperties} entries.`);
      if(rule.minProperties&&keys.length<rule.minProperties)fail(path,'Provide at least one entry.');
      for(const key of rule.required||[])if(!Object.hasOwn(value,key))fail(path+'.'+key,'This field is required.');
      for(const key of keys){
        if(rule.propertyNames)check(key,rule.propertyNames,path+'.'+key);
        if(rule.properties&&Object.hasOwn(rule.properties,key))check(value[key],rule.properties[key],path+'.'+key);
        else if(rule.additionalProperties===false)fail(path+'.'+key,'Unknown field. Check the spelling or input version.');
        else if(rule.additionalProperties&&typeof rule.additionalProperties==='object')check(value[key],rule.additionalProperties,path+'.'+key);
      }
    }
  }
  function validate(document){
    if(document&&Object.hasOwn(document,'version')&&document.version!==1)fail('$.version',`Version ${document.version} is not supported. This viewer reads version 1.`);
    if(Array.isArray(document?.views))document.views.forEach((view,i)=>{
      if(!view||!Object.hasOwn(view,'type'))fail(`$.views[${i}].type`,'Declare a UML diagram type.');
      if(!Object.hasOwn(TYPES,view.type))fail(`$.views[${i}].type`,`Unknown diagram type "${view.type}".`);
      if(!SUPPORTED.includes(view.type))fail(`$.views[${i}].type`,`${TYPES[view.type]} is recognized but is not implemented in this release.`);
    });
    check(document,schema);
    const elements=new Map(Object.entries(document.elements));
    const exists=(id,path)=>{if(!elements.has(id))fail(path,`Unknown element "${id}".`);};
    const unique=(items,path)=>{const seen=new Set();items.forEach((item,i)=>{if(seen.has(item.id))fail(`${path}[${i}].id`,`Duplicate ID "${item.id}".`);seen.add(item.id);});};
    unique(document.views,'$.views');unique(document.groups||[],'$.groups');unique(document.relationships||[],'$.relationships');
    const membership=new Map();
    (document.groups||[]).forEach((group,i)=>{
      group.members.forEach((id,j)=>{exists(id,`$.groups[${i}].members[${j}]`);if(membership.has(id))fail(`$.groups[${i}].members`,`"${id}" already belongs to group "${membership.get(id)}". Version 1 supports flat, non-overlapping groups.`);membership.set(id,group.id);});
      displayFields(group.display,['name','count','members','notes'],`$.groups[${i}].display`);
    });
    for(const [id,element] of elements)displayFields(element.display,['name','kind','members','notes','count'],`$.elements.${id}.display`);
    (document.relationships||[]).forEach((r,i)=>{
      const path=`$.relationships[${i}]`;exists(r.from,path+'.from');exists(r.to,path+'.to');
      if(r.kind==='inheritance'&&(elements.get(r.from).kind!==elements.get(r.to).kind||!['class','interface'].includes(elements.get(r.from).kind)))fail(path,'Inheritance connects a class to a class, or an interface to an interface.');
      if(r.kind==='implementation'&&(elements.get(r.from).kind!=='class'||elements.get(r.to).kind!=='interface'))fail(path,'Implementation points from a class to an interface.');
    });
    const parents=new Map();for(const r of document.relationships||[])if(r.kind==='inheritance'){if(!parents.has(r.from))parents.set(r.from,[]);parents.get(r.from).push(r.to);}
    const visited=new Set(),pending=new Set();
    function walk(id){if(pending.has(id))fail('$.relationships','Inheritance contains a cycle.');if(visited.has(id))return;pending.add(id);for(const p of parents.get(id)||[])walk(p);pending.delete(id);visited.add(id);}
    for(const id of parents.keys())walk(id);
    let totalSteps=0;
    for(const [id,interaction] of Object.entries(document.interactions||{})){
      const path='$.interactions.'+id;interaction.participants.forEach((p,i)=>exists(p,`${path}.participants[${i}]`));
      const participants=new Set(interaction.participants),stepIds=new Set();
      function steps(items,base,depth=0){
        if(depth>6)fail(base,'Alternative nesting is limited to six levels.');
        items.forEach((step,i)=>{
          const p=`${base}[${i}]`;if(++totalSteps>600)fail(p,'Maximum 600 interaction steps per document.');
          if(stepIds.has(step.id))fail(p+'.id',`Duplicate step ID "${step.id}" in this interaction.`);stepIds.add(step.id);
          if(step.kind==='alt'){displayFields(step.display,['name','count','steps','guards'],p+'.display');step.branches.forEach((b,j)=>steps(b.steps,`${p}.branches[${j}].steps`,depth+1));}
          else for(const end of ['from','to'])if(!participants.has(step[end]))fail(p+'.'+end,`"${step[end]}" is not a participant in this interaction.`);
        });
      }
      steps(interaction.steps,path+'.steps');
    }
    document.views.forEach((view,i)=>{
      const path=`$.views[${i}]`;
      if(['sequence','communication'].includes(view.type)){
        if(!view.interaction||!Object.hasOwn(document.interactions||{},view.interaction))fail(path+'.interaction','Reference an interaction defined in this document.');
        if(view.elements)fail(path+'.elements','Interaction views use their interaction participants. Remove elements.');
      }else{
        if(!view.elements?.length)fail(path+'.elements','Choose at least one element for this structural view.');
        if(view.interaction)fail(path+'.interaction','Structural views select elements rather than an interaction.');
        view.elements.forEach((id,j)=>{exists(id,`${path}.elements[${j}]`);const allowed=view.type==='component'?['component']:['class','interface','enum'];if(!allowed.includes(elements.get(id).kind))fail(`${path}.elements[${j}]`,`A ${view.type} view cannot contain an element of kind "${elements.get(id).kind}".`);});
      }
    });
    return document;
  }
  function displayFields(display,allowed,path){if(!display)return;for(const state of ['collapsed','expanded'])for(const field of display[state]?.show||[])if(!allowed.includes(field))fail(path+'.'+state+'.show',`"${field}" is not a display field here. Choose: ${allowed.join(', ')}.`);}
  function parse(text){
    if(typeof text!=='string')fail('$','Load a text JSON file.');
    if(text.length>4*1024*1024)fail('$','The document is too large. Maximum 4 MB of JSON text.');
    text=text.replace(/^\uFEFF/,'');scan(text);
    let document;try{document=JSON.parse(text);}catch(error){fail('$','Invalid JSON. '+error.message);}
    return validate(document);
  }
  U.Contract={schema,TYPES,SUPPORTED,ELEMENTS,RELATIONS,InputError,parse,validate};
  if(typeof module==='object'&&module.exports)module.exports=U.Contract;
})(globalThis);
