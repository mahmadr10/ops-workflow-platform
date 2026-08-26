import { useQuery } from '@tanstack/react-query';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';
import { AlertTriangle, CheckCircle2, Clock, ListChecks, TrendingUp, Gauge } from 'lucide-react';
import { api } from '../api/client';
import type { DashboardData } from '../types';

const CARD_DEFS = [
  { key: 'total', label: 'Total Items', icon: ListChecks, color: 'text-slate-600' },
  { key: 'active', label: 'Active', icon: TrendingUp, color: 'text-blue-600' },
  { key: 'blocked', label: 'Blocked / At Risk', icon: AlertTriangle, color: 'text-red-600' },
  { key: 'completed', label: 'Completed', icon: CheckCircle2, color: 'text-green-600' },
  { key: 'overdue', label: 'Overdue', icon: Clock, color: 'text-amber-600' },
  { key: 'avgRiskScore', label: 'AI Risk Score', icon: Gauge, color: 'text-purple-600' },
] as const;

const COLORS = ['#6366f1', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899', '#22c55e', '#ef4444', '#64748b'];

export default function Dashboard() {
  const { data } = useQuery<DashboardData>({ queryKey: ['dashboard'], queryFn: async () => (await api.get('/dashboard')).data });

  if (!data) return <div className="text-sm text-slate-400">Loading dashboard...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Executive Dashboard</h1>
        <p className="text-sm text-slate-500">Live operational metrics across every workflow.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {CARD_DEFS.map((c) => (
          <div key={c.key} className="card p-4">
            <c.icon size={18} className={c.color} />
            <div className="text-2xl font-semibold mt-2">{data.cards[c.key]}</div>
            <div className="text-xs text-slate-500 mt-0.5">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-4">
          <h3 className="text-sm font-semibold mb-3">Status Distribution</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={data.statusDistribution} dataKey="count" nameKey="status" innerRadius={55} outerRadius={90} paddingAngle={2}>
                {data.statusDistribution.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-4">
          <h3 className="text-sm font-semibold mb-3">Completion Trend (14 days)</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data.completionTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => d.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-4">
          <h3 className="text-sm font-semibold mb-3">Average Cycle Time (days)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.cycleTimes}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="workflow" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="avgDays" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-4">
          <h3 className="text-sm font-semibold mb-3">Assignee Performance (completed)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.assigneePerformance} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
              <Tooltip />
              <Bar dataKey="count" fill="#22c55e" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card p-4">
        <h3 className="text-sm font-semibold mb-3">Workflow Bottlenecks</h3>
        <div className="space-y-2">
          {data.bottlenecks.map((b, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-32 text-xs text-slate-500 truncate">{b.workflow} / {b.status}</div>
              <div className="flex-1 bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div
                  className="h-full bg-amber-400 rounded-full"
                  style={{ width: `${Math.min(100, (b.itemCount / (data.bottlenecks[0]?.itemCount || 1)) * 100)}%` }}
                />
              </div>
              <div className="w-8 text-xs text-slate-500 text-right">{b.itemCount}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
