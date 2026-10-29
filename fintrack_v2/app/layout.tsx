import type { Metadata } from 'next';
import { Poppins } from 'next/font/google';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './globals.css';
import AppShell from '@/components/AppShell';

const poppins = Poppins({
  variable: '--font-poppins',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'Fintrack',
  description: 'Your personal financial tracker based in Malaysia',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={poppins.variable}>
      <body>
        <AntdRegistry>
          <AppShell>
            {children}
          </AppShell>
        </AntdRegistry>
      </body>
    </html>
  );
}
