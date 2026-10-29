const fs=require('node:fs');const path=require('node:path');
const root=path.resolve(__dirname,'..');
const contract=require('../src/validation/contract.js');
fs.mkdirSync(path.join(root,'schema'),{recursive:true});
fs.writeFileSync(path.join(root,'schema/uml-document.schema.json'),JSON.stringify(contract.schema,null,2)+'\n');
const labels={'bicycle-aggregation':'Bicycle · whole & parts','garage-structure':'Garage · classes & groups','parking-success':'Parking · two perspectives','components':'Components · dependencies','parking-alternatives':'Parking · guarded alternatives'};
const examples=fs.readdirSync(path.join(root,'examples')).filter(name=>name.endsWith('.json')).sort().map(filename=>{
  const text=fs.readFileSync(path.join(root,'examples',filename),'utf8');const data=contract.parse(text);
  return {id:data.id,label:labels[data.id]||data.title,filename,type:data.views[0].type,text};
});
fs.writeFileSync(path.join(root,'examples/examples.generated.js'),'globalThis.UmlViewer.Examples = '+JSON.stringify(examples,null,2)+';\n');
console.log('Published schema and '+examples.length+' validated, offline examples.');
