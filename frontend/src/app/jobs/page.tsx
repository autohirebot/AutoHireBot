'use client';

import { useEffect, useState } from 'react';
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
  createdAt?: Date;
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

  return (
    <main className="min-h-screen px-6 py-12">
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
              <div key={job.id} className="bg-[var(--bg-card)] rounded-2xl p-6 border border-gray-800 hover:border-cyan-800 transition-colors">
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
                </div>
                {job.salaryRange && (
                  <p className="text-sm text-green-400">
                    {job.salaryRange.min?.toLocaleString()} - {job.salaryRange.max?.toLocaleString()} /month
                  </p>
                )}
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
