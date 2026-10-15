import {build} from 'vite';
import {mkdir,copyFile} from 'node:fs/promises';
await build({configFile:'vite.render.config.ts',mode:'production'});
await build({configFile:'vite.render.config.ts',mode:'server'});
await mkdir('dist-render/drizzle',{recursive:true});
await copyFile('drizzle/0000_ancient_madame_hydra.sql','dist-render/drizzle/0000_ancient_madame_hydra.sql');
