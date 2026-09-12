'use client';

import { useEffect } from 'react';

const API_ORIGIN = 'http://localhost:4000';
const API_PREFIX = '/api/nexus';

export default function HostedApiBridge() {
  useEffect(() => {
    const nativeFetch = window.fetch.bind(window);
    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      let value: RequestInfo | URL = input;
      if (typeof input === 'string' && input.startsWith(API_ORIGIN)) {
        value = `${API_PREFIX}${input.slice(API_ORIGIN.length)}`;
      } else if (input instanceof URL && input.origin === API_ORIGIN) {
        value = `${API_PREFIX}${input.pathname}${input.search}`;
      } else if (typeof Request !== 'undefined' && input instanceof Request && input.url.startsWith(API_ORIGIN)) {
        value = new Request(`${API_PREFIX}${input.url.slice(API_ORIGIN.length)}`, input);
      }
      return nativeFetch(value, init);
    };
    return () => {
      window.fetch = nativeFetch;
    };
  }, []);
  return null;
}
