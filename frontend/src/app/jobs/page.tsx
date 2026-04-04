'use client';

import { useEffect, useState, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';

interface Job {
  id: string;
  jobTitle: string;
  department?: string;
  location?: string;
  facilityName?: string;
  salaryRange?: { min: number; max: number };
  requiredExperience?: { min: number; max: number };
  requiredSkills?: string[];
  createdAt?: any;
  applicationCount?: number;
}

function isNewJob(createdAt: any): boolean {
  if (!createdAt) return false;
  const posted = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
  return (Date.now() - posted.getTime()) < 48 * 60 * 60 * 1000;
}

// Map common Indian cities to their state for addressRegion
const CITY_STATE_MAP: Record<string, string> = {
  delhi: 'Delhi', 'new delhi': 'Delhi', mumbai: 'Maharashtra', bangalore: 'Karnataka',
  bengaluru: 'Karnataka', chennai: 'Tamil Nadu', hyderabad: 'Telangana', kolkata: 'West Bengal',
  pune: 'Maharashtra', ahmedabad: 'Gujarat', jaipur: 'Rajasthan', lucknow: 'Uttar Pradesh',
  chandigarh: 'Chandigarh', kochi: 'Kerala', thiruvananthapuram: 'Kerala', gurgaon: 'Haryana',
  gurugram: 'Haryana', noida: 'Uttar Pradesh', indore: 'Madhya Pradesh', bhopal: 'Madhya Pradesh',
  patna: 'Bihar', nagpur: 'Maharashtra', coimbatore: 'Tamil Nadu', visakhapatnam: 'Andhra Pradesh',
};

function getStateFromCity(location: string): string {
  const city = location.toLowerCase().trim();
  for (const [key, state] of Object.entries(CITY_STATE_MAP)) {
    if (city.includes(key)) return state;
  }
  return 'India';
}

function buildJobPostingSchema(job: Job) {
  const datePosted = job.createdAt
    ? new Date(job.createdAt.toDate ? job.createdAt.toDate() : job.createdAt).toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0];

  // validThrough = 60 days from posting
  const validDate = new Date(datePosted);
  validDate.setDate(validDate.getDate() + 60);
  const validThrough = validDate.toISOString().split('T')[0];

  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: job.jobTitle,
    description: `${job.jobTitle}${job.department ? ` in ${job.department} department` : ''} at ${job.facilityName || 'a leading hospital'}. Full-time nursing position in India. Qualifications: GNM/BSc Nursing. Apply via AutoHireBot for AI-powered job matching.`,
    datePosted,
    validThrough,
    employmentType: 'FULL_TIME',
    directApply: true,
    industry: 'Healthcare',
    hiringOrganization: {
      '@type': 'Organization',
      name: job.facilityName || 'AutoHireBot Partner Hospital',
      sameAs: 'https://autohirebot.com',
    },
    identifier: {
      '@type': 'PropertyValue',
      name: 'AutoHireBot',
      value: job.id,
    },
  };

  if (job.location) {
    schema.jobLocation = {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressLocality: job.location,
        addressRegion: getStateFromCity(job.location),
        addressCountry: 'IN',
      },
    };
  }

  if (job.salaryRange) {
    schema.baseSalary = {
      '@type': 'MonetaryAmount',
      currency: 'INR',
      value: {
        '@type': 'QuantitativeValue',
        minValue: job.salaryRange.min,
        maxValue: job.salaryRange.max,
        unitText: 'MONTH',
      },
    };
  }

  if (job.requiredExperience) {
    schema.experienceRequirements = {
      '@type': 'OccupationalExperienceRequirements',
      monthsOfExperience: job.requiredExperience.min * 12,
    };
  }

  if (job.requiredSkills?.length) {
    schema.skills = job.requiredSkills.join(', ');
  }

  return schema;
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterLocation, setFilterLocation] = useState('');
  const [filterDept, setFilterDept] = useState('');

  useEffect(() => {
    loadJobs();
  }, []);

  async function loadJobs() {
    try {
      const q = query(
        collection(db, 'jobs'),
        where('status', '==', 'active'),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      const jobList = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Job[];
      setJobs(jobList);
    } catch (err) {
      console.error('Failed to load jobs:', err);
    } finally {
      setLoading(false);
    }
  }

  const filtered = jobs.filter(job => {
    if (filterLocation && !job.location?.toLowerCase().includes(filterLocation.toLowerCase())) return false;
    if (filterDept && !job.department?.toLowerCase().includes(filterDept.toLowerCase())) return false;
    return true;
  });

  const jobPostingSchemas = useMemo(() => {
    if (!filtered.length) return null;
    return filtered.map(job => buildJobPostingSchema(job));
  }, [filtered]);

  return (
    <main className="min-h-screen px-6 py-12">
      {jobPostingSchemas && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jobPostingSchemas),
          }}
        />
      )}
      <div className="mx-auto max-w-6xl">
        <h1 className="text-3xl font-bold mb-2">Browse Nursing Jobs</h1>
        <p className="text-[var(--text-secondary)] mb-8">{filtered.length} active positions</p>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-8">
          <input
            type="text"
            placeholder="Filter by location..."
            value={filterLocation}
            onChange={(e) => setFilterLocation(e.target.value)}
            className="px-4 py-2 rounded-lg bg-[var(--bg-card)] border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
          />
          <input
            type="text"
            placeholder="Filter by department..."
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
            className="px-4 py-2 rounded-lg bg-[var(--bg-card)] border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        {/* Job Grid */}
        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="bg-[var(--bg-card)] rounded-2xl p-6 border border-gray-800 animate-pulse">
                <div className="h-6 bg-gray-700 rounded w-3/4 mb-4" />
                <div className="h-4 bg-gray-700 rounded w-1/2 mb-2" />
                <div className="h-4 bg-gray-700 rounded w-2/3" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map(job => (
              <div key={job.id} className="bg-[var(--bg-card)] rounded-2xl p-6 border border-gray-800 hover:border-cyan-800 transition-colors relative group">
                {isNewJob(job.createdAt) && (
                  <span className="absolute top-4 right-4 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500 text-white uppercase tracking-wide animate-pulse">
                    New
                  </span>
                )}
                <h3 className="text-lg font-semibold mb-2">{job.jobTitle}</h3>
                {job.facilityName && (
                  <p className="text-cyan-400 text-sm mb-1">{job.facilityName}</p>
                )}
                {job.location && (
                  <p className="text-[var(--text-secondary)] text-sm mb-3">{job.location}</p>
                )}
                <div className="flex flex-wrap gap-2 mb-4">
                  {job.department && (
                    <span className="text-xs px-2 py-1 rounded-full bg-violet-900/50 text-violet-300">
                      {job.department}
                    </span>
                  )}
                  {job.requiredExperience && (
                    <span className="text-xs px-2 py-1 rounded-full bg-cyan-900/50 text-cyan-300">
                      {job.requiredExperience.min}-{job.requiredExperience.max} yrs
                    </span>
                  )}
                  {(job.applicationCount ?? 0) > 0 && (
                    <span className="text-xs px-2 py-1 rounded-full bg-amber-900/50 text-amber-300">
                      {job.applicationCount} applied
                    </span>
                  )}
                </div>
                {job.salaryRange && (
                  <p className="text-sm font-semibold text-emerald-400 mb-4">
                    &#8377;{job.salaryRange.min?.toLocaleString('en-IN')} - &#8377;{job.salaryRange.max?.toLocaleString('en-IN')} /month
                  </p>
                )}
                <a
                  href={`https://autohirebot.com/#forms`}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-teal-400 hover:text-teal-300 transition-colors mt-auto"
                >
                  Apply Now
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                </a>
              </div>
            ))}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <p className="text-center text-[var(--text-secondary)] py-12">No jobs match your filters.</p>
        )}
      </div>
    </main>
  );
}
