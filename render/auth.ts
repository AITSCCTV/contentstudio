import {AsyncLocalStorage} from 'node:async_hooks';
import {createHmac,randomBytes,scryptSync,timingSafeEqual} from 'node:crypto';
export const identity=new AsyncLocalStorage<{userId:string;email:string;displayName:string}>();
export async function getChatGPTUser(){return identity.getStore()??null;}
const cookieName='aits_studio_session';
const password=process.env.STUDIO_PASSWORD||'';
const salt=randomBytes(16);
const passwordHash=password?scryptSync(password,salt,32):null;
export function ready(){return password.length>=24&&!!process.env.STUDIO_USER&&(process.env.INGEST_TOKEN||'').length>=32;}
function signature(value:string){return createHmac('sha256',password).update(value).digest('base64url');}
function equal(a:string,b:string){const aa=Buffer.from(a),bb=Buffer.from(b);return aa.length===bb.length&&timingSafeEqual(aa,bb);}
export function validLogin(user:string,pass:string){return !!passwordHash&&equal(user,process.env.STUDIO_USER||'')&&timingSafeEqual(scryptSync(pass,salt,32),passwordHash);}
export function sessionCookie(secure:boolean){const value=String(Date.now()+8*3600000)+'.'+randomBytes(16).toString('hex');return `${cookieName}=${value}.${signature(value)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800${secure?'; Secure':''}`;}
export function clearCookie(secure:boolean){return `${cookieName}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure?'; Secure':''}`;}
export function authenticated(cookie:string){const token=cookie.split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='))?.slice(cookieName.length+1)||'';const parts=token.split('.');return parts.length===3&&Number(parts[0])>Date.now()&&Number(parts[0])<=Date.now()+8*3600000&&equal(parts[2],signature(parts[0]+'.'+parts[1]));}
