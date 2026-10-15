import {DatabaseSync,backup} from 'node:sqlite';
import {mkdir} from 'node:fs/promises';
import {join} from 'node:path';
if(!process.env.DATA_DIR)throw new Error('DATA_DIR is required');
const destination=join(process.env.DATA_DIR,'backups');await mkdir(destination,{recursive:true});
const database=new DatabaseSync(join(process.env.DATA_DIR,'studio.sqlite'));
const file=join(destination,'studio-'+new Date().toISOString().replaceAll(':','-')+'.sqlite');
await backup(database,file);database.close();console.log('Consistent SQLite backup created in DATA_DIR/backups. Copy it and the images directory to company backup storage.');
