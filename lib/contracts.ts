export type Draft = { id: string; title: string; facebookCaption: string; instagramCaption: string;
  images: string[]; sources: {url:string; title:string}[]; priority: 'TREND'|'EVERGREEN';
  eventDate: string; expiresAt: string|null; audience: string; solution: string;
  checks: string[]; article?: {title:string; body:string}; };
export function validateDraft(d: Draft) {
  if (!/^[a-zA-Z0-9_-]{8,100}$/.test(d.id)) throw new Error('รหัสร่างไม่ถูกต้อง');
  for(const key of ['title','facebookCaption','instagramCaption','audience','solution'] as const)
    if(typeof d[key]!=='string'||!/[\u0e00-\u0e7f]/.test(d[key])) throw new Error('ต้องมีข้อความภาษาไทยครบทุกช่อง');
  if(d.instagramCaption.length>2200||d.facebookCaption.length>10000) throw new Error('คำบรรยายยาวเกินกำหนด');
  if(!['TREND','EVERGREEN'].includes(d.priority)||!Number.isFinite(Date.parse(d.eventDate)))throw new Error('ข้อมูลหัวข้อไม่ถูกต้อง');
  if(d.priority==='TREND'&&(!d.expiresAt||!Number.isFinite(Date.parse(d.expiresAt))))throw new Error('ข่าวต้องมีเวลาหมดอายุ');
  if(!Array.isArray(d.images)||d.images.length>10||!d.images.every(x=>/^\/media\/[a-f0-9]{32}\.jpg$/.test(x)))throw new Error('รูปภาพไม่ถูกต้อง');
  if(!Array.isArray(d.sources)||!d.sources.length||d.sources.some(s=>{try{return new URL(s.url).protocol!=='https:'||typeof s.title!=='string'}catch{return true}}))throw new Error('ต้องมีแหล่งข้อมูล HTTPS');
  if(!Array.isArray(d.checks)||!d.checks.every(s=>typeof s==='string'))throw new Error('รายการตรวจทานไม่ถูกต้อง');
  return d;
}
export function publicationKey(id:string, channel:string) { return id+':'+channel; }
export function canRetry(status:string|undefined) { return !status||status==='FAILED'; }
