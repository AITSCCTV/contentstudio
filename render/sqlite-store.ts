import {DatabaseSync} from 'node:sqlite';
import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {mkdirSync} from 'node:fs';
import schema from '../drizzle/0000_ancient_madame_hydra.sql?raw';
import {join} from 'node:path';

const directory=process.env.DATA_DIR;
export const configured=()=>!!directory;
if(!directory)throw new Error('DATA_DIR must point to persistent storage');
mkdirSync(join(directory,'images'),{recursive:true});
const database=new DatabaseSync(join(directory,'studio.sqlite'));
database.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
if(!database.prepare("SELECT name FROM sqlite_master WHERE name='drafts'").get()){
 database.exec(schema);
}
// Preserve the route layer's D1 contract while using SQLite on Render's persistent disk.
export function db():any{return {prepare(sql:string){const statement=database.prepare(sql);let values:any[]=[];return {
 bind(...args:any[]){values=args;return this;},
 async first(){return statement.get(...values)??null;},
 async all(){return {results:statement.all(...values)};},
 async run(){const result=statement.run(...values);return {meta:{changes:Number(result.changes)}};}
};}};}
function imagePath(key:string){if(!/^[a-f0-9]{32}\.jpg$/.test(key))throw new Error('Invalid media key');return join(directory!,'images',key);}
export function bucket():any{return {
 async put(key:string,value:Uint8Array){const path=imagePath(key),temp=path+'.tmp';await writeFile(temp,value,{mode:0o600});await rename(temp,path);},
 async get(key:string){try{const bytes=await readFile(imagePath(key));return {body:bytes,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};}catch(error:any){if(error.code==='ENOENT')return null;throw error;}}
};}
export function settings():Record<string,string>{const e=process.env;return {...e,N8N_MEDIA_BASE_URL:e.N8N_MEDIA_BASE_URL||(e.PUBLIC_ORIGIN||e.RENDER_EXTERNAL_URL||'')+'/public-media'} as Record<string,string>;}
export function json(data:unknown,status=200){return Response.json(data,{status,headers:{'Cache-Control':'no-store'}});}
export function sameOrigin(request:Request){return request.headers.get('origin')===new URL(request.url).origin;}
