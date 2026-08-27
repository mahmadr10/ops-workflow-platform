import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bell, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';
import clsx from 'clsx';
import { api } from '../api/client';

interface Notification {
  id: string;
  channel: string;
  subject: string;
  message: string;
  status: 'PENDING' | 'SENT' | 'FAILED';
  error?: string | null;
  createdAt: string;
}

// Shows the notifications addressed to the logged-in user (e.g. reminders for items they're
// assigned to). This is where "reminder sent to the assignee" actually becomes visible to them.
export default function NotificationBell() {
  const [open, setOpen] = useState(false);

  const { data: notifications } = useQuery<Notification[]>({
    queryKey: ['notifications', 'mine'],
    queryFn: async () => (await api.get('/notifications')).data,
    refetchInterval: 30000,
  });

  const count = notifications?.length ?? 0;

  return (
    <div className="relative">
      <button
        className="relative text-slate-400 hover:text-slate-700 transition-colors"
        onClick={() => setOpen((o) => !o)}
        title="Notifications addressed to you"
      >
        <Bell size={18} />
        {count > 0 && (
          <span className="absolute -top-1.5 -right-1.5 h-4 min-w-4 px-1 rounded-full bg-red-500 text-white text-[10px] leading-4 text-center font-semibold">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 card z-50 max-h-96 overflow-y-auto py-1">
            <div className="px-3 py-2 border-b border-slate-100">
              <h4 className="text-sm font-semibold">Your notifications</h4>
              <p className="text-[11px] text-slate-400">Reminders and alerts addressed to you</p>
            </div>
            {!notifications?.length && <div className="px-3 py-6 text-center text-xs text-slate-400">Nothing yet</div>}
            {notifications?.map((n) => (
              <div key={n.id} className="px-3 py-2.5 border-b border-slate-50 last:border-0">
                <div className="flex items-start gap-2">
                  {n.status === 'SENT' && <CheckCircle2 size={14} className="text-green-500 mt-0.5 shrink-0" />}
                  {n.status === 'FAILED' && <XCircle size={14} className="text-red-400 mt-0.5 shrink-0" />}
                  {n.status === 'PENDING' && <Clock size={14} className="text-amber-500 mt-0.5 shrink-0" />}
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-slate-800 leading-snug">{n.subject}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{n.message}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="label-pill bg-slate-100 text-slate-500">{n.channel}</span>
                      <span
                        className={clsx(
                          'text-[10px]',
                          n.status === 'SENT' && 'text-green-600',
                          n.status === 'FAILED' && 'text-red-500',
                          n.status === 'PENDING' && 'text-amber-600'
                        )}
                      >
                        {n.status === 'FAILED' ? `Failed: ${n.error || 'channel not configured'}` : n.status}
                      </span>
                      <span className="text-[10px] text-slate-300">{format(new Date(n.createdAt), 'MMM d, HH:mm')}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
