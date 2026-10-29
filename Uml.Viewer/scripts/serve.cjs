// Optional preview server for development. The distributed viewer also opens directly from disk.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),port=Number(process.env.UML_VIEWER_PORT||4173);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.md':'text/plain; charset=utf-8','.svg':'image/svg+xml'};
http.createServer((request,response)=>{
  if(!['GET','HEAD'].includes(request.method)){response.writeHead(405);return response.end();}
  let file;try{const url=new URL(request.url,'http://localhost');file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));}catch{response.writeHead(400);return response.end();}
  const relative=path.relative(root,file);
  if(relative.startsWith('..')||path.isAbsolute(relative)||relative.split(path.sep).some(p=>['.git','.cache','node_modules'].includes(p))){response.writeHead(403);return response.end();}
  if(!fs.existsSync(file)||!fs.statSync(file).isFile()){response.writeHead(404);return response.end('Not found');}
  response.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});
  if(request.method==='HEAD')return response.end();fs.createReadStream(file).pipe(response);
}).listen(port,'127.0.0.1',()=>console.log('UML viewer preview: http://127.0.0.1:'+port));
