import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Zap, Play } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api/client';
import { useAuth } from '../store/auth';
import type { Workflow } from '../types';

type Channel = 'EMAIL' | 'SLACK' | 'DISCORD' | 'TEAMS' | 'WEBHOOK';
const allChannels: Channel[] = ['EMAIL', 'SLACK', 'DISCORD', 'TEAMS', 'WEBHOOK'];

interface Rule {
  id: string;
  daysInStatus: number;
  message: string;
  channels: Channel[];
  active: boolean;
  workflow: { name: string };
  status: { name: string; color: string };
}

// Frontend for the reminder automation engine: "IF status == X AND N days passed THEN notify".
// The backend rule engine already runs this hourly; this page is where an Admin/Manager actually
// authors the rules instead of only being able to do it via curl.
export default function Automation() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const canManage = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  const { data: rules } = useQuery<Rule[]>({ queryKey: ['reminder-rules'], queryFn: async () => (await api.get('/reminder-rules')).data });
  const { data: workflows } = useQuery<Workflow[]>({ queryKey: ['workflows'], queryFn: async () => (await api.get('/workflows')).data });

  const [workflowId, setWorkflowId] = useState('');
  const [statusId, setStatusId] = useState('');
  const [daysInStatus, setDaysInStatus] = useState(3);
  const [message, setMessage] = useState('');
  const [channels, setChannels] = useState<Channel[]>(['WEBHOOK']);

  const activeWorkflow = workflows?.find((w) => w.id === workflowId);

  const createMutation = useMutation({
    mutationFn: () => api.post('/reminder-rules', { workflowId, statusId, daysInStatus, message, channels }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reminder-rules'] });
      toast.success('Rule created');
      setMessage('');
      setDaysInStatus(3);
    },
    onError: () => toast.error('Failed to create rule'),
  });

  const runNowMutation = useMutation({
    mutationFn: () => api.post('/reminder-rules/run-now'),
    onSuccess: () => toast.success('Automation engine ran, risk scores refreshed'),
    onError: () => toast.error('Failed to run automation engine'),
  });

  function toggleChannel(c: Channel) {
    setChannels((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!workflowId || !statusId || !message.trim() || !channels.length) return;
    createMutation.mutate();
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Reminder Automation</h1>
          <p className="text-sm text-slate-500">IF an item sits in a status too long, THEN notify automatically. Runs every hour on its own.</p>
        </div>
        {canManage && (
          <button className="btn-secondary" onClick={() => runNowMutation.mutate()} disabled={runNowMutation.isPending}>
            <Play size={14} /> {runNowMutation.isPending ? 'Running...' : 'Run now'}
          </button>
        )}
      </div>

      {canManage && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
            <Plus size={15} /> New rule
          </h3>
          <form onSubmit={onSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-500">Workflow</label>
                <select
                  className="input mt-1"
                  value={workflowId}
                  onChange={(e) => {
                    setWorkflowId(e.target.value);
                    setStatusId('');
                  }}
                >
                  <option value="">Select a workflow</option>
                  {workflows?.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Status ("IF status ==")</label>
                <select className="input mt-1" value={statusId} onChange={(e) => setStatusId(e.target.value)} disabled={!activeWorkflow}>
                  <option value="">Select a status</option>
                  {activeWorkflow?.statuses.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Days passed ("AND N days passed")</label>
              <input
                type="number"
                min={0}
                className="input mt-1 w-32"
                value={daysInStatus}
                onChange={(e) => setDaysInStatus(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Message ("THEN send reminder")</label>
              <textarea
                className="input mt-1 min-h-16"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="e.g. Candidate has been waiting too long, please follow up."
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Send via</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {allChannels.map((c) => (
                  <button
                    type="button"
                    key={c}
                    onClick={() => toggleChannel(c)}
                    className={`label-pill border ${
                      channels.includes(c) ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-slate-500 border-slate-200'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <button type="submit" className="btn-primary" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create rule'}
            </button>
          </form>
        </div>
      )}

      <div className="card p-5">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
          <Zap size={15} /> Active rules ({rules?.length ?? 0})
        </h3>
        <div className="space-y-2">
          {rules?.map((r) => (
            <div key={r.id} className="border border-slate-100 rounded-lg p-3 text-sm">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-slate-400 text-xs">IF</span>
                <span className="label-pill" style={{ background: `${r.status.color}22`, color: r.status.color }}>
                  {r.workflow.name} / {r.status.name}
                </span>
                <span className="text-slate-400 text-xs">AND</span>
                <span className="font-medium">{r.daysInStatus}+ days</span>
                <span className="text-slate-400 text-xs">THEN notify via</span>
                {r.channels.map((c) => (
                  <span key={c} className="label-pill bg-slate-100 text-slate-500">
                    {c}
                  </span>
                ))}
              </div>
              <p className="text-slate-500 text-xs mt-1.5">{r.message}</p>
            </div>
          ))}
          {!rules?.length && <div className="text-xs text-slate-400 text-center py-6">No automation rules yet</div>}
        </div>
      </div>
    </div>
  );
}
