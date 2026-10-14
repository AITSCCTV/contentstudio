import {getChatGPTUser} from '../../chatgpt-auth';
import {settings,json} from '../../../lib/store';
export async function GET(){const user=await getChatGPTUser(),e=settings();if(!user||user.email!==e.OWNER_EMAIL)return json({error:'ไม่มีสิทธิ์'},403);if(!e.SITE_SERVICE_TOKEN||!e.INGEST_TOKEN)return json({error:'การเชื่อมต่อยังไม่พร้อม'},503);return json({headers:{'OAI-Sites-Authorization':'Bearer '+e.SITE_SERVICE_TOKEN,Authorization:'Bearer '+e.INGEST_TOKEN}});}
