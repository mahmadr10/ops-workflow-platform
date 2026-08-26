import { FormEvent, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api/client';
import type { Workflow } from '../types';

export default function NewItemModal({ workflow, onClose }: { workflow: Workflow; onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: () =>
      api.post('/items', {
        workflowId: workflow.id,
        statusId: workflow.statuses[0].id,
        title,
        description,
        priority,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['items'] });
      toast.success('Item created');
      onClose();
    },
    onError: () => toast.error('Failed to create item'),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    mutation.mutate();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-slate-900/30" onClick={onClose} />
      <form onSubmit={onSubmit} className="relative bg-white rounded-xl shadow-2xl w-full max-w-md p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">New item in {workflow.name}</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-500">Title</label>
            <input className="input mt-1" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus required />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500">Description</label>
            <textarea className="input mt-1 min-h-16" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500">Priority</label>
            <select className="input mt-1" value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={mutation.isPending}>
            {mutation.isPending ? 'Creating...' : 'Create item'}
          </button>
        </div>
      </form>
    </div>
  );
}
