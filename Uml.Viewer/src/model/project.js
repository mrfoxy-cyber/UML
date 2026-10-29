(function(root){
  'use strict';const U=root.UmlViewer,C=U.Contract;
  const pathRule={type:'string',minLength:1,maxLength:240};
  const schema={$schema:'https://json-schema.org/draft/2020-12/schema',title:'UML project manifest',type:'object',additionalProperties:false,required:['version','kind','id','title','model','diagrams'],properties:{$schema:{type:'string',maxLength:500},version:{const:1},kind:{const:'uml-project'},id:C.schema.properties.id,title:C.schema.properties.title,model:pathRule,diagrams:{type:'array',minItems:1,maxItems:30,uniqueItems:true,items:pathRule}}};
  const fail=(path,message)=>{throw new C.InputError(path,message);};
  function safePath(path){if(typeof path!=='string'||!path.endsWith('.json')||path.includes('\\')||path.includes(':')||path.split('/').some(p=>!p||p==='.'||p==='..'))fail(path||'$','Use a relative .json path inside this project; parent paths and URLs are not allowed.');return path;}
  function assemble(files,manifestPath){
    if(!(files instanceof Map)||files.size>64)fail('$','Select a project containing at most 64 JSON files.');
    const manifest=C.read(files.get(manifestPath));C.check(manifest,schema);safePath(manifestPath);
    const prefix=manifestPath.slice(0,manifestPath.lastIndexOf('/')+1),sources=new Map([[manifestPath,files.get(manifestPath)]]),loaded=new Set();
    function read(relative,allowed,required){
      const path=prefix+safePath(relative);if(loaded.has(path))fail(path,'Each source file must be listed once.');loaded.add(path);
      if(!files.has(path))fail(path,'Project file is missing. Select the whole project folder.');
      const raw=files.get(path),value=C.read(raw);C.check(value,{type:'object',additionalProperties:false,required,properties:allowed},path);sources.set(path,raw);return value;
    }
    const p=C.schema.properties,model=read(manifest.model,{elements:p.elements,tests:p.tests,useCases:p.useCases,groups:p.groups,relationships:p.relationships},['elements']);
    const document={version:1,id:manifest.id,title:manifest.title,...model,interactions:{},activities:{},views:[]};
    const viewIds=new Set();
    for(const file of manifest.diagrams){
      const shard=read(file,{interactions:p.interactions,activities:p.activities,views:p.views},['views']);
      for(const section of ['interactions','activities'])for(const [id,value] of Object.entries(shard[section]||{})){
        if(Object.hasOwn(document[section],id))fail(file+'.'+section+'.'+id,'Conflicting definition. Give each interaction or activity one source file.');
        Object.defineProperty(document[section],id,{value,enumerable:true,configurable:true,writable:true});
      }
      for(const view of shard.views){if(viewIds.has(view.id))fail(file+'.views','Duplicate view ID "'+view.id+'".');viewIds.add(view.id);document.views.push(view);}
    }
    C.validate(document);return {document,sources,manifestPath};
  }
  U.Project={schema,assemble};
  if(typeof module==='object'&&module.exports)module.exports=U.Project;
})(globalThis);
