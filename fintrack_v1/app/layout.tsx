import 'bootstrap/dist/css/bootstrap.min.css';
import 'antd/dist/reset.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import '@sweetalert2/theme-bootstrap-4/bootstrap-4.min.css';
import './responsive.css';

import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Finttrack Dashboard",
  icons: {
      icon: 'icon.png', // lives under /public/images
      shortcut: 'icon.png', // optional
      apple: 'icon.png', // optional
    },
  description: "Your personalized financial tracker",
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
