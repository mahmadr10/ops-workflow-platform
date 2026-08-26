import { useDraggable } from '@dnd-kit/core';
import { CalendarDays, MessageSquare, Paperclip, Flame } from 'lucide-react';
import clsx from 'clsx';
import type { Item } from '../types';
import { format } from 'date-fns';

export default function ItemCard({ item, onClick }: { item: Item; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: item.id });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 50 }
    : undefined;

  const overdue = item.dueDate && new Date(item.dueDate) < new Date() && !item.status.isTerminal;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={clsx(
        'card p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow select-none',
        isDragging && 'opacity-50 shadow-lg'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-medium text-slate-800 leading-snug">{item.title}</h4>
        {item.riskScore >= 60 && <Flame size={14} className="text-red-500 shrink-0 mt-0.5" />}
      </div>

      {item.labels && item.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {item.labels.map((l) => (
            <span key={l.label.id} className="label-pill" style={{ background: `${l.label.color}22`, color: l.label.color }}>
              {l.label.name}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between mt-3">
        <span className={clsx('label-pill', `badge-priority-${item.priority}`)}>{item.priority}</span>
        {item.assignee && (
          <div
            className="h-6 w-6 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[10px] font-semibold"
            title={item.assignee.name}
          >
            {item.assignee.name.slice(0, 2).toUpperCase()}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-400">
        {item.dueDate && (
          <span className={clsx('flex items-center gap-1', overdue && 'text-red-500 font-medium')}>
            <CalendarDays size={12} /> {format(new Date(item.dueDate), 'MMM d')}
          </span>
        )}
        {!!item._count?.comments && (
          <span className="flex items-center gap-1">
            <MessageSquare size={12} /> {item._count.comments}
          </span>
        )}
        {!!item._count?.attachments && (
          <span className="flex items-center gap-1">
            <Paperclip size={12} /> {item._count.attachments}
          </span>
        )}
      </div>
    </div>
  );
}
