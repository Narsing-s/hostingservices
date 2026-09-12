'use client';

import { useEffect } from 'react';

const API_ORIGIN = 'http://localhost:4000';
const API_PREFIX = '/api/nexus';

function rewriteUrl(value: string) {
  if (!value.startsWith(API_ORIGIN)) return value;
  return `${API_PREFIX}${value.slice(API_ORIGIN.length)}`;
}

export default function HostedApiBridge() {
  useEffect(() => {
    const nativeFetch = window.fetch.bind(window);
    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      let value: RequestInfo | URL = input;
      if (typeof input === 'string') {
        value = rewriteUrl(input);
      } else if (input instanceof URL && input.origin === API_ORIGIN) {
        value = rewriteUrl(input.toString());
      } else if (typeof Request !== 'undefined' && input instanceof Request && input.url.startsWith(API_ORIGIN)) {
        value = new Request(rewriteUrl(input.url), input);
      }
      return nativeFetch(value, init);
    };

    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest('a[href]') as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (!href || !href.startsWith(API_ORIGIN)) return;
      event.preventDefault();
      anchor.setAttribute('href', rewriteUrl(href));
      window.location.assign(rewriteUrl(href));
    };
    document.addEventListener('click', onClick, true);

    return () => {
      window.fetch = nativeFetch;
      document.removeEventListener('click', onClick, true);
    };
  }, []);
  return null;
}
