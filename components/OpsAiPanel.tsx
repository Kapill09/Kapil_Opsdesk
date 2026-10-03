'use client';

import { useState } from 'react';
import { Sparkles, Send, Loader2, AlertTriangle, BookOpen } from 'lucide-react';

interface AiSource {
  id: string;
  type: 'work_item' | 'comment' | 'event';
  summary: string;
}

interface AiResult {
  answer: string;
  sources: AiSource[];
}

const EXAMPLE_PROMPTS = [
  'Summarize this issue',
  'Why is it blocked?',
  'What happened recently?',
];

export default function OpsAiPanel({ workItemId }: { workItemId: string }) {
  const [question, setQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AiResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function askQuestion(q: string) {
    const trimmed = q.trim();
    if (!trimmed || trimmed.length < 3) return;

    setQuestion(trimmed);
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`/api/work-items/${workItemId}/ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: trimmed }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const message =
          data?.error?.message ||
          data?.error ||
          (res.status === 403 ? 'You do not have permission to access this item.' :
           res.status === 404 ? 'Work item not found.' :
           'Ops AI is temporarily unavailable. You can continue using the work item normally.');
        setError(message);
        return;
      }

      const data: AiResult = await res.json();
      setResult(data);
    } catch {
      setError('Failed to connect to Ops AI. You can continue using the work item normally.');
    } finally {
      setIsLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    askQuestion(question);
  }

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 bg-gradient-to-r from-violet-50 to-indigo-50 flex items-center gap-2">
        <Sparkles size={18} className="text-violet-600" />
        <h3 className="font-semibold text-slate-200">Ops AI</h3>
        <span className="text-xs text-slate-400 ml-auto">Read-only assistant</span>
      </div>

      {/* Example prompts */}
      <div className="px-4 pt-4 flex flex-wrap gap-2">
        {EXAMPLE_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            onClick={() => askQuestion(prompt)}
            disabled={isLoading}
            className="text-xs px-3 py-1.5 rounded-full border border-violet-200 text-violet-700 hover:bg-violet-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Question input */}
      <form onSubmit={handleSubmit} className="p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask about this work item…"
            disabled={isLoading}
            maxLength={1000}
            className="flex-1 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isLoading || question.trim().length < 3}
            className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isLoading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Send size={14} />
            )}
            Ask
          </button>
        </div>
      </form>

      {/* Loading state */}
      {isLoading && (
        <div className="px-4 pb-4">
          <div className="flex items-center gap-3 text-sm text-slate-400 bg-slate-950 p-4 rounded-lg">
            <Loader2 size={16} className="animate-spin text-violet-600" />
            <span>Analyzing work item context…</span>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="px-4 pb-4">
          <div className="flex items-start gap-3 text-sm bg-amber-950/30 p-4 rounded-lg border border-amber-900/50">
            <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <p className="text-amber-800">{error}</p>
          </div>
        </div>
      )}

      {/* Answer */}
      {result && (
        <div className="px-4 pb-4 space-y-3">
          <div className="bg-slate-950 p-4 rounded-lg border border-slate-100">
            <p className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
              {result.answer}
            </p>
          </div>

          {/* Sources */}
          {result.sources.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <BookOpen size={14} className="text-slate-400" />
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Sources</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {result.sources.map((source) => (
                  <span
                    key={source.id}
                    className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md font-mono ${
                      source.type === 'work_item'
                        ? 'bg-blue-950/30 text-blue-400 border border-blue-900/50'
                        : source.type === 'comment'
                        ? 'bg-green-950/30 text-green-400 border border-green-900/50'
                        : 'bg-orange-50 text-orange-700 border border-orange-200'
                    }`}
                    title={source.summary}
                  >
                    {source.id}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
