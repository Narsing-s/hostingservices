'use client';

import { useEffect } from 'react';

export default function DeployNavigation() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest('button');
      if (button && button.textContent?.replace(/\s+/g, ' ').trim() === 'New deployment' && window.location.pathname !== '/deploy') {
        event.preventDefault(); event.stopPropagation(); window.location.assign('/deploy'); return;
      }
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  return <div style={{position:'fixed',top:12,right:16,zIndex:80,display:'flex',gap:6,padding:6,border:'1px solid rgba(255,255,255,.1)',borderRadius:12,background:'rgba(10,12,16,.88)',backdropFilter:'blur(14px)',boxShadow:'0 10px 30px rgba(0,0,0,.25)'}}>
    <a href="/" style={linkStyle}>Console</a>
    <a href="/deployments" style={linkStyle}>Deployments</a>
    <a href="/deploy" style={linkStyle}>Deploy</a>
    <a href="/platform" style={linkStyle}>Platform</a>
    <a href="/platform/releases" style={linkStyle}>Release safety</a>
    <a href="/settings" style={linkStyle}>Settings</a>
  </div>;
}

const linkStyle: React.CSSProperties = { color:'#cbd3dc', textDecoration:'none', fontSize:12, fontWeight:600, padding:'7px 9px', borderRadius:8 };
