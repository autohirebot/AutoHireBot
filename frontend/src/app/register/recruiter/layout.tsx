import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Register as Hospital Recruiter | Post Nursing Jobs',
  description: 'Register on AutoHireBot as a hospital recruiter. Post nursing jobs and find qualified nurses with AI matching. Hospitals, clinics, nursing homes across India.',
  keywords: ['hospital recruiter registration', 'post nursing jobs', 'hire nurses India', 'AutoHireBot recruiter', 'hospital recruitment platform', 'healthcare hiring'],
  alternates: {
    canonical: '/register/recruiter',
  },
  openGraph: {
    title: 'Register as Hospital Recruiter - AutoHireBot',
    description: 'Post nursing jobs and find qualified nurses with AI matching. Hospitals, clinics, nursing homes across India.',
    url: 'https://autohirebot.com/register/recruiter',
    type: 'website',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RecruiterLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
