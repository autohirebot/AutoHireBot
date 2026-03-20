import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AutoHireBot - AI-Powered Healthcare Recruitment',
  description: 'India\'s #1 AI-powered platform connecting nurses with hospitals. Free for job seekers, AI matching in under 2 minutes.',
  keywords: ['nursing jobs', 'healthcare recruitment', 'nurse jobs india', 'hospital jobs'],
  openGraph: {
    title: 'AutoHireBot - AI Healthcare Recruitment',
    description: 'Get matched with the best nursing jobs across India using AI',
    url: 'https://autohirebot.com',
    siteName: 'AutoHireBot',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Space+Grotesk:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
