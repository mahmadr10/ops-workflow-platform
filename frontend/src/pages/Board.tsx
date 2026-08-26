import { useMemo, useState } from 'react';
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api/client';
import type { Item, Workflow } from '../types';
import KanbanColumn from '../components/KanbanColumn';
import ItemDetailDrawer from '../components/ItemDetailDrawer';
import NewItemModal from '../components/NewItemModal';

export default function Board() {
  const qc = useQueryClient();
  const [workflowId, setWorkflowId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [priority, setPriority] = useState('');
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [showNewItem, setShowNewItem] = useState(false);
  const [standup, setStandup] = useState<string | null>(null);
  const [loadingStandup, setLoadingStandup] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const { data: workflows } = useQuery<Workflow[]>({
    queryKey: ['workflows'],
    queryFn: async () => (await api.get('/workflows')).data,
  });

  const activeWorkflow = useMemo(() => {
    if (!workflows?.length) return undefined;
    return workflows.find((w) => w.id === workflowId) || workflows[0];
  }, [workflows, workflowId]);

  const { data: items } = useQuery<Item[]>({
    queryKey: ['items', activeWorkflow?.id, search, priority],
    queryFn: async () =>
      (
        await api.get('/items', {
          params: { workflowId: activeWorkflow?.id, q: search || undefined, priority: priority || undefined },
        })
      ).data,
    enabled: !!activeWorkflow,
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, statusId }: { id: string; statusId: string }) => api.patch(`/items/${id}/status`, { statusId }),
    onError: () => {
      toast.error('Failed to update status, reverting');
      qc.invalidateQueries({ queryKey: ['items'] });
    },
  });

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || !activeWorkflow) return;
    const itemId = active.id as string;
    const newStatusId = over.id as string;
    const current = items?.find((i) => i.id === itemId);
    if (!current || current.statusId === newStatusId) return;

    // Optimistic update: move the card instantly, then persist.
    qc.setQueryData<Item[]>(['items', activeWorkflow.id, search, priority], (old) =>
      old?.map((i) => (i.id === itemId ? { ...i, statusId: newStatusId, status: activeWorkflow.statuses.find((s) => s.id === newStatusId)! } : i))
    );
    statusMutation.mutate({ id: itemId, statusId: newStatusId });
  }

  async function runStandup() {
    setLoadingStandup(true);
    try {
      const res = await api.get('/ai/standup');
      setStandup(res.data.summary);
    } catch {
      toast.error('Standup generation failed');
    } finally {
      setLoadingStandup(false);
    }
  }

  if (!workflows) return <div className="text-sm text-slate-400">Loading workflows...</div>;
  if (!activeWorkflow) return <div className="text-sm text-slate-400">No workflows yet. Create one first.</div>;

  const grouped = activeWorkflow.statuses.map((s) => ({
    status: s,
    items: (items || []).filter((i) => i.statusId === s.id),
  }));

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <select className="input w-auto" value={activeWorkflow.id} onChange={(e) => setWorkflowId(e.target.value)}>
            {workflows.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
            <input
              className="input pl-8 w-56"
              placeholder="Search title or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select className="input w-auto" value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="">All priorities</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="CRITICAL">Critical</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-secondary" onClick={runStandup} disabled={loadingStandup}>
            <Sparkles size={15} /> {loadingStandup ? 'Generating...' : 'AI Daily Standup'}
          </button>
          <button className="btn-primary" onClick={() => setShowNewItem(true)}>
            <Plus size={15} /> New item
          </button>
        </div>
      </div>

      {standup && (
        <div className="card p-3 mb-4 border-brand-100 bg-brand-50/40 text-sm text-slate-700">
          <div className="font-semibold text-brand-700 text-xs mb-1 flex items-center gap-1">
            <Sparkles size={13} /> Today's AI Standup
          </div>
          {standup}
        </div>
      )}

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="flex gap-4 overflow-x-auto flex-1 pb-2">
          {grouped.map((g) => (
            <KanbanColumn key={g.status.id} status={g.status} items={g.items} onCardClick={setSelectedItem} />
          ))}
        </div>
      </DndContext>

      {selectedItem && <ItemDetailDrawer itemId={selectedItem} onClose={() => setSelectedItem(null)} />}
      {showNewItem && <NewItemModal workflow={activeWorkflow} onClose={() => setShowNewItem(false)} />}
    </div>
  );
}
