import { useEffect, useMemo, useState } from 'react';
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Sparkles, SlidersHorizontal, RefreshCw, Radio, ChevronDown, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api/client';
import { getSocket } from '../api/socket';
import type { Item, Label, Workflow } from '../types';
import KanbanColumn from '../components/KanbanColumn';
import ItemDetailDrawer from '../components/ItemDetailDrawer';
import NewItemModal from '../components/NewItemModal';

export default function Board() {
  const qc = useQueryClient();
  const [workflowId, setWorkflowId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [priority, setPriority] = useState('');
  const [statusId, setStatusId] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [labelId, setLabelId] = useState('');
  const [dueAfter, setDueAfter] = useState('');
  const [dueBefore, setDueBefore] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [showNewItem, setShowNewItem] = useState(false);
  const [live, setLive] = useState(false);
  const [standupOpen, setStandupOpen] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const { data: workflows } = useQuery<Workflow[]>({
    queryKey: ['workflows'],
    queryFn: async () => (await api.get('/workflows')).data,
  });
  const { data: users } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['users'],
    queryFn: async () => (await api.get('/users')).data,
  });
  const { data: labels } = useQuery<Label[]>({ queryKey: ['labels'], queryFn: async () => (await api.get('/labels')).data });

  const activeWorkflow = useMemo(() => {
    if (!workflows?.length) return undefined;
    return workflows.find((w) => w.id === workflowId) || workflows[0];
  }, [workflows, workflowId]);

  const filters = { search, priority, statusId, assigneeId, labelId, dueAfter, dueBefore };

  const { data: items } = useQuery<Item[]>({
    queryKey: ['items', activeWorkflow?.id, filters],
    queryFn: async () =>
      (
        await api.get('/items', {
          params: {
            workflowId: activeWorkflow?.id,
            q: search || undefined,
            priority: priority || undefined,
            statusId: statusId || undefined,
            assigneeId: assigneeId || undefined,
            labelId: labelId || undefined,
            dueAfter: dueAfter ? new Date(dueAfter).toISOString() : undefined,
            dueBefore: dueBefore ? new Date(dueBefore).toISOString() : undefined,
          },
        })
      ).data,
    enabled: !!activeWorkflow,
  });

  // Real-time board: join the active workflow's room and refetch the instant anyone (including
  // this browser, from another tab) creates, moves, edits, or comments on an item. This is what
  // makes "instant refresh" real, not just the optimistic local drag.
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !activeWorkflow) return;

    const onConnect = () => setLive(true);
    const onDisconnect = () => setLive(false);
    const onItemsChanged = (payload: { workflowId: string }) => {
      if (payload.workflowId === activeWorkflow.id) {
        qc.invalidateQueries({ queryKey: ['items', activeWorkflow.id] });
      }
    };
    const onWorkflowsChanged = () => qc.invalidateQueries({ queryKey: ['workflows'] });

    socket.emit('workflow:join', activeWorkflow.id);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('items:changed', onItemsChanged);
    socket.on('workflows:changed', onWorkflowsChanged);
    setLive(socket.connected);

    return () => {
      socket.emit('workflow:leave', activeWorkflow.id);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('items:changed', onItemsChanged);
      socket.off('workflows:changed', onWorkflowsChanged);
    };
  }, [activeWorkflow?.id, qc]);

  const statusMutation = useMutation({
    mutationFn: ({ id, statusId }: { id: string; statusId: string }) => api.patch(`/items/${id}/status`, { statusId }),
    onError: () => {
      toast.error('Failed to update status, reverting');
      qc.invalidateQueries({ queryKey: ['items'] });
    },
  });

  // AI Daily Standup loads automatically the moment the board opens, no button needed.
  // Cached for 10 minutes so it doesn't re-run on every filter change; "Regenerate" forces a refresh.
  const {
    data: standupData,
    isFetching: loadingStandup,
    refetch: refetchStandup,
  } = useQuery({
    queryKey: ['ai-standup'],
    queryFn: async () => (await api.get('/ai/standup')).data as { summary: string; itemCount: number },
    staleTime: 10 * 60 * 1000,
  });

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || !activeWorkflow) return;
    const itemId = active.id as string;
    const newStatusId = over.id as string;
    const current = items?.find((i) => i.id === itemId);
    if (!current || current.statusId === newStatusId) return;

    // Optimistic update: move the card instantly, then persist.
    qc.setQueryData<Item[]>(['items', activeWorkflow.id, filters], (old) =>
      old?.map((i) => (i.id === itemId ? { ...i, statusId: newStatusId, status: activeWorkflow.statuses.find((s) => s.id === newStatusId)! } : i))
    );
    statusMutation.mutate({ id: itemId, statusId: newStatusId });
  }

  function clearFilters() {
    setStatusId('');
    setAssigneeId('');
    setLabelId('');
    setDueAfter('');
    setDueBefore('');
  }

  if (!workflows) return <div className="text-sm text-slate-400">Loading workflows...</div>;
  if (!activeWorkflow) return <div className="text-sm text-slate-400">No workflows yet. Create one first.</div>;

  const grouped = activeWorkflow.statuses.map((s) => ({
    status: s,
    items: (items || []).filter((i) => i.statusId === s.id),
  }));

  const activeFilterCount = [statusId, assigneeId, labelId, dueAfter, dueBefore].filter(Boolean).length;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-3 shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          <select className="input w-auto" value={activeWorkflow.id} onChange={(e) => setWorkflowId(e.target.value)}>
            {workflows.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
          <span
            className={`flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-full ${
              live ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-400'
            }`}
            title={live ? 'Real-time updates connected' : 'Real-time updates offline'}
          >
            <Radio size={11} className={live ? 'animate-pulse' : ''} />
            {live ? 'Live' : 'Offline'}
          </span>
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
          <button
            className={`btn-secondary relative ${activeFilterCount ? 'border-brand-400 text-brand-700' : ''}`}
            onClick={() => setShowFilters((s) => !s)}
          >
            <SlidersHorizontal size={14} /> Filters
            {activeFilterCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 h-4 min-w-4 px-1 rounded-full bg-brand-600 text-white text-[10px] leading-4 text-center font-semibold">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
        <button className="btn-primary" onClick={() => setShowNewItem(true)}>
          <Plus size={15} /> New item
        </button>
      </div>

      {showFilters && (
        <div className="card p-3 mb-3 flex flex-wrap gap-3 items-end shrink-0">
          <div>
            <label className="text-xs font-medium text-slate-500">Status</label>
            <select className="input mt-1 w-40" value={statusId} onChange={(e) => setStatusId(e.target.value)}>
              <option value="">Any status</option>
              {activeWorkflow.statuses.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500">Assignee</label>
            <select className="input mt-1 w-40" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
              <option value="">Anyone</option>
              {users?.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500">Label</label>
            <select className="input mt-1 w-40" value={labelId} onChange={(e) => setLabelId(e.target.value)}>
              <option value="">Any label</option>
              {labels?.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500">Due after</label>
            <input type="date" className="input mt-1" value={dueAfter} onChange={(e) => setDueAfter(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500">Due before</label>
            <input type="date" className="input mt-1" value={dueBefore} onChange={(e) => setDueBefore(e.target.value)} />
          </div>
          {activeFilterCount > 0 && (
            <button className="btn-ghost" onClick={clearFilters}>
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Collapsed by default so the board is always visible right away; data is already loaded
          in the background (no click needed to fetch it), only the panel needs a click to open. */}
      {standupData && (
        <div className="card mb-3 border-brand-100 bg-brand-50/40 text-sm text-slate-700 shrink-0">
          <button className="flex items-center justify-between w-full p-3" onClick={() => setStandupOpen((o) => !o)}>
            <div className="font-semibold text-brand-700 text-xs flex items-center gap-1.5">
              <Sparkles size={13} /> Today's AI Standup ready ({standupData.itemCount} items updated)
            </div>
            <div className="flex items-center gap-2">
              <span
                role="button"
                tabIndex={0}
                className="text-slate-400 hover:text-brand-600 disabled:opacity-50"
                onClick={(e) => {
                  e.stopPropagation();
                  refetchStandup();
                }}
                title="Regenerate"
              >
                <RefreshCw size={13} className={loadingStandup ? 'animate-spin' : ''} />
              </span>
              {standupOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </div>
          </button>
          {standupOpen && <div className="whitespace-pre-wrap px-3 pb-3">{standupData.summary}</div>}
        </div>
      )}

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="flex gap-4 overflow-x-auto flex-1 min-h-0 pb-2">
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
