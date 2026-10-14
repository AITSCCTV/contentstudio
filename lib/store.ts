import { env } from 'cloudflare:workers';
export function db(): D1Database { const e=env as unknown as {DB:D1Database}; if(!e.DB)throw new Error('ฐานข้อมูลยังไม่พร้อม');return e.DB; }
export function bucket(): R2Bucket { return (env as unknown as {BUCKET:R2Bucket}).BUCKET; }
export function settings() { return env as unknown as Record<string,string>; }
export function json(data: unknown,status=200) {return Response.json(data,{status,headers:{'Cache-Control':'no-store'}});}
export function sameOrigin(request:Request) { const origin=request.headers.get('origin');return !!origin&&origin===new URL(request.url).origin; }
