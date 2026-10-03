'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertCircle, LayoutDashboard, AlertTriangle, Layers, Clock } from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const res = await fetch('/api/dashboard');
      if (!res.ok) throw new Error('Failed to fetch dashboard data');
      return res.json();
    }
  });

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8 animate-in fade-in duration-300">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <LayoutDashboard className="text-blue-500" size={32} />
          Dashboard
        </h1>
        <p className="text-slate-400 mt-2 text-lg">Overview of your operational work and incidents.</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-slate-900 p-6 rounded-xl border border-slate-800 h-32 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-red-950/30 text-red-400 p-6 rounded-xl border border-red-900/50 font-medium">
          Error loading dashboard data. Please try again.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-sm flex flex-col justify-between transition hover:shadow-md">
            <div className="text-slate-400 font-medium mb-2 flex justify-between items-center">
              Accessible Items <Layers size={18} />
            </div>
            <div className="text-4xl font-bold text-white">{data?.total ?? 0}</div>
          </div>

          <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-sm flex flex-col justify-between transition hover:shadow-md">
            <div className="text-slate-400 font-medium mb-2 flex justify-between items-center">
              Open Items <AlertCircle size={18} />
            </div>
            <div className="text-4xl font-bold text-white">{data?.open ?? 0}</div>
          </div>

          <div className="bg-red-950/30 p-6 rounded-xl border border-red-900/50 shadow-sm flex flex-col justify-between transition hover:shadow-md">
            <div className="text-red-400 font-medium mb-2 flex justify-between items-center">
              High / Critical <AlertTriangle size={18} />
            </div>
            <div className="text-4xl font-bold text-red-400">{data?.highCritical ?? 0}</div>
          </div>

          <div className="bg-amber-950/30 p-6 rounded-xl border border-amber-900/50 shadow-sm flex flex-col justify-between transition hover:shadow-md">
            <div className="text-amber-400 font-medium mb-2 flex justify-between items-center">
              Needs Attention <Clock size={18} />
            </div>
            <div className="text-4xl font-bold text-amber-400">{data?.needsAttention ?? 0}</div>
          </div>
        </div>
      )}

      <div className="flex gap-4 pt-4 border-t border-slate-800">
        <Link href="/work-items" className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition shadow-sm">
          View All Work Items
        </Link>
      </div>
    </div>
  );
}
