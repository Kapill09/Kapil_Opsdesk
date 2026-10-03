'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { useState, use } from 'react';
import Link from 'next/link';
import { ArrowLeft, MessageSquare, Clock, User, AlertCircle, HandHeart } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import OpsAiPanel from '../../../components/OpsAiPanel';

export default function WorkItemDetail(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [comment, setComment] = useState('');
  const [conflictError, setConflictError] = useState<string | null>(null);
  
  const id = params.id;

  const { data: item, isLoading, error } = useQuery({
    queryKey: ['workItem', id],
    queryFn: async () => {
      const res = await fetch(`/api/work-items/${id}`);
      if (!res.ok) {
        if (res.status === 404 || res.status === 401 || res.status === 403) {
          throw new Error(res.status.toString());
        }
        throw new Error('Failed to load item');
      }
      return res.json();
    }
  });

  const commentMutation = useMutation({
    mutationFn: async (content: string) => {
      const idempotencyKey = crypto.randomUUID();
      const res = await fetch(`/api/work-items/${id}/comments`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey
        },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error('Failed to post comment');
      return res.json();
    },
    onSuccess: () => {
      setComment('');
      queryClient.invalidateQueries({ queryKey: ['workItem', id] });
    }
  });

  const claimMutation = useMutation({
    mutationFn: async () => {
      const idempotencyKey = crypto.randomUUID();
      const res = await fetch(`/api/work-items/${id}/claim`, {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey }
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error?.message || 'Failed to claim');
      }
      return res.json();
    },
    onSuccess: () => {
      setConflictError(null);
      queryClient.invalidateQueries({ queryKey: ['workItem', id] });
    },
    onError: (err: Error) => {
      setConflictError(err.message);
      queryClient.invalidateQueries({ queryKey: ['workItem', id] }); // Reconcile
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (status: string) => {
      if (!item) throw new Error('Item not loaded');
      const idempotencyKey = crypto.randomUUID();
      const res = await fetch(`/api/work-items/${id}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey
        },
        body: JSON.stringify({ status, version: item.version }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error?.message || 'Failed to update');
      }
      return res.json();
    },
    onSuccess: () => {
      setConflictError(null);
      queryClient.invalidateQueries({ queryKey: ['workItem', id] });
    },
    onError: (err: Error) => {
      setConflictError(err.message);
      queryClient.invalidateQueries({ queryKey: ['workItem', id] }); // Reconcile
    }
  });

  if (isLoading) {
    return <div className="p-8 text-center text-slate-500">Loading work item...</div>;
  }

  if (error) {
    if (error.message === '404' || error.message === '403' || error.message === '401') {
      return (
        <div className="p-8 max-w-4xl mx-auto text-center space-y-4">
          <AlertCircle size={48} className="mx-auto text-red-500" />
          <h2 className="text-2xl font-bold">Item Not Found or Access Denied</h2>
          <p className="text-slate-500">You either do not have permission to view this item, or it does not exist.</p>
          <Link href="/work-items" className="text-blue-600 hover:underline">Back to Work Items</Link>
        </div>
      );
    }
    return <div className="p-8 text-red-500">An error occurred loading the item.</div>;
  }

  if (!item) return null;

  return (
    <div className="p-8 max-w-5xl mx-auto animate-in fade-in duration-300">
      <Link href="/work-items" className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 mb-6 font-medium">
        <ArrowLeft size={16} /> Back to Work Items
      </Link>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          
          {conflictError && (
            <div className="bg-red-50 p-4 rounded-xl border border-red-200 flex gap-3 items-start animate-in fade-in">
              <AlertCircle className="text-red-600 shrink-0" size={20} />
              <div>
                <h3 className="font-semibold text-red-800">Update Failed</h3>
                <p className="text-red-700 text-sm mt-1">{conflictError}</p>
                <p className="text-red-700 text-xs mt-2 italic">The page has been refreshed with the latest data.</p>
              </div>
            </div>
          )}

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex gap-2 mb-4">
              <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-medium uppercase tracking-wide">
                {item.status.replace('_', ' ')}
              </span>
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium uppercase tracking-wide ${
                item.priority === 'critical' ? 'bg-red-100 text-red-700' :
                item.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                item.priority === 'medium' ? 'bg-amber-100 text-amber-700' :
                'bg-green-100 text-green-700'
              }`}>
                {item.priority}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">{item.title}</h1>
            <p className="text-slate-700 whitespace-pre-wrap">{item.description}</p>
          </div>

          {/* Comments Section */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
              <MessageSquare size={18} className="text-slate-500" />
              <h2 className="font-semibold text-slate-700">Comments</h2>
            </div>
            <div className="p-6 space-y-6">
              {item.comments?.length > 0 ? (
                item.comments.map((c: any) => (
                  <div key={c.id} className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 flex-shrink-0">
                      <User size={14} />
                    </div>
                    <div className="flex-1">
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <p className="text-sm text-slate-800 whitespace-pre-wrap">{c.content}</p>
                      </div>
                      <span className="text-xs text-slate-400 mt-1 block">
                        {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-slate-500 text-sm italic">No comments yet.</p>
              )}
            </div>
            
            <div className="p-4 border-t border-slate-200 bg-slate-50">
              <textarea 
                className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="Add a comment..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
              <div className="flex justify-between items-center mt-3">
                {commentMutation.isError ? <span className="text-red-500 text-sm">Failed to post comment</span> : <div></div>}
                <button
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50"
                  onClick={() => commentMutation.mutate(comment)}
                  disabled={!comment.trim() || commentMutation.isPending}
                >
                  {commentMutation.isPending ? 'Posting...' : 'Post Comment'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar/Details */}
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="font-semibold text-slate-900 mb-4 border-b pb-2">Details</h3>
            <div className="space-y-4 text-sm">
              <div>
                <span className="block text-slate-500 mb-1">Type</span>
                <span className="font-medium text-slate-800 capitalize">{item.type.replace('_', ' ')}</span>
              </div>
              <div>
                <span className="block text-slate-500 mb-1">Team ID</span>
                <span className="font-medium text-slate-800 break-all">{item.teamId}</span>
              </div>
              <div>
                <span className="block text-slate-500 mb-1">Assignee ID</span>
                {item.assigneeId ? (
                  <span className="font-medium text-slate-800 break-all">{item.assigneeId}</span>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 italic">Unassigned</span>
                    <button 
                      onClick={() => claimMutation.mutate()}
                      disabled={claimMutation.isPending}
                      className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-md font-medium hover:bg-blue-200 disabled:opacity-50"
                    >
                      {claimMutation.isPending ? 'Claiming...' : 'Claim'}
                    </button>
                  </div>
                )}
              </div>
              <div>
                <span className="block text-slate-500 mb-1">Created At</span>
                <span className="font-medium text-slate-800">{new Date(item.createdAt).toLocaleString()}</span>
              </div>
              <div>
                <span className="block text-slate-500 mb-1">Updated At</span>
                <span className="font-medium text-slate-800">{new Date(item.updatedAt).toLocaleString()}</span>
              </div>
              <div className="pt-2">
                <span className="block text-slate-500 mb-1">Actions</span>
                <select 
                  className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:outline-none"
                  value={item.status}
                  disabled={updateMutation.isPending}
                  onChange={(e) => updateMutation.mutate(e.target.value)}
                >
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="blocked">Blocked</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
            </div>
          </div>

          {/* Activity Timeline */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="font-semibold text-slate-900 mb-4 border-b pb-2 flex items-center gap-2">
              <Clock size={16} /> Activity
            </h3>
            <div className="space-y-4">
              {item.events?.map((e: any) => (
                <div key={e.id} className="relative pl-4 border-l-2 border-slate-200 text-sm">
                  <div className="absolute w-2 h-2 rounded-full bg-slate-400 -left-[5px] top-1.5" />
                  <p className="text-slate-800">
                    <span className="font-medium capitalize">{e.type.replace('_', ' ')}</span>
                  </p>
                  <span className="text-xs text-slate-500">{formatDistanceToNow(new Date(e.createdAt), { addSuffix: true })}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Ops AI Panel */}
          <OpsAiPanel workItemId={id} />
        </div>
      </div>
    </div>
  );
}
