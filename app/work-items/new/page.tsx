'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function NewWorkItemPage() {
  const router = useRouter();
  
  // Since we only want to show teams the user has access to,
  // we would fetch `/api/auth/me` or similar. For simplicity,
  // we'll fetch a list of teams from the database, or just let them paste a team ID for now.
  // Wait, in this scenario, the prompt says "Use existing users, teams".
  // Let's create a quick API to fetch user's teams so we can populate the dropdown.
  
  const [teams, setTeams] = useState<{ teamId: string, teamName: string }[]>([]);
  useEffect(() => {
    fetch('/api/teams').then(r => r.json()).then(data => {
      if(Array.isArray(data)) setTeams(data);
    }).catch(e => console.error(e));
  }, []);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'operational_task',
    priority: 'medium',
    teamId: '',
  });

  const [error, setError] = useState('');

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const idempotencyKey = crypto.randomUUID();
      const res = await fetch('/api/work-items', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to create work item');
      }
      return res.json();
    },
    onSuccess: (data) => {
      router.push(`/work-items/${data.id}`);
    },
    onError: (err: Error) => {
      setError(err.message);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.teamId || !formData.description) {
      setError('Please fill in all required fields.');
      return;
    }
    createMutation.mutate(formData);
  };

  return (
    <div className="p-8 max-w-2xl mx-auto animate-in fade-in duration-300">
      <Link href="/work-items" className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-900 mb-6 font-medium">
        <ArrowLeft size={16} /> Back to Work Items
      </Link>

      <div className="bg-slate-900 p-8 rounded-xl shadow-sm border border-slate-800">
        <h1 className="text-2xl font-bold mb-6">Create Work Item</h1>
        
        {error && (
          <div className="mb-6 p-4 bg-red-950/30 text-red-400 rounded-lg border border-red-900/50">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Title *</label>
            <input 
              type="text" 
              className="w-full border border-slate-700 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none bg-slate-950 text-white"
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Description *</label>
            <textarea 
              rows={4}
              className="w-full border border-slate-700 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none bg-slate-950 text-white"
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Type</label>
              <select 
                className="w-full border border-slate-700 rounded-lg p-2.5 bg-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                value={formData.type}
                onChange={e => setFormData({ ...formData, type: e.target.value })}
              >
                <option value="customer_issue">Customer Issue</option>
                <option value="engineering_problem">Engineering Problem</option>
                <option value="production_incident">Production Incident</option>
                <option value="operational_task">Operational Task</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Priority</label>
              <select 
                className="w-full border border-slate-700 rounded-lg p-2.5 bg-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                value={formData.priority}
                onChange={e => setFormData({ ...formData, priority: e.target.value })}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Team *</label>
            <select 
              className="w-full border border-slate-700 rounded-lg p-2.5 bg-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
              value={formData.teamId}
              onChange={e => setFormData({ ...formData, teamId: e.target.value })}
            >
              <option value="" disabled>Select a team</option>
              {teams.map(t => (
                <option key={t.teamId} value={t.teamId}>{t.teamName}</option>
              ))}
            </select>
            {teams.length === 0 && <p className="text-xs text-slate-400 mt-1">If empty, you might not be in any teams.</p>}
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
            <Link href="/work-items" className="px-5 py-2.5 rounded-lg border border-slate-700 text-slate-300 font-medium hover:bg-slate-800/50">
              Cancel
            </Link>
            <button 
              type="submit"
              disabled={createMutation.isPending}
              className="px-5 py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {createMutation.isPending ? 'Creating...' : 'Create Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
