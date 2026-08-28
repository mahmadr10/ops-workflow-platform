import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Sparkles, Send, Clock, Flame, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { api } from '../api/client';
import type { Item } from '../types';

const priorities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export default function ItemDetailDrawer({ itemId, onClose }: { itemId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [comment, setComment] = useState('');

  const { data: item } = useQuery<Item>({
    queryKey: ['item', itemId],
    queryFn: async () => (await api.get(`/items/${itemId}`)).data,
  });

  const { data: users } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['users'],
    queryFn: async () => (await api.get('/users')).data,
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Item>) => api.patch(`/items/${itemId}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['item', itemId] });
      qc.invalidateQueries({ queryKey: ['items'] });
    },
  });

  const commentMutation = useMutation({
    mutationFn: (body: string) => api.post(`/items/${itemId}/comments`, { body }),
    onSuccess: () => {
      setComment('');
      qc.invalidateQueries({ queryKey: ['item', itemId] });
    },
  });

  // AI summary loads automatically the first time this card is opened, no button needed. If the
  // item already has a cached summary from a previous open (persisted server-side), that's shown
  // instantly with zero network calls; "Regenerate" (small icon) forces a fresh one on demand.
  const {
    data: aiSummaryData,
    isFetching: loadingAi,
    refetch: refetchAiSummary,
  } = useQuery({
    queryKey: ['item-ai-summary', itemId],
    queryFn: async () => (await api.get(`/items/${itemId}/ai-summary`)).data as { summary: string },
    enabled: !!item && !item.aiSummary,
    staleTime: 5 * 60 * 1000,
  });

  if (!item) return null;

  const aiSummary = aiSummaryData?.summary ?? item.aiSummary ?? null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/30" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white h-full shadow-2xl overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-5 py-4 flex items-center justify-between z-10">
          <span className="label-pill" style={{ background: `${item.status.color}22`, color: item.status.color }}>
            {item.status.name}
          </span>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X size={20} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">
          <input
            className="text-lg font-semibold w-full border-none focus:outline-none focus:ring-0 p-0"
            defaultValue={item.title}
            onBlur={(e) => e.target.value !== item.title && updateMutation.mutate({ title: e.target.value })}
          />

          <textarea
            className="input min-h-20 text-sm"
            placeholder="Description..."
            defaultValue={item.description || ''}
            onBlur={(e) => e.target.value !== item.description && updateMutation.mutate({ description: e.target.value })}
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-500">Priority</label>
              <select
                className="input mt-1"
                value={item.priority}
                onChange={(e) => updateMutation.mutate({ priority: e.target.value as any })}
              >
                {priorities.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Assignee</label>
              <select
                className="input mt-1"
                value={item.assigneeId || ''}
                onChange={(e) => updateMutation.mutate({ assigneeId: e.target.value || null })}
              >
                <option value="">Unassigned</option>
                {users?.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Due date</label>
              <input
                type="date"
                className="input mt-1"
                defaultValue={item.dueDate ? item.dueDate.slice(0, 10) : ''}
                onBlur={(e) => updateMutation.mutate({ dueDate: e.target.value ? new Date(e.target.value).toISOString() : null })}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Risk score</label>
              <div className="input mt-1 flex items-center gap-1.5 bg-slate-50">
                {item.riskScore >= 60 && <Flame size={13} className="text-red-500" />}
                {item.riskScore} / 100
              </div>
            </div>
          </div>

          {Object.keys(item.customFields || {}).length > 0 && (
            <div>
              <label className="text-xs font-medium text-slate-500">Custom fields</label>
              <div className="mt-1 rounded-lg border border-slate-200 divide-y divide-slate-100">
                {Object.entries(item.customFields).map(([k, v]) => (
                  <div key={k} className="flex justify-between px-3 py-1.5 text-xs">
                    <span className="text-slate-400">{k}</span>
                    <span className="font-medium">{String(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI panel: summary loads on its own, no click required */}
          <div className="rounded-lg border border-brand-100 bg-brand-50/50 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-brand-700">
                <Sparkles size={14} /> AI Assistant
              </div>
              <button
                className="text-slate-400 hover:text-brand-600 disabled:opacity-50"
                onClick={() => refetchAiSummary()}
                disabled={loadingAi}
                title="Regenerate summary"
              >
                <RefreshCw size={13} className={loadingAi ? 'animate-spin' : ''} />
              </button>
            </div>
            {item.aiNextAction && (
              <p className="text-xs text-slate-700 mt-2">
                <span className="font-medium">Suggested next action:</span> {item.aiNextAction}
              </p>
            )}
            {loadingAi && !aiSummary && <p className="text-xs text-slate-400 mt-2">Reading history and summarizing...</p>}
            {aiSummary && <p className="text-xs text-slate-600 mt-2 leading-relaxed">{aiSummary}</p>}
          </div>

          {/* Comments */}
          <div>
            <label className="text-xs font-medium text-slate-500">Comments</label>
            <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
              {item.comments?.map((c) => (
                <div key={c.id} className="text-xs bg-slate-50 rounded-lg p-2">
                  <div className="flex justify-between text-slate-400 mb-0.5">
                    <span className="font-medium text-slate-600">
                      {c.author.name} {c.aiGenerated && <span className="text-brand-500">(AI)</span>}
                    </span>
                    <span>{format(new Date(c.createdAt), 'MMM d, HH:mm')}</span>
                  </div>
                  <p>{c.body}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <input
                className="input"
                placeholder="Add a comment..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && comment.trim() && commentMutation.mutate(comment)}
              />
              <button className="btn-secondary" onClick={() => comment.trim() && commentMutation.mutate(comment)}>
                <Send size={14} />
              </button>
            </div>
          </div>

          {/* Activity timeline */}
          <div>
            <label className="text-xs font-medium text-slate-500 flex items-center gap-1">
              <Clock size={12} /> Activity timeline
            </label>
            <div className="mt-2 space-y-2">
              {item.activities?.map((a) => (
                <div key={a.id} className="flex gap-2 text-xs">
                  <div className="h-1.5 w-1.5 rounded-full bg-brand-400 mt-1.5 shrink-0" />
                  <div>
                    <span className="font-medium">{a.actor?.name || 'System'}</span>{' '}
                    <span className="text-slate-500">{describeAction(a)}</span>
                    <div className="text-slate-400">{format(new Date(a.createdAt), 'MMM d, HH:mm')}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function describeAction(a: { action: string; fromValue?: string | null; toValue?: string | null }) {
  switch (a.action) {
    case 'CREATED':
      return `created "${a.toValue}"`;
    case 'STATUS_CHANGED':
      return `changed status ${a.fromValue} -> ${a.toValue}`;
    case 'PRIORITY_CHANGED':
      return `changed priority ${a.fromValue} -> ${a.toValue}`;
    case 'ASSIGNEE_CHANGED':
      return `changed assignee -> ${a.toValue}`;
    case 'COMMENT_ADDED':
      return 'added a comment';
    case 'ATTACHMENT_ADDED':
      return `attached ${a.toValue}`;
    case 'REMINDER_SENT':
      return `reminder sent (${a.toValue})`;
    case 'FIELDS_UPDATED':
      return 'updated fields';
    default:
      return a.action.toLowerCase().replace(/_/g, ' ');
  }
}
