import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {randomBytes} from 'node:crypto';
import {createServer} from 'node:net';
const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
const root=await mkdtemp(join(tmpdir(),'aits-render-test-')),origin=`http://127.0.0.1:${port}`;
const password=randomBytes(24).toString('hex'),token=randomBytes(32).toString('hex');let child,logs='',checks=0;
const check=(actual,expected)=>{assert.equal(actual,expected);checks++;};
async function start(){child=spawn(process.execPath,['dist-render/server/server.mjs'],{env:{...process.env,PORT:String(port),PUBLIC_ORIGIN:origin,DATA_DIR:root,STUDIO_USER:'test-team',STUDIO_PASSWORD:password,INGEST_TOKEN:token,POSTING_ENABLED:'false'},stdio:['ignore','pipe','pipe']});child.stdout.on('data',d=>logs+=d);child.stderr.on('data',d=>logs+=d);for(let i=0;i<100;i++){if(child.exitCode!==null)throw new Error(logs);try{if((await fetch(origin+'/healthz')).ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}throw new Error('Startup timed out: '+logs);}
async function stop(){if(child&&child.exitCode===null){const exited=new Promise(r=>child.once('exit',r));child.kill();await exited;}}
const call=(path,options={})=>fetch(origin+path,{redirect:'manual',...options});
try{
 await start();check((await call('/')).status,303);check((await call('/api/drafts')).status,401);
 check((await call('/api/drafts',{headers:{'oai-authenticated-user-id':'spoof','oai-authenticated-user-email':'spoof'}})).status,401);
 check((await call('/api/ingest',{method:'POST',body:'{}'})).status,401);
 check((await call('/login',{method:'POST',body:new URLSearchParams({username:'test-team',password})})).status,403);
 const login=await call('/login',{method:'POST',headers:{origin},body:new URLSearchParams({username:'test-team',password})});check(login.status,303);const cookie=login.headers.get('set-cookie').split(';')[0];assert(login.headers.get('set-cookie').includes('HttpOnly'));checks++;
 check((await call('/api/drafts',{headers:{cookie:cookie.slice(0,-3)+'bad'}})).status,401);
 const headers={cookie,origin,'content-type':'application/json'};
 check((await call('/',{headers})).status,200);
 const draft={id:'render_test_draft',title:'ระบบตรวจวัดอุณหภูมิ',facebookCaption:'เตรียมระบบตรวจวัดให้พร้อม',instagramCaption:'ปรึกษาระบบตรวจวัด',images:[],sources:[{url:'https://aitscctv.com/',title:'AITSCCTV'}],priority:'EVERGREEN',eventDate:new Date().toISOString(),expiresAt:null,audience:'เจ้าของอาคาร',solution:'ระบบตรวจวัด',checks:['ตรวจข้อมูล']};
 const ingestHeaders={authorization:'Bearer '+token,'content-type':'application/json'};
 const pack={draft,imageBase64:[Buffer.from([255,216,255,217]).toString('base64')]};
 check((await call('/api/ingest',{method:'POST',headers:ingestHeaders,body:JSON.stringify(pack)})).status,200);
 check((await (await call('/api/ingest',{method:'POST',headers:ingestHeaders,body:JSON.stringify(pack)})).json()).duplicate,true);
 const stored=(await (await call('/api/drafts',{headers})).json()).drafts;check(stored.length,1);check(stored[0].revision,1);
 const image=stored[0].images[0];check((await call(image)).status,303);check((await call(image,{headers})).status,200);
 check((await call('/api/drafts',{method:'PATCH',headers:{cookie,'content-type':'application/json'},body:JSON.stringify({draft:stored[0],revision:1})})).status,403);
 const edited={...stored[0],facebookCaption:'ข้อความฉบับแก้ไขสำหรับทีม'};
 check((await call('/api/drafts',{method:'PATCH',headers,body:JSON.stringify({draft:edited,revision:1})})).status,200);
 check((await call('/api/drafts',{method:'PATCH',headers,body:JSON.stringify({draft:edited,revision:1})})).status,409);
 check((await call('/api/post',{method:'POST',headers,body:JSON.stringify({id:draft.id,revision:2,checked:true})})).status,503);
 check((await call('/api/ingest',{method:'POST',headers:ingestHeaders,body:JSON.stringify({run:{id:'research-test',status:'TEST'}})})).status,200);
 check((await (await call('/api/status',{headers})).json()).latestRun.id,'research-test');
 check((await call('/api/setup',{headers})).status,404);check((await call('/public-media/'+'a'.repeat(64))).status,404);
 await stop();await start();
 const persisted=(await (await call('/api/drafts',{headers})).json()).drafts;check(persisted[0].revision,2);check(persisted[0].facebookCaption,edited.facebookCaption);check((await call(image,{headers})).status,200);
 const logout=await call('/logout',{headers});assert(logout.headers.get('set-cookie').includes('Max-Age=0'));checks++;
 console.log(`${checks} Render integration checks passed: auth, ingestion, revision conflicts, images, disabled posting, restart persistence. No external API calls.`);
}finally{await stop();if(dirname(resolve(root))===resolve(tmpdir())&&root.includes('aits-render-test-'))await rm(root,{recursive:true,force:true});}
