import React from 'react';
import {createRoot} from 'react-dom/client';
import Studio from '../app/studio';
import '../app/styles.css';
import {validateDraft} from '../lib/contracts';
import samples from './demo-drafts.json';

const key='aits-contentstudio-pages-drafts-v1';
const fresh=()=>samples.map(d=>({...d,revision:1,status:'DRAFT',createdAt:d.eventDate,publications:[]}));
function read(){try{const value=JSON.parse(localStorage.getItem(key)||'null');if(Array.isArray(value)){for(const d of value)validateDraft(d);return value;}}catch{}return fresh();}
const json=(body:unknown,status=200)=>Promise.resolve(Response.json(body,{status}));
const request:typeof fetch=async(input,init)=>{
 const url=String(input);
 if(url==='/api/status')return json({postingEnabled:false,monitoringEnabled:false,facebookReady:false,instagramReady:false,latestRun:null});
 if(url==='/api/drafts'&&(!init?.method||init.method==='GET'))return json({drafts:read()});
 if(url==='/api/drafts'&&init?.method==='PATCH'){
  try{const {draft,revision}=JSON.parse(String(init.body));validateDraft(draft);const list=read(),index=list.findIndex(d=>d.id===draft.id);if(index<0||list[index].revision!==revision)return json({error:'ร่างมีการเปลี่ยนแปลง กรุณารีเฟรช'},409);list[index]={...draft,demo:true,revision:revision+1,status:'DRAFT',publications:[]};localStorage.setItem(key,JSON.stringify(list));return json({ok:true});}catch{return json({error:'บันทึกในเบราว์เซอร์ไม่สำเร็จ'},400);}
 }
 return json({error:'GitHub Pages ยังไม่ได้เชื่อมต่อระบบหลังบ้าน'},503);
};
createRoot(document.getElementById('root')!).render(<Studio request={request} assetsBase={import.meta.env.BASE_URL} browserOnly/>);
