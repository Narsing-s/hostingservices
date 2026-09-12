import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function getApiUrl() {
  const value = process.env.NEXUS_API_URL?.trim() || process.env.PUBLIC_API_URL?.trim();
  if (!value) throw new Error('NEXUS_API_URL is not configured');
  return value.replace(/\/$/, '');
}

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  try {
    const { path } = await context.params;
    const upstream = `${getApiUrl()}/${path.join('/')}${request.nextUrl.search}`;
    const headers = new Headers(request.headers);
    headers.delete('host');
    headers.delete('content-length');

    const response = await fetch(upstream, {
      method: request.method,
      headers,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : await request.arrayBuffer(),
      redirect: 'manual',
      cache: 'no-store'
    });

    const out = new Headers(response.headers);
    out.delete('content-length');

    // Preserve OAuth redirects through the same-origin gateway. The browser must
    // never be redirected to an internal/localhost API address.
    const location = response.headers.get('location');
    if (location) {
      try {
        const target = new URL(location, getApiUrl());
        const apiOrigin = new URL(getApiUrl()).origin;
        if (target.origin === apiOrigin) {
          out.set('location', `/api/nexus${target.pathname}${target.search}${target.hash}`);
        } else {
          out.set('location', target.toString());
        }
      } catch {
        out.set('location', location);
      }
    }

    return new NextResponse(response.body, { status: response.status, headers: out });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Nexus API proxy failed' },
      { status: 503 }
    );
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const HEAD = proxy;
export const OPTIONS = proxy;
