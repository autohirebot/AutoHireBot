import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'AutoHireBot - AI-Powered Healthcare Recruitment Platform India',
    template: '%s | AutoHireBot',
  },
  description: 'India\'s #1 AI-powered platform connecting nurses with hospitals. Free for job seekers, AI matching in under 2 minutes. 10,000+ matches made.',
  keywords: ['nursing jobs', 'healthcare recruitment', 'nurse jobs india', 'hospital jobs', 'staff nurse vacancy', 'ICU nurse jobs', 'GNM jobs', 'BSc nursing jobs', 'healthcare jobs india'],
  authors: [{ name: 'AutoHireBot', url: 'https://autohirebot.com' }],
  creator: 'AutoHireBot',
  publisher: 'AutoHireBot',
  metadataBase: new URL('https://autohirebot.com'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'AutoHireBot - AI-Powered Healthcare Recruitment',
    description: 'Get matched with the best nursing jobs across India using AI. Free for job seekers.',
    url: 'https://autohirebot.com',
    siteName: 'AutoHireBot',
    type: 'website',
    locale: 'en_IN',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'AutoHireBot - AI Healthcare Recruitment Platform',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AutoHireBot - AI-Powered Healthcare Recruitment',
    description: 'India\'s #1 AI platform connecting nurses with hospitals. Free for job seekers.',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    // Add your verification codes here
    // google: 'your-google-verification-code',
  },
  category: 'healthcare',
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'AutoHireBot',
  url: 'https://autohirebot.com',
  description: 'AI-powered healthcare recruitment platform connecting nurses with hospitals across India.',
  areaServed: {
    '@type': 'Country',
    name: 'India',
  },
  serviceType: 'Healthcare Recruitment',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Space+Grotesk:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
