import {createServer,IncomingMessage,ServerResponse} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,extname,sep} from 'node:path';
import {identity,ready,validLogin,sessionCookie,clearCookie,authenticated} from './auth';
import {db,bucket,json,storageConfigured} from './store';
import * as drafts from '../app/api/drafts/route';
import * as ingest from '../app/api/ingest/route';
import * as post from '../app/api/post/route';
import * as status from '../app/api/status/route';
import * as media from '../app/media/[key]/route';
import * as ticket from '../app/api/media-ticket/[ticket]/route';

const origin=process.env.PUBLIC_ORIGIN||process.env.RENDER_EXTERNAL_URL;
if(!origin||!/^https?:\/\/[^/]+$/.test(origin))throw new Error('PUBLIC_ORIGIN must be an origin without a trailing slash');
const secure=origin.startsWith('https:');
if(!secure&&!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin))throw new Error('HTTPS required');
const client=resolve(fileURLToPath(new URL('../client/',import.meta.url)));
const mime:Record<string,string>={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
const login=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sign in · AITS Content Studio</title><style>body{font:16px system-ui;background:#eef4fa;color:#152d48;display:grid;place-items:center;min-height:95vh}main{background:white;padding:36px;border-radius:18px;width:min(340px,80vw)}input,button{display:block;box-sizing:border-box;width:100%;padding:12px;margin:10px 0 20px;border:1px solid #c5d4e3;border-radius:8px}button{background:#1264be;color:white;cursor:pointer}small{color:#52677c}</style><main><h1>AITS Content Studio</h1><p>Team sign in · เข้าสู่ระบบทีม</p><form method="post" action="/login"><label>Username<input name="username" autocomplete="username" required maxlength="100"></label><label>Password<input type="password" name="password" autocomplete="current-password" required maxlength="256"></label><button>Sign in / เข้าสู่ระบบ</button></form><small>Use the team access details provided by AITS.</small></main></html>`;
const failures=new Map<string,{count:number;until:number}>();
async function body(req:IncomingMessage,limit:number){let length=0;const chunks:Buffer[]=[];for await(const chunk of req){length+=chunk.length;if(length>limit)throw new Error('BODY_TOO_LARGE');chunks.push(Buffer.from(chunk));}return Buffer.concat(chunks);}
async function send(res:ServerResponse,response:Response){res.statusCode=response.status;response.headers.forEach((v,k)=>res.setHeader(k,v));res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');res.setHeader('Cache-Control','no-store');if(secure)res.setHeader('Strict-Transport-Security','max-age=31536000');res.end(Buffer.from(await response.arrayBuffer()));}
const redirect=(path:string,cookie?:string)=>new Response(null,{status:303,headers:{Location:path,...(cookie?{'Set-Cookie':cookie}:{})}});
async function handle(req:IncomingMessage):Promise<Response>{
 const url=new URL(req.url||'/',origin),path=url.pathname,method=req.method||'GET';
 if(url.origin!==origin)return json({error:'Invalid origin'},400);
 if(path==='/healthz')return json({ok:true,configured:ready()&&storageConfigured()});
 if(!ready()||!storageConfigured())return json({error:'Setup required: configure team access, INGEST_TOKEN, and Supabase database/storage in Render.'},503);
 if(path==='/logout')return redirect('/login',clearCookie(secure));
 if(path==='/login'){
  if(method==='GET')return new Response(login,{headers:{'Content-Type':'text/html; charset=utf-8'}});
  if(method!=='POST'||req.headers.origin!==origin)return json({error:'Forbidden'},403);
  // Bound the global failure map and attempts per proxy connection. No password is logged.
  const address=req.socket.remoteAddress||'unknown',now=Date.now();for(const [key,value] of failures)if(value.until<now)failures.delete(key);
  const failed=failures.get(address);if(failed&&failed.count>=15)return json({error:'Too many attempts. Try again in 15 minutes.'},429);
  const fields=new URLSearchParams((await body(req,4096)).toString());
  if(!validLogin(fields.get('username')||'',fields.get('password')||'')){failures.set(address,{count:(failed?.count||0)+1,until:failed?.until||now+900000});return new Response(login.replace('<form','<p role="alert">Invalid sign-in details / ข้อมูลไม่ถูกต้อง</p><form'),{status:401,headers:{'Content-Type':'text/html; charset=utf-8'}});}
  failures.delete(address);return redirect('/',sessionCookie(secure));
 }
 // n8n's ingestion uses its own bearer credential, never a browser session.
 if(path==='/api/ingest'&&method==='POST'){
  if(req.headers.authorization!=='Bearer '+process.env.INGEST_TOKEN)return json({error:'Unauthorized'},401);
  const bytes=await body(req,40000000);return ingest.POST(new Request(url,{method,headers:{'content-type':'application/json',authorization:req.headers.authorization},body:new Uint8Array(bytes)}));
 }
 if(path.startsWith('/api/media-ticket/')&&method==='GET')return ticket.GET(new Request(url,{headers:{authorization:req.headers.authorization||''}}),{params:Promise.resolve({ticket:path.slice('/api/media-ticket/'.length)})});
 // Only expiring, unguessable tickets expose approved images to Instagram.
 if(path.startsWith('/public-media/')&&method==='GET'){
  const id=path.slice('/public-media/'.length);if(!/^[a-f0-9]{64}$/.test(id))return json({},404);
  const row=await db().prepare('SELECT object_key FROM media_tickets WHERE id=? AND expires_at>?').bind(id,Date.now()).first();if(!row)return json({},404);const file=await bucket().get(row.object_key);return file?new Response(file.body,{headers:{'Content-Type':'image/jpeg'}}):json({},404);
 }
 if(!authenticated(req.headers.cookie||''))return path.startsWith('/api/')?json({error:'Sign in required'},401):redirect('/login');
 return identity.run({userId:process.env.STUDIO_USER!,email:process.env.STUDIO_USER!,displayName:'AITS Team'},async()=>{
  if(path==='/api/drafts'&&method==='GET')return drafts.GET();
  if(path==='/api/status'&&method==='GET')return status.GET();
  if((path==='/api/drafts'&&method==='PATCH')||(path==='/api/post'&&method==='POST')){
   if(req.headers.origin!==origin)return json({error:'Forbidden'},403);
   const bytes=await body(req,1000000);const request=new Request(url,{method,headers:{'content-type':'application/json',origin:origin!},body:new Uint8Array(bytes)});return path==='/api/post'?post.POST(request):drafts.PATCH(request);
  }
  if(path.startsWith('/media/')&&method==='GET')return media.GET(new Request(url),{params:Promise.resolve({key:path.slice('/media/'.length)})});
  if(method!=='GET'||(path!=='/'&&!path.startsWith('/assets/')))return json({},404);
  const file=resolve(client,'.'+(path==='/'?'/index.html':decodeURIComponent(path)));if(!file.startsWith(client+sep))return json({},404);
  try{return new Response(await readFile(file),{headers:{'Content-Type':mime[extname(file)]||'application/octet-stream'}});}catch{return json({},404);}
 });
}
const server=createServer(async(req,res)=>{try{await send(res,await handle(req));}catch(error:any){await send(res,json({error:error.message==='BODY_TOO_LARGE'?'Request too large':'Request failed'},error.message==='BODY_TOO_LARGE'?413:500));}});
server.requestTimeout=180000;server.headersTimeout=20000;
server.listen(Number(process.env.PORT||10000),'0.0.0.0',()=>console.log('AITS Content Studio listening; posting '+(process.env.POSTING_ENABLED==='true'?'enabled':'disabled')));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));
