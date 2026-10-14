export class MetaError extends Error { constructor(public uncertain:boolean){super(uncertain?'ไม่ทราบผลการเผยแพร่ ต้องตรวจสอบบัญชีก่อนลองใหม่':'แพลตฟอร์มปฏิเสธคำขอ กรุณาตรวจสอบการเชื่อมต่อ');} }
export async function graph(path:string,token:string,version:string,body?:Record<string,string>,host='graph.facebook.com',file?:Blob){
 const url=new URL('https://'+host+'/'+version+'/'+path);const headers:Record<string,string>={Authorization:'Bearer '+token};let data:URLSearchParams|FormData|undefined;
 if(body){if(file){data=new FormData();for(const [k,v]of Object.entries(body))data.set(k,v);data.set('source',file,'aits.jpg');}else{data=new URLSearchParams(body);headers['Content-Type']='application/x-www-form-urlencoded';}}
 try{const response=await fetch(url,{method:body?'POST':'GET',headers,body:data,signal:AbortSignal.timeout(60000)});const result=await response.json() as any;if(!response.ok||result.error)throw new MetaError(response.status>=500);return result;}catch(e){if(e instanceof MetaError)throw e;throw new MetaError(true);}
}
