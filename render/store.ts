// Render Free must never silently fall back to its temporary filesystem.
const local=process.env.STORAGE_BACKEND==='sqlite-local';
if(local&&process.env.RENDER)throw new Error('Local SQLite mode is for local development only');
const driver=local?await import('./sqlite-store'):await import('./supabase-store');
export const db=driver.db;
export const bucket=driver.bucket;
export const storageConfigured=()=>local||driver.configured();
export function settings():Record<string,string>{const e=process.env;return {...e,N8N_MEDIA_BASE_URL:e.N8N_MEDIA_BASE_URL||(e.PUBLIC_ORIGIN||e.RENDER_EXTERNAL_URL||'')+'/public-media'} as Record<string,string>;}
export function json(data:unknown,status=200){return Response.json(data,{status,headers:{'Cache-Control':'no-store'}});}
export function sameOrigin(request:Request){return request.headers.get('origin')===new URL(request.url).origin;}
