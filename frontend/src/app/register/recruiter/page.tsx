'use client';

import { useState } from 'react';
import { functions } from '@/lib/firebase';
import { httpsCallable } from 'firebase/functions';

const FACILITY_TYPES = ['Hospital', 'Clinic', 'Nursing Home', 'Rehabilitation Center', 'Urgent Care', 'Home Health Agency'];

export default function RecruiterRegistration() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [paymentStarted, setPaymentStarted] = useState(false);
  const [form, setForm] = useState({
    facilityName: '', facilityType: '', city: '',
    contactPerson: '', contactEmail: '', contactPhone: '',
    otp: ''
  });

  const updateForm = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  async function handleSendOTP() {
    if (!form.contactEmail || !form.contactPerson) return;
    setLoading(true);
    try {
      const sendOTP = httpsCallable(functions, 'sendOTP');
      await sendOTP({ email: form.contactEmail, name: form.contactPerson });
      setOtpSent(true);
      setStep(2);
    } catch (err: unknown) {
      const error = err as Error;
      alert(error.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyAndPay() {
    if (!form.otp) return;
    setLoading(true);
    try {
      const verifyOTP = httpsCallable(functions, 'verifyOTP');
      await verifyOTP({ email: form.contactEmail, otp: form.otp });
      setStep(3);
    } catch (err: unknown) {
      const error = err as Error;
      alert(error.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  }

  async function handlePayment() {
    setLoading(true);
    setPaymentStarted(true);
    try {
      const createOrder = httpsCallable(functions, 'createPaymentOrder');
      const result = await createOrder({
        recruiterId: form.contactEmail.replace(/[^a-zA-Z0-9]/g, '_'),
        customerName: form.contactPerson,
        customerEmail: form.contactEmail,
        customerPhone: form.contactPhone
      });
      const data = result.data as { paymentSessionId: string };

      // Redirect to Cashfree checkout
      if (data.paymentSessionId && typeof window !== 'undefined') {
        // Load Cashfree SDK and redirect
        alert('Payment session created! Redirecting to payment gateway...');
        // In production, use Cashfree JS SDK to open checkout
      }
    } catch (err: unknown) {
      const error = err as Error;
      alert(error.message || 'Payment failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-xl">
        <h1 className="text-3xl font-bold mb-2">Register as Recruiter</h1>
        <p className="text-[var(--text-secondary)] mb-8">One-time fee of Rs.999 - Post unlimited jobs</p>

        {/* Progress */}
        <div className="flex gap-2 mb-8">
          {[1, 2, 3].map(s => (
            <div key={s} className={`h-1 flex-1 rounded-full ${step >= s ? 'bg-violet-500' : 'bg-gray-700'}`} />
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="text-sm text-[var(--text-secondary)] mb-1 block">Facility Name</label>
              <input type="text" value={form.facilityName} onChange={e => updateForm('facilityName', e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-[var(--bg-card)] border border-gray-700 text-white focus:outline-none focus:border-violet-500" />
            </div>
            <div>
              <label className="text-sm text-[var(--text-secondary)] mb-1 block">Facility Type</label>
              <select value={form.facilityType} onChange={e => updateForm('facilityType', e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-[var(--bg-card)] border border-gray-700 text-white focus:outline-none focus:border-violet-500">
                <option value="">Select type</option>
                {FACILITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm text-[var(--text-secondary)] mb-1 block">City</label>
              <input type="text" value={form.city} onChange={e => updateForm('city', e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-[var(--bg-card)] border border-gray-700 text-white focus:outline-none focus:border-violet-500" />
            </div>
            <div>
              <label className="text-sm text-[var(--text-secondary)] mb-1 block">Contact Person</label>
              <input type="text" value={form.contactPerson} onChange={e => updateForm('contactPerson', e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-[var(--bg-card)] border border-gray-700 text-white focus:outline-none focus:border-violet-500" />
            </div>
            <div>
              <label className="text-sm text-[var(--text-secondary)] mb-1 block">Contact Email</label>
              <input type="email" value={form.contactEmail} onChange={e => updateForm('contactEmail', e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-[var(--bg-card)] border border-gray-700 text-white focus:outline-none focus:border-violet-500" />
            </div>
            <div>
              <label className="text-sm text-[var(--text-secondary)] mb-1 block">Contact Phone</label>
              <input type="tel" value={form.contactPhone} onChange={e => updateForm('contactPhone', e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-[var(--bg-card)] border border-gray-700 text-white focus:outline-none focus:border-violet-500" />
            </div>
            <button onClick={handleSendOTP} disabled={loading || !form.contactEmail || !form.facilityName}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-500 to-violet-600 text-white font-semibold disabled:opacity-50 hover:from-violet-400 hover:to-violet-500 transition-all">
              {loading ? 'Sending OTP...' : 'Verify Email'}
            </button>
          </div>
        )}

        {step === 2 && otpSent && (
          <div className="space-y-4 text-center">
            <h2 className="text-xl font-semibold">Verify Your Email</h2>
            <p className="text-[var(--text-secondary)]">Code sent to {form.contactEmail}</p>
            <input type="text" value={form.otp} onChange={e => updateForm('otp', e.target.value.toUpperCase())}
              maxLength={6} placeholder="Enter code"
              className="w-full px-4 py-4 rounded-xl bg-[var(--bg-card)] border border-gray-700 text-white text-center text-2xl tracking-widest focus:outline-none focus:border-violet-500" />
            <button onClick={handleVerifyAndPay} disabled={loading || form.otp.length < 6}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-500 to-violet-600 text-white font-semibold disabled:opacity-50">
              {loading ? 'Verifying...' : 'Verify & Continue to Payment'}
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4 text-center">
            <div className="text-5xl mb-4">{"💳"}</div>
            <h2 className="text-xl font-semibold">Complete Payment</h2>
            <div className="bg-[var(--bg-card)] rounded-2xl p-6 border border-gray-800">
              <p className="text-3xl font-bold text-violet-400 mb-1">Rs.999</p>
              <p className="text-[var(--text-secondary)]">One-time registration fee</p>
            </div>
            <ul className="text-left text-[var(--text-secondary)] text-sm space-y-2 px-4">
              <li>Unlimited job postings</li>
              <li>AI-matched candidate profiles</li>
              <li>Recruiter analytics dashboard</li>
              <li>Priority support</li>
            </ul>
            <button onClick={handlePayment} disabled={loading || paymentStarted}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-green-500 to-green-600 text-white font-semibold disabled:opacity-50">
              {loading ? 'Processing...' : 'Pay with Cashfree'}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
