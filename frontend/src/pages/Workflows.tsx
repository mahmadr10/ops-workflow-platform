import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api/client';
import type { Workflow } from '../types';
import { useAuth } from '../store/auth';

const palette = ['#64748b', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899', '#22c55e', '#ef4444'];

export default function Workflows() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const canManage = user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const { data: workflows } = useQuery<Workflow[]>({ queryKey: ['workflows'], queryFn: async () => (await api.get('/workflows')).data });

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [description, setDescription] = useState('');
  const [statuses, setStatuses] = useState(['Todo', 'In Progress', 'Done']);

  const createMutation = useMutation({
    mutationFn: () =>
      api.post('/workflows', {
        name,
        key,
        description,
        statuses: statuses.map((s, idx) => ({
          name: s,
          color: palette[idx % palette.length],
          isTerminal: idx === statuses.length - 1,
          isSuccess: idx === statuses.length - 1,
        })),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workflows'] });
      toast.success('Workflow created');
      setShowCreate(false);
      setName('');
      setKey('');
      setDescription('');
      setStatuses(['Todo', 'In Progress', 'Done']);
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to create workflow'),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-semibold">Workflows</h1>
          <p className="text-sm text-slate-500">Every process (recruitment, sales, tasks, procurement...) is a workflow you define. No hardcoded statuses.</p>
        </div>
        {canManage && (
          <button className="btn-primary" onClick={() => setShowCreate(true)}>
            <Plus size={15} /> New workflow
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {workflows?.map((w) => (
          <div key={w.id} className="card p-4">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold">{w.name}</h3>
              <span className="text-xs text-slate-400">{w._count?.items ?? 0} items</span>
            </div>
            <p className="text-xs text-slate-500 mb-3">{w.description}</p>
            <div className="flex flex-wrap gap-1.5">
              {w.statuses.map((s) => (
                <span key={s.id} className="label-pill" style={{ background: `${s.color}22`, color: s.color }}>
                  {s.name}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-slate-900/30" onClick={() => setShowCreate(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg p-5 max-h-[85vh] overflow-y-auto">
            <h3 className="font-semibold mb-4">Create a new workflow</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-500">Name</label>
                  <input className="input mt-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Procurement" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500">Key (slug)</label>
                  <input className="input mt-1" value={key} onChange={(e) => setKey(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} placeholder="procurement" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Description</label>
                <input className="input mt-1" value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Statuses (in order)</label>
                <div className="space-y-2 mt-1">
                  {statuses.map((s, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <GripVertical size={14} className="text-slate-300" />
                      <input
                        className="input"
                        value={s}
                        onChange={(e) => setStatuses(statuses.map((v, i) => (i === idx ? e.target.value : v)))}
                      />
                      <button
                        type="button"
                        className="text-slate-300 hover:text-red-500"
                        onClick={() => setStatuses(statuses.filter((_, i) => i !== idx))}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                  <button type="button" className="text-xs text-brand-600 font-medium hover:underline" onClick={() => setStatuses([...statuses, 'New status'])}>
                    + Add status
                  </button>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button className="btn-secondary" onClick={() => setShowCreate(false)}>
                Cancel
              </button>
              <button
                className="btn-primary"
                disabled={!name || !key || statuses.length < 2 || createMutation.isPending}
                onClick={() => createMutation.mutate()}
              >
                {createMutation.isPending ? 'Creating...' : 'Create workflow'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
