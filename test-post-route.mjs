import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';
const compile=path=>ts.transpileModule(fs.readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {validateDraft,publicationKey}=await import('data:text/javascript;base64,'+Buffer.from(compile('./lib/contracts.ts')).toString('base64'));
const {MetaError}=await import('data:text/javascript;base64,'+Buffer.from(compile('./lib/meta.ts')).toString('base64'));
const body=compile('./app/api/post/route.ts').replace(/^import .*;\s*$/gm,'').replace(/^export /gm,'');
const make=new Function('getChatGPTUser','db','bucket','json','sameOrigin','settings','validateDraft','publicationKey','graph','MetaError',body+'\nreturn POST;');
function harness({expired=false,igPreparing=false,fbUncertain=false,demo=false}={}){
 const draft={id:'draft1234',title:'ตรวจวัดอุณหภูมิ',facebookCaption:'ปรึกษาเรื่องระบบตรวจวัด',instagramCaption:'เตรียมระบบตรวจวัดให้พร้อม',images:['/media/'+'a'.repeat(32)+'.jpg'],sources:[{url:'https://aitscctv.com/',title:'AITSCCTV'}],priority:'TREND',eventDate:new Date().toISOString(),expiresAt:new Date(Date.now()+(expired?-1000:86400000)).toISOString(),audience:'เจ้าของอาคาร',solution:'ระบบตรวจวัด',checks:['ตรวจช่วงวัด']};
 const row={id:draft.id,payload:JSON.stringify({...draft,demo}),revision:1,status:'DRAFT'};const publications=new Map();const calls=[];let preparing=igPreparing;
 const database={prepare(sql){let values=[];return {bind(...v){values=v;return this;},async first(){return sql.includes('FROM drafts')?row:publications.get(values[0]);},async all(){return {results:[...publications.values()]};},async run(){let changes=1;
  if(sql.startsWith('INSERT INTO publications')){const [id,draft_id,channel,revision]=values;const old=publications.get(id);if(old&&!['FAILED','PREPARING'].includes(old.status))changes=0;else publications.set(id,{...old,id,draft_id,channel,revision,status:'POSTING'});}
  else if(sql.startsWith('UPDATE publications')){const p=publications.get(values.at(-1));if(sql.includes("status='PUBLISHED'")){p.status='PUBLISHED';p.post_id=values[0];p.post_url=values[1];}else if(sql.includes("status='PREPARING'"))p.status='PREPARING';else if(sql.includes('SET status=?')){p.status=values[0];p.error=values[1];}else if(sql.includes('SET container_id=?'))p.container_id=values[0];else if(sql.includes('SET container_id=NULL'))p.container_id=null;else if(sql.includes('SET post_url=?'))p.post_url=values[0];}
  else if(sql.includes("SET status='POSTING'")){if(row.status==='DRAFT'&&row.revision===values[1])row.status='POSTING';else changes=0;}
  else if(sql.includes('UPDATE drafts SET status=?'))row.status=values[0];
  return {meta:{changes}};
 }}}};
 async function graph(path,token,version,data){calls.push({path,data});if(fbUncertain&&path==='fb/feed')throw new MetaError(true);if(path.includes('?fields=status_code'))return {status_code:preparing?'IN_PROGRESS':'FINISHED'};if(path.includes('?fields=permalink'))return {permalink:'https://www.instagram.com/p/test/'};return {id:'result'+calls.length};}
 const post=make(async()=>({userId:'owner'}),()=>database,()=>({get:async()=>({arrayBuffer:async()=>new Uint8Array([255,216]).buffer})}),(value,status=200)=>Response.json(value,{status}),()=>true,()=>({POSTING_ENABLED:'true',FACEBOOK_PAGE_ID:'fb',FACEBOOK_PAGE_TOKEN:'private',INSTAGRAM_ACCOUNT_ID:'ig',INSTAGRAM_TOKEN:'private',META_GRAPH_VERSION:'v25.0',N8N_MEDIA_BASE_URL:'https://relay.example/media'}),validateDraft,publicationKey,graph,MetaError);
 const request=(change={})=>new Request('https://studio.example/api/post',{method:'POST',body:JSON.stringify({id:row.id,revision:1,checked:true,...change})});
 return {post,request,calls,publications,row,finishImage:()=>{preparing=false;}};
}
let checks=0;
{const h=harness({demo:true});assert.equal((await h.post(h.request())).status,400);assert.equal(h.calls.length,0);checks++;}
for(const [change,status] of [[{checked:false},400],[{revision:2},409]]){const h=harness();assert.equal((await h.post(h.request(change))).status,status);assert.equal(h.calls.length,0);checks++;}
{const h=harness({expired:true});assert.equal((await h.post(h.request())).status,409);assert.equal(h.calls.length,0);checks++;}
{const h=harness();await h.post(h.request());assert([...h.publications.values()].every(p=>p.status==='PUBLISHED'));const count=h.calls.length;await h.post(h.request());assert.equal(h.calls.length,count);checks++;}
{const h=harness({igPreparing:true});await h.post(h.request());assert.equal(h.publications.get('draft1234:instagram').status,'PREPARING');h.finishImage();await h.post(h.request());assert.equal(h.publications.get('draft1234:instagram').status,'PUBLISHED');assert.equal(h.calls.filter(c=>c.path==='fb/feed').length,1);assert.equal(h.calls.filter(c=>c.path==='ig/media').length,1);checks++;}
{const h=harness({fbUncertain:true});await h.post(h.request());assert.equal(h.publications.get('draft1234:facebook').status,'UNKNOWN');const count=h.calls.length;await h.post(h.request());assert.equal(h.calls.length,count);checks++;}
console.log(checks+' publishing route checks passed (mocked platform and storage; no live posts)');
