import postgres from 'postgres';
import schema from '../drizzle/0000_ancient_madame_hydra.sql?raw';
import {postgresQuery} from './postgres-query';
const e=process.env;
export function configured(){return !!e.DATABASE_URL&&!!e.SUPABASE_URL&&!!e.SUPABASE_SERVICE_ROLE_KEY;}
let client:ReturnType<typeof postgres>|undefined,initializing:Promise<void>|undefined;
async function connection(){
 if(!configured())throw new Error('Supabase storage is not configured');
 if(!client){
  const url=new URL(e.DATABASE_URL!);if(!['postgres:','postgresql:'].includes(url.protocol))throw new Error('Invalid database URL');
  url.searchParams.delete('sslmode');url.searchParams.delete('ssl');url.searchParams.delete('sslrootcert');
  client=postgres(url.toString(),{max:3,idle_timeout:20,connect_timeout:15,prepare:false,ssl:{rejectUnauthorized:true,...(e.DATABASE_CA_CERT?{ca:e.DATABASE_CA_CERT.replaceAll('\\n','\n')}:{})},onnotice:()=>{}});
 }
 if(!initializing){initializing=(async()=>{
  await client!.unsafe('CREATE SCHEMA IF NOT EXISTS aits_contentstudio');
  await client!.unsafe('REVOKE ALL ON SCHEMA aits_contentstudio FROM PUBLIC');
  for(const part of schema.split('--> statement-breakpoint')){const sql=part.trim().replaceAll('`','').replace(/CREATE TABLE /g,'CREATE TABLE IF NOT EXISTS ').replace(/expires_at integer/g,'expires_at bigint');if(sql)await client!.unsafe(postgresQuery(sql));}
 })().catch(error=>{initializing=undefined;throw error;});}
 await initializing;return client;
}
export function db():any{return {prepare(sql:string){let values:any[]=[];async function query(){return (await connection()).unsafe(postgresQuery(sql),values);}return {
 bind(...args:any[]){values=args;return this;},async first(){return (await query())[0]??null;},async all(){return {results:[...await query()]};},async run(){return {meta:{changes:(await query()).count}};}
};}};}
function storageUrl(key:string){if(!/^[a-f0-9]{32}\.jpg$/.test(key))throw new Error('Invalid media key');const origin=new URL(e.SUPABASE_URL!);if(origin.protocol!=='https:'||origin.pathname!=='/'||origin.username||origin.password)throw new Error('Invalid Supabase URL');return origin.origin+'/storage/v1/object/'+encodeURIComponent(e.SUPABASE_STORAGE_BUCKET||'contentstudio-images')+'/'+key;}
function headers(){return {apikey:e.SUPABASE_SERVICE_ROLE_KEY!,authorization:'Bearer '+e.SUPABASE_SERVICE_ROLE_KEY!};}
export function bucket():any{return {
 async put(key:string,value:Uint8Array){if(!configured())throw new Error('Storage not configured');const result=await fetch(storageUrl(key),{method:'POST',headers:{...headers(),'content-type':'image/jpeg','x-upsert':'false'},body:Buffer.from(value),signal:AbortSignal.timeout(60000)});if(!result.ok)throw new Error('Image storage upload failed');},
 async get(key:string){if(!configured())throw new Error('Storage not configured');const result=await fetch(storageUrl(key).replace('/object/','/object/authenticated/'),{headers:headers(),signal:AbortSignal.timeout(30000)});if(result.status===404)return null;if(!result.ok)throw new Error('Image storage download failed');const bytes=new Uint8Array(await result.arrayBuffer());return {body:bytes,arrayBuffer:async()=>bytes.buffer};}
};}
