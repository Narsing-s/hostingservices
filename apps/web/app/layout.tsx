import './globals.css';
import './platform/platform.css';
import type { Metadata } from 'next';
import DeployNavigation from './deploy-navigation';
import HostedApiBridge from './hosted-api-bridge';

export const metadata: Metadata = { title: 'Nexus Hosting', description: 'Deploy, connect and observe your applications.' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body><HostedApiBridge /><DeployNavigation />{children}</body></html>;
}
