// Only application-owned SQL templates enter here. User values remain bound parameters.
export function postgresQuery(sql:string){let quoted=false,index=0;return sql.replace(/''|'|\?|\b(drafts|publications|media_tickets|runs)\b/g,(part)=>{
 if(part==="''")return part;if(part==="'"){quoted=!quoted;return part;}if(quoted)return part;
 if(part==='?')return '$'+(++index);
 return 'aits_contentstudio.'+part;
});}
