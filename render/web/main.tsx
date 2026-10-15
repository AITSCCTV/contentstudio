import React from 'react';
import {createRoot} from 'react-dom/client';
import Studio from '../../app/studio';
import '../../app/styles.css';
createRoot(document.getElementById('root')!).render(<><nav style={{position:'fixed',bottom:12,right:16,zIndex:100,fontSize:12}}><a href="/logout">Sign out / ออกจากระบบ</a></nav><Studio showConnectionSetup={false}/></>);
