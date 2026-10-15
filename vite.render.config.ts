import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
const local=(path:string)=>fileURLToPath(new URL(path,import.meta.url));
export default defineConfig(({mode})=>mode==='server'?{
 resolve:{alias:[{find:/^(?:\.\.\/)+lib\/store$/,replacement:local('./render/store.ts')},{find:/^(?:\.\.\/)+chatgpt-auth$/,replacement:local('./render/auth.ts')}]},
 build:{ssr:'render/server.ts',outDir:'dist-render/server',emptyOutDir:true,rollupOptions:{output:{entryFileNames:'server.mjs'}}}
}:{root:'render/web',base:'/',publicDir:local('./public'),plugins:[react()],build:{outDir:'../../dist-render/client',emptyOutDir:true}});
