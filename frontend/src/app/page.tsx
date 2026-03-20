import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden px-6 py-24 sm:py-32 lg:px-8">
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--bg-dark)] via-[#1a1a3e] to-[var(--bg-dark)]" />
        <div className="relative mx-auto max-w-4xl text-center">
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent">
            AI-Powered Healthcare Recruitment
          </h1>
          <p className="mt-6 text-lg leading-8 text-[var(--text-secondary)]">
            India&apos;s #1 platform connecting nurses with hospitals.
            Get AI-matched with the best jobs in under 2 minutes.
          </p>
          <div className="mt-10 flex items-center justify-center gap-x-6">
            <Link
              href="/register/seeker"
              className="rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-600 px-8 py-3.5 text-sm font-semibold text-white shadow-lg hover:from-cyan-400 hover:to-cyan-500 transition-all"
            >
              Register as Job Seeker (Free)
            </Link>
            <Link
              href="/register/recruiter"
              className="rounded-xl bg-[var(--bg-card)] border border-gray-700 px-8 py-3.5 text-sm font-semibold text-white hover:bg-gray-800 transition-all"
            >
              Register as Recruiter
            </Link>
          </div>

          {/* Stats */}
          <div className="mt-16 grid grid-cols-2 gap-8 sm:grid-cols-4">
            {[
              { value: '95%', label: 'Match Accuracy' },
              { value: '<2 min', label: 'Match Time' },
              { value: '10,000+', label: 'Matches Made' },
              { value: '500+', label: 'Partner Hospitals' },
            ].map((stat) => (
              <div key={stat.label} className="flex flex-col items-center">
                <p className="text-3xl font-bold text-cyan-400">{stat.value}</p>
                <p className="text-sm text-[var(--text-secondary)]">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-6">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-3xl font-bold text-center mb-16">How It Works</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: '1', title: 'Register', desc: 'Fill your profile with qualifications, skills, and preferences' },
              { step: '2', title: 'AI Matches', desc: 'Our AI instantly matches you with the best opportunities' },
              { step: '3', title: 'Get Hired', desc: 'Connect with hospitals and land your dream nursing job' },
            ].map((item) => (
              <div key={item.step} className="bg-[var(--bg-card)] rounded-2xl p-8 border border-gray-800 text-center">
                <div className="w-12 h-12 rounded-full bg-gradient-to-r from-cyan-500 to-violet-500 flex items-center justify-center mx-auto mb-4 text-white font-bold text-lg">
                  {item.step}
                </div>
                <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                <p className="text-[var(--text-secondary)]">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6">
        <div className="mx-auto max-w-3xl text-center bg-gradient-to-r from-cyan-900/50 to-violet-900/50 rounded-3xl p-12 border border-gray-800">
          <h2 className="text-3xl font-bold mb-4">Ready to Start?</h2>
          <p className="text-[var(--text-secondary)] mb-8">Join thousands of nurses who found their dream job through AutoHireBot</p>
          <Link
            href="/register/seeker"
            className="inline-block rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-600 px-10 py-4 text-lg font-semibold text-white shadow-lg hover:from-cyan-400 hover:to-cyan-500 transition-all"
          >
            Get Started - It&apos;s Free
          </Link>
        </div>
      </section>
    </main>
  );
}
