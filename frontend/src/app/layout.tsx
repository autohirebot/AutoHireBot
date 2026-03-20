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
    google: 'GJx7XqzPshGfPZkIe4ZyEnPCY-yUwWA-lfrcmMmXNZE',
    // Replace above with your actual Google Search Console verification code
    // Get it from: https://search.google.com/search-console → Add Property → HTML tag method
    other: {
      'msvalidate.01': 'bing-verification-autohirebot',
      // Replace above with your actual Bing Webmaster Tools verification code
      'yandex-verification': 'yandex-verification-autohirebot',
    },
  },
  category: 'healthcare',
  other: {
    'google-site-verification': 'GJx7XqzPshGfPZkIe4ZyEnPCY-yUwWA-lfrcmMmXNZE',
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
  },
};

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': 'https://autohirebot.com/#organization',
  name: 'AutoHireBot',
  alternateName: ['Auto Hire Bot', 'AutoHireBot India', 'AutoHireBot Healthcare'],
  url: 'https://autohirebot.com',
  logo: 'https://autohirebot.com/logo.png',
  description: 'AI-powered healthcare recruitment platform connecting nurses with hospitals across India.',
  foundingDate: '2025',
  founder: { '@type': 'Organization', name: 'X VIRUS LAB' },
  areaServed: { '@type': 'Country', name: 'India' },
  serviceType: 'Healthcare Recruitment',
  sameAs: [
    'https://www.linkedin.com/company/autohirebot',
    'https://www.facebook.com/autohirebot',
    'https://twitter.com/autohirebot',
    'https://www.instagram.com/autohirebot',
    'https://www.youtube.com/@autohirebot',
  ],
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'customer service',
    email: 'admin@autohirebot.com',
    availableLanguage: ['English', 'Hindi'],
  },
};

const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': 'https://autohirebot.com/#website',
  name: 'AutoHireBot',
  alternateName: 'Auto Hire Bot',
  url: 'https://autohirebot.com',
  description: 'AI-powered nursing jobs and healthcare recruitment platform in India',
  publisher: { '@id': 'https://autohirebot.com/#organization' },
  potentialAction: {
    '@type': 'SearchAction',
    target: 'https://autohirebot.com/jobs?q={search_term_string}',
    'query-input': 'required name=search_term_string',
  },
  inLanguage: 'en-IN',
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
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
      </head>
      <body className="antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
