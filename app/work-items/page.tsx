'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Plus, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { Suspense, useState, useEffect } from 'react';

function WorkItemsList() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const status = searchParams.get('status') || '';
  const priority = searchParams.get('priority') || '';
  const type = searchParams.get('type') || '';
  const search = searchParams.get('search') || '';
  const cursor = searchParams.get('cursor') || '';

  // Local state for search input (debounced)
  const [searchInput, setSearchInput] = useState(search);

  useEffect(() => {
    const handler = setTimeout(() => {
      updateFilter('search', searchInput);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchInput]);

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    if (key !== 'cursor') params.delete('cursor'); // Reset pagination on filter change
    router.push(`/work-items?${params.toString()}`);
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ['workItems', status, priority, type, search, cursor],
    queryFn: async () => {
      const params = new URLSearchParams(searchParams.toString());
      const res = await fetch(`/api/work-items?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch work items');
      return res.json();
    }
  });

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Work Items</h1>
          <p className="text-slate-500 mt-1">Manage operational work, issues, and incidents.</p>
        </div>
        <Link href="/work-items/new" className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition shadow-sm">
          <Plus size={18} />
          Create Work Item
        </Link>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap gap-4 items-center">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search items..."
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        
        <select 
          value={status} 
          onChange={(e) => updateFilter('status', e.target.value)}
          className="border border-slate-300 rounded-lg px-4 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Statuses</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="in_review">In Review</option>
          <option value="blocked">Blocked</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>

        <select 
          value={priority} 
          onChange={(e) => updateFilter('priority', e.target.value)}
          className="border border-slate-300 rounded-lg px-4 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Priorities</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>

        <select 
          value={type} 
          onChange={(e) => updateFilter('type', e.target.value)}
          className="border border-slate-300 rounded-lg px-4 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Types</option>
          <option value="customer_issue">Customer Issue</option>
          <option value="engineering_problem">Engineering Problem</option>
          <option value="production_incident">Production Incident</option>
          <option value="operational_task">Operational Task</option>
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium">
            <tr>
              <th className="px-6 py-4">Title</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Priority</th>
              <th className="px-6 py-4">Type</th>
              <th className="px-6 py-4">Updated At</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                  <div className="animate-pulse space-y-4">
                    <div className="h-4 bg-slate-200 rounded w-1/4 mx-auto"></div>
                    <div className="h-4 bg-slate-200 rounded w-1/3 mx-auto"></div>
                  </div>
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-red-500">
                  Failed to load work items.
                </td>
              </tr>
            ) : data?.items?.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                  No work items match your criteria.
                </td>
              </tr>
            ) : (
              data?.items.map((item: any) => (
                <tr key={item.id} className="hover:bg-slate-50 transition cursor-pointer" onClick={() => router.push(`/work-items/${item.id}`)}>
                  <td className="px-6 py-4 font-medium text-slate-900">{item.title}</td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-medium uppercase tracking-wide">
                      {item.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium uppercase tracking-wide ${
                      item.priority === 'critical' ? 'bg-red-100 text-red-700' :
                      item.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                      item.priority === 'medium' ? 'bg-amber-100 text-amber-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {item.priority}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-500 capitalize">{item.type.replace('_', ' ')}</td>
                  <td className="px-6 py-4 text-slate-500">
                    {new Date(item.updatedAt).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        
        {data?.nextCursor && (
          <div className="px-6 py-4 border-t border-slate-200 flex justify-end">
            <button 
              onClick={() => updateFilter('cursor', data.nextCursor)}
              className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-800"
            >
              Next Page <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8">Loading...</div>}>
      <WorkItemsList />
    </Suspense>
  );
}
