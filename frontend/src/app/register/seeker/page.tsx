'use client';

import { useState } from 'react';
import { functions } from '@/lib/firebase';
import { httpsCallable } from 'firebase/functions';

const SPECIALIZATIONS = [
  'ICU/Critical Care', 'Emergency Room', 'Operating Room', 'General Ward',
  'NICU', 'Pediatrics', 'Dialysis', 'Oncology', 'Cardiology',
  'Psychiatric', 'Labor & Delivery', 'Geriatrics'
];

const QUALIFICATIONS = ['ANM', 'GNM', 'B.Sc Nursing', 'Post Basic B.Sc', 'M.Sc Nursing'];
const EXPERIENCE_OPTIONS = ['Fresher', '1-2 years', '3-5 years', '5-10 years', '10+ years'];

export default function SeekerRegistration() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [form, setForm] = useState({
    fullName: '', email: '', phone: '',
    qualification: '', experience: '',
    specializations: [] as string[],
    preferredCity: '', expectedSalary: '',
    otp: ''
  });

  const updateForm = (field: string, value: string | string[]) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const toggleSpec = (spec: string) => {
    setForm(prev => ({
      ...prev,
      specializations: prev.specializations.includes(spec)
        ? prev.specializations.filter(s => s !== spec)
        : [...prev.specializations, spec]
    }));
  };

  async function handleSendOTP() {
    if (!form.email || !form.fullName) return;
    setLoading(true);
    try {
      const sendOTP = httpsCallable(functions, 'sendOTP');
      await sendOTP({ email: form.email, name: form.fullName });
      setOtpSent(true);
      setStep(3);
    } catch (err: unknown) {
      const error = err as Error;
      alert(error.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOTP() {
    if (!form.otp) return;
    setLoading(true);
    try {
      const verifyOTP = httpsCallable(functions, 'verifyOTP');
      await verifyOTP({ email: form.email, otp: form.otp });
      alert('Registration successful! Our AI is finding matches for you.');
      window.location.href = '/jobs';
    } catch (err: unknown) {
      const error = err as Error;
      alert(error.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-xl">
        <h1 className="text-3xl font-bold mb-2">Register as Job Seeker</h1>
        <p className="text-[var(--text-secondary)] mb-8">100% Free - Get AI-matched with nursing jobs</p>

        {/* Progress */}
        <div className="flex gap-2 mb-8">
          {[1, 2, 3].map(s => (
            <div key={s} className={`h-1 flex-1 rounded-full ${step >= s ? 'bg-cyan-500' : 'bg-gray-700'}`} />
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="text-sm text-[var(--text-secondary)] mb-1 block">Full Name</label>
              <input type="text" value={form.fullName} onChange={e => updateForm('fullName', e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-[var(--bg-card)] border border-gray-700 text-white focus:outline-none focus:border-cyan-500" />
            </div>
            <div>
              <label className="text-sm text-[var(--text-secondary)] mb-1 block">Email</label>
              <input type="email" value={form.email} onChange={e => updateForm('email', e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-[var(--bg-card)] border border-gray-700 text-white focus:outline-none focus:border-cyan-500" />
            </div>
            <div>
              <label className="text-sm text-[var(--text-secondary)] mb-1 block">Phone</label>
              <input type="tel" value={form.phone} onChange={e => updateForm('phone', e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-[var(--bg-card)] border border-gray-700 text-white focus:outline-none focus:border-cyan-500" />
            </div>
            <div>
              <label className="text-sm text-[var(--text-secondary)] mb-1 block">Qualification</label>
              <select value={form.qualification} onChange={e => updateForm('qualification', e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-[var(--bg-card)] border border-gray-700 text-white focus:outline-none focus:border-cyan-500">
                <option value="">Select qualification</option>
                {QUALIFICATIONS.map(q => <option key={q} value={q}>{q}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm text-[var(--text-secondary)] mb-1 block">Experience</label>
              <select value={form.experience} onChange={e => updateForm('experience', e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-[var(--bg-card)] border border-gray-700 text-white focus:outline-none focus:border-cyan-500">
                <option value="">Select experience</option>
                {EXPERIENCE_OPTIONS.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <button onClick={() => setStep(2)} disabled={!form.fullName || !form.email}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-600 text-white font-semibold disabled:opacity-50 hover:from-cyan-400 hover:to-cyan-500 transition-all">
              Next
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <label className="text-sm text-[var(--text-secondary)] mb-2 block">Specializations</label>
              <div className="flex flex-wrap gap-2">
                {SPECIALIZATIONS.map(spec => (
                  <button key={spec} onClick={() => toggleSpec(spec)}
                    className={`px-3 py-1.5 rounded-full text-sm transition-all ${
                      form.specializations.includes(spec)
                        ? 'bg-cyan-600 text-white'
                        : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border border-gray-700 hover:border-cyan-600'
                    }`}>
                    {spec}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm text-[var(--text-secondary)] mb-1 block">Preferred City</label>
              <input type="text" value={form.preferredCity} onChange={e => updateForm('preferredCity', e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-[var(--bg-card)] border border-gray-700 text-white focus:outline-none focus:border-cyan-500"
                placeholder="e.g. Hyderabad, Mumbai" />
            </div>
            <div>
              <label className="text-sm text-[var(--text-secondary)] mb-1 block">Expected Salary (monthly)</label>
              <input type="text" value={form.expectedSalary} onChange={e => updateForm('expectedSalary', e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-[var(--bg-card)] border border-gray-700 text-white focus:outline-none focus:border-cyan-500"
                placeholder="e.g. 25000" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(1)}
                className="flex-1 py-3 rounded-xl bg-[var(--bg-card)] border border-gray-700 text-white font-semibold hover:bg-gray-800 transition-all">
                Back
              </button>
              <button onClick={handleSendOTP} disabled={loading}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-600 text-white font-semibold disabled:opacity-50 hover:from-cyan-400 hover:to-cyan-500 transition-all">
                {loading ? 'Sending OTP...' : 'Verify Email'}
              </button>
            </div>
          </div>
        )}

        {step === 3 && otpSent && (
          <div className="space-y-4 text-center">
            <div className="text-5xl mb-4">{"📧"}</div>
            <h2 className="text-xl font-semibold">Check Your Email</h2>
            <p className="text-[var(--text-secondary)]">We sent a verification code to {form.email}</p>
            <input type="text" value={form.otp} onChange={e => updateForm('otp', e.target.value.toUpperCase())}
              maxLength={6} placeholder="Enter 6-digit code"
              className="w-full px-4 py-4 rounded-xl bg-[var(--bg-card)] border border-gray-700 text-white text-center text-2xl tracking-widest focus:outline-none focus:border-cyan-500" />
            <button onClick={handleVerifyOTP} disabled={loading || form.otp.length < 6}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-green-500 to-green-600 text-white font-semibold disabled:opacity-50 hover:from-green-400 hover:to-green-500 transition-all">
              {loading ? 'Verifying...' : 'Complete Registration'}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
