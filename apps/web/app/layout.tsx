import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Nexus Hosting', description: 'Deploy, connect and observe your applications.' };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="en"><body>{children}</body></html>; }
