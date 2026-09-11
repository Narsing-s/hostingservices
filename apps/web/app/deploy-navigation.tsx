'use client';

import { useEffect } from 'react';

export default function DeployNavigation() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest('button');
      if (!button) return;
      if (button.textContent?.replace(/\s+/g, ' ').trim() !== 'New deployment') return;
      if (window.location.pathname === '/deploy') return;
      event.preventDefault();
      event.stopPropagation();
      window.location.assign('/deploy');
    };

    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  return null;
}
