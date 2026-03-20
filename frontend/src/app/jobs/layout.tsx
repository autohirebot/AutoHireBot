import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Nursing Jobs in India | Latest Hospital & Healthcare Vacancies',
  description: 'Browse latest nursing jobs in India. ICU Nurse, Staff Nurse, Emergency Nurse vacancies at top hospitals. Apply FREE on AutoHireBot - Get matched instantly with AI!',
  keywords: ['nursing jobs', 'nurse vacancy', 'hospital jobs India', 'ICU nurse jobs', 'staff nurse jobs', 'healthcare jobs India', 'GNM jobs', 'BSc nursing jobs', 'nursing vacancy 2026', 'AutoHireBot jobs'],
  alternates: {
    canonical: '/jobs',
  },
  openGraph: {
    title: 'Latest Nursing Jobs in India - AutoHireBot',
    description: 'Browse and apply for nursing jobs at top hospitals across India. FREE for job seekers! AI-powered matching.',
    url: 'https://autohirebot.com/jobs',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Latest Nursing Jobs in India - AutoHireBot',
    description: 'Browse and apply for nursing jobs at top hospitals. FREE for job seekers!',
  },
};

export default function JobsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
