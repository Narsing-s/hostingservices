import './globals.css';
import type { Metadata } from 'next';
import DeployNavigation from './deploy-navigation';

export const metadata: Metadata = { title: 'Nexus Hosting', description: 'Deploy, connect and observe your applications.' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body><DeployNavigation />{children}</body></html>;
}
