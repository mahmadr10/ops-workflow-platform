import { useDroppable } from '@dnd-kit/core';
import type { Item, WorkflowStatus } from '../types';
import ItemCard from './ItemCard';

export default function KanbanColumn({
  status,
  items,
  onCardClick,
}: {
  status: WorkflowStatus;
  items: Item[];
  onCardClick: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status.id });

  return (
    <div className="flex flex-col w-72 shrink-0">
      <div className="flex items-center justify-between px-1 mb-2">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: status.color }} />
          <h3 className="text-sm font-semibold text-slate-700">{status.name}</h3>
        </div>
        <span className="text-xs text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">{items.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 rounded-xl p-2 space-y-2 min-h-[200px] transition-colors ${
          isOver ? 'bg-brand-50 ring-2 ring-brand-200' : 'bg-slate-100/60'
        }`}
      >
        {items.map((item) => (
          <ItemCard key={item.id} item={item} onClick={() => onCardClick(item.id)} />
        ))}
        {items.length === 0 && <div className="text-xs text-slate-400 text-center py-6">No items</div>}
      </div>
    </div>
  );
}
