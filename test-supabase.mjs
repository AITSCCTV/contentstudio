import {PGlite} from '@electric-sql/pglite';
import fs from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
import {rootCertificates} from 'node:tls';
const compile=path=>ts.transpileModule(fs.readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const stripped=path=>compile(path).replace(/^import .*;\s*$/gm,'').replace(/^export /gm,'');
const {postgresQuery}=new Function(stripped('./render/postgres-query.ts')+';return {postgresQuery};')();
const {validateDraft,publicationKey}=new Function(stripped('./lib/contracts.ts')+';return {validateDraft,publicationKey};')();
const {MetaError}=new Function(stripped('./lib/meta.ts')+';return {MetaError};')();
const pg=new PGlite(),objects=new Map(),calls=[],env={DATABASE_URL:'postgresql://test:test@localhost/test?sslmode=disable',SUPABASE_URL:'https://project.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'synthetic-test-only',INGEST_TOKEN:'synthetic-ingest',POSTING_ENABLED:'true',FACEBOOK_PAGE_ID:'fb',FACEBOOK_PAGE_TOKEN:'synthetic-fb',INSTAGRAM_ACCOUNT_ID:'ig',INSTAGRAM_TOKEN:'synthetic-ig',META_GRAPH_VERSION:'v25.0',N8N_MEDIA_BASE_URL:'https://studio.test/public-media'};
let checks=0;const check=(a,b)=>{assert.equal(a,b);checks++;};
const postgres=(url,options)=>{check(new URL(url).searchParams.has('sslmode'),false);check(options.ssl.rejectUnauthorized,true);return {async unsafe(sql,values=[]){const result=await pg.query(sql,values),rows=result.rows;rows.count=result.affectedRows??rows.length;return rows;}};};
async function mockFetch(url,options){calls.push({url,options});check(options.headers.apikey,env.SUPABASE_SERVICE_ROLE_KEY);if(options.method==='POST'){objects.set(url.split('/').pop(),Buffer.from(options.body));return Response.json({ok:true});}assert(url.includes('/object/authenticated/'));checks++;const bytes=objects.get(url.split('/').pop());return bytes?new Response(bytes):new Response(null,{status:404});}
const {db,bucket}=new Function('postgres','schema','postgresQuery','fetch','process','rootCertificates','supabaseCA',stripped('./render/supabase-store.ts')+';return {db,bucket};')(postgres,fs.readFileSync(new URL('./drizzle/0000_ancient_madame_hydra.sql',import.meta.url),'utf8'),postgresQuery,mockFetch,{env},rootCertificates,fs.readFileSync(new URL('./render/certs/supabase-prod-ca-2021.crt',import.meta.url),'utf8'));
const json=(body,status=200)=>Response.json(body,{status});
const makeRoute=(path,extra={})=>new Function('getChatGPTUser','db','bucket','json','settings','validateDraft','sameOrigin','publicationKey','graph','MetaError',stripped(path)+';return {GET:typeof GET==="function"?GET:null,POST:typeof POST==="function"?POST:null,PATCH:typeof PATCH==="function"?PATCH:null};')(async()=>({userId:'team'}),db,bucket,json,()=>env,validateDraft,()=>true,publicationKey,extra.graph,MetaError);
const ingest=makeRoute('./app/api/ingest/route.ts'),drafts=makeRoute('./app/api/drafts/route.ts');
const request=body=>new Request('https://studio.test/api/ingest',{method:'POST',headers:{authorization:'Bearer '+env.INGEST_TOKEN},body:JSON.stringify(body)});
try{
 const draft={id:'postgres_test_draft',title:'ระบบตรวจวัดอุณหภูมิ',facebookCaption:'เตรียมระบบตรวจวัดให้พร้อม',instagramCaption:'ปรึกษาระบบตรวจวัด',images:[],sources:[{url:'https://aitscctv.com/',title:'AITSCCTV'}],priority:'EVERGREEN',eventDate:new Date().toISOString(),expiresAt:null,audience:'เจ้าของอาคาร',solution:'ระบบตรวจวัด',checks:['ตรวจข้อมูล']};
 const pack={draft,imageBase64:[Buffer.from([255,216,255,217]).toString('base64')]};
 check((await ingest.POST(request(pack))).status,200);check((await (await ingest.POST(request(pack))).json()).duplicate,true);
 const stored=(await (await drafts.GET()).json()).drafts;check(stored.length,1);check(stored[0].revision,1);
 check((await drafts.PATCH(new Request('https://studio.test/api/drafts',{method:'PATCH',body:JSON.stringify({draft:stored[0],revision:1})}))).status,200);
 check((await drafts.PATCH(new Request('https://studio.test/api/drafts',{method:'PATCH',body:JSON.stringify({draft:stored[0],revision:1})}))).status,409);
 check((await ingest.POST(request({run:{id:'pg-research',generatedAt:new Date().toISOString()}}))).status,200);
 const status=makeRoute('./app/api/status/route.ts');check((await (await status.GET()).json()).latestRun.id,'pg-research');
 const graphCalls=[];let preparing=true;
 const post=makeRoute('./app/api/post/route.ts',{async graph(path){graphCalls.push(path);if(path.includes('status_code'))return {status_code:preparing?'IN_PROGRESS':'FINISHED'};if(path.includes('permalink'))return {permalink:'https://www.instagram.com/p/test/'};return {id:'mock'+graphCalls.length};}});
 const publish=()=>post.POST(new Request('https://studio.test/api/post',{method:'POST',body:JSON.stringify({id:draft.id,revision:2,checked:true})}));
 let result=await (await publish()).json();check(result.results[0].status,'PUBLISHED');check(result.results[1].status,'PREPARING');
 preparing=false;result=await (await publish()).json();check(result.results[1].status,'PUBLISHED');check(graphCalls.filter(p=>p==='fb/feed').length,1);check(graphCalls.filter(p=>p==='ig/media').length,1);
 const count=graphCalls.length;await publish();check(graphCalls.length,count);
 const tickets=await db().prepare('SELECT * FROM media_tickets').all();check(tickets.results.length,1);assert(BigInt(tickets.results[0].expires_at)>BigInt(Date.now()));checks++;
 const media=await bucket().get(stored[0].images[0].split('/').pop());check((await media.arrayBuffer()).byteLength,4);
 assert(calls.every(c=>c.url.startsWith('https://project.supabase.co/storage/v1/')));checks++;
 console.log(`${checks} PostgreSQL/Supabase adapter checks passed using embedded PostgreSQL and mocked Storage/Meta requests. No external API calls.`);
}finally{await pg.close();}
