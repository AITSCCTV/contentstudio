import {getChatGPTUser} from '../../chatgpt-auth';
import {db,bucket,json,sameOrigin,settings} from '../../../lib/store';
import {validateDraft,publicationKey} from '../../../lib/contracts';
import {graph,MetaError} from '../../../lib/meta';
export async function POST(request:Request){const user=await getChatGPTUser();if(!user||!sameOrigin(request))return json({error:'ไม่มีสิทธิ์'},403);
 const e=settings();if(e.POSTING_ENABLED!=='true'||!e.FACEBOOK_PAGE_ID||!e.FACEBOOK_PAGE_TOKEN||!e.INSTAGRAM_ACCOUNT_ID||!e.INSTAGRAM_TOKEN||!e.N8N_MEDIA_BASE_URL||!/^v\d+\.\d+$/.test(e.META_GRAPH_VERSION||''))return json({error:'ยังไม่ได้เชื่อมต่อบัญชีเพื่อเผยแพร่'},503);
 const {id,revision,checked}=(await request.json()) as any;if(checked!==true)return json({error:'กรุณาตรวจทานข้อความ รูปภาพ และข้อมูลสินค้า'},400);
 const r:any=await db().prepare('SELECT * FROM drafts WHERE id=?').bind(id).first();if(!r)return json({},404);if(r.revision!==revision)return json({error:'ร่างมีการเปลี่ยนแปลง กรุณารีเฟรช'},409);
 const d=validateDraft(JSON.parse(r.payload));if((d as any).demo===true)return json({error:'ร่างตัวอย่างไม่สามารถเผยแพร่ได้'},400);if(!d.images.length)return json({error:'ร่างยังไม่มีรูปภาพ'},400);if(d.expiresAt&&Date.parse(d.expiresAt)<Date.now())return json({error:'ข่าวหมดอายุ ต้องตรวจสอบข้อมูลใหม่'},409);
 // Atomic freezing prevents an edit after approval; per-channel unique keys prevent duplicate posts.
 const frozen=await db().prepare("UPDATE drafts SET status='POSTING' WHERE id=? AND revision=? AND status='DRAFT'").bind(id,revision).run();if(r.status==='DRAFT'&&frozen.meta.changes!==1)return json({error:'ร่างเปลี่ยนแปลง กรุณารีเฟรชก่อนเผยแพร่'},409);const results=[];
 for(const channel of ['facebook','instagram']){
   const key=publicationKey(id,channel);const previous:any=await db().prepare('SELECT * FROM publications WHERE id=?').bind(key).first();
   if(previous&&!['FAILED','PREPARING'].includes(previous.status)){results.push({channel,status:previous.status});continue;}
   const claim=await db().prepare("INSERT INTO publications(id,draft_id,channel,revision,status,started_at,approved_by) VALUES(?,?,?,?,'POSTING',?,?) ON CONFLICT(id) DO UPDATE SET status='POSTING',error=NULL,started_at=excluded.started_at WHERE publications.status IN ('FAILED','PREPARING') AND publications.revision=excluded.revision").bind(key,id,channel,revision,new Date().toISOString(),user.userId).run();if(claim.meta.changes!==1){results.push({channel,status:'POSTING'});continue;}
   try{
    if(channel==='facebook'){
      const media=[];for(const path of d.images){const object=await bucket().get(path.split('/').pop()!);if(!object)throw new MetaError(false);const photo=await graph(e.FACEBOOK_PAGE_ID+'/photos',e.FACEBOOK_PAGE_TOKEN,e.META_GRAPH_VERSION,{published:'false'},'graph.facebook.com',new Blob([await object.arrayBuffer()],{type:'image/jpeg'}));media.push({media_fbid:photo.id});}
      const result=await graph(e.FACEBOOK_PAGE_ID+'/feed',e.FACEBOOK_PAGE_TOKEN,e.META_GRAPH_VERSION,{message:d.facebookCaption,attached_media:JSON.stringify(media)});const url='https://www.facebook.com/'+result.id;await save(key,result.id,url);results.push({channel,status:'PUBLISHED',url});
    }else{
      const host=e.INSTAGRAM_API_HOST==='graph.instagram.com'?'graph.instagram.com':'graph.facebook.com';let containerId=previous?.container_id;
      if(!containerId){const children=[];for(const path of d.images){const ticket=crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','');await db().prepare('INSERT INTO media_tickets(id,object_key,expires_at) VALUES(?,?,?)').bind(ticket,path.split('/').pop(),Date.now()+3600000).run();const image=await graph(e.INSTAGRAM_ACCOUNT_ID+'/media',e.INSTAGRAM_TOKEN,e.META_GRAPH_VERSION,{image_url:e.N8N_MEDIA_BASE_URL.replace(/\/$/,'')+'/'+ticket,...(d.images.length>1?{is_carousel_item:'true'}:{caption:d.instagramCaption})},host);children.push(image.id);}
      const container=d.images.length===1?{id:children[0]}:await graph(e.INSTAGRAM_ACCOUNT_ID+'/media',e.INSTAGRAM_TOKEN,e.META_GRAPH_VERSION,{media_type:'CAROUSEL',children:children.join(','),caption:d.instagramCaption},host);containerId=container.id;await db().prepare('UPDATE publications SET container_id=? WHERE id=?').bind(containerId,key).run();}
      const state=await graph(containerId+'?fields=status_code',e.INSTAGRAM_TOKEN,e.META_GRAPH_VERSION,undefined,host);
      if(['ERROR','EXPIRED'].includes(state.status_code)){await db().prepare('UPDATE publications SET container_id=NULL WHERE id=?').bind(key).run();throw new MetaError(false);}
      if(state.status_code!=='FINISHED'){await db().prepare("UPDATE publications SET status='PREPARING' WHERE id=?").bind(key).run();results.push({channel,status:'PREPARING'});continue;}
      const result=await graph(e.INSTAGRAM_ACCOUNT_ID+'/media_publish',e.INSTAGRAM_TOKEN,e.META_GRAPH_VERSION,{creation_id:containerId},host);await save(key,result.id,null);results.push({channel,status:'PUBLISHED'});
      try{const published=await graph(result.id+'?fields=permalink',e.INSTAGRAM_TOKEN,e.META_GRAPH_VERSION,undefined,host);if(published.permalink)await db().prepare('UPDATE publications SET post_url=? WHERE id=?').bind(published.permalink,key).run();}catch{/* Publication already recorded; a permalink lookup failure must not cause another post. */}
    }
   }catch(error){const uncertain=!(error instanceof MetaError)||error.uncertain;await db().prepare('UPDATE publications SET status=?,error=?,finished_at=? WHERE id=?').bind(uncertain?'UNKNOWN':'FAILED',uncertain?'ต้องตรวจสอบผลในบัญชีก่อนลองใหม่':'คำขอไม่สำเร็จ',new Date().toISOString(),key).run();results.push({channel,status:uncertain?'UNKNOWN':'FAILED'});}
 }
 const posts=await db().prepare('SELECT status FROM publications WHERE draft_id=?').bind(id).all();const status=posts.results.length===2&&posts.results.every((p:any)=>p.status==='PUBLISHED')?'PUBLISHED':'PARTIAL';await db().prepare('UPDATE drafts SET status=?,updated_at=? WHERE id=?').bind(status,new Date().toISOString(),id).run();return json({results});
}
async function save(key:string,id:string,url:string|null){if(!id)throw new MetaError(true);await db().prepare("UPDATE publications SET status='PUBLISHED',post_id=?,post_url=?,finished_at=? WHERE id=?").bind(id,url,new Date().toISOString(),key).run();}
