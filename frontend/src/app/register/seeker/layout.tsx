import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Register as Nurse Job Seeker | Free Nursing Job Registration',
  description: 'Register FREE on AutoHireBot as a nursing job seeker. Get AI-matched with top hospitals in India. GNM, BSc Nursing, ANM professionals welcome. Find your dream nursing job!',
  keywords: ['nurse registration', 'nursing job seeker', 'register nurse jobs', 'free nursing registration', 'AutoHireBot registration', 'nurse job apply', 'healthcare job registration India'],
  alternates: {
    canonical: '/register/seeker',
  },
  openGraph: {
    title: 'Register as Nurse Job Seeker - AutoHireBot',
    description: 'Register FREE and get AI-matched with top hospitals in India. GNM, BSc Nursing, ANM professionals welcome.',
    url: 'https://autohirebot.com/register/seeker',
    type: 'website',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function SeekerLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
