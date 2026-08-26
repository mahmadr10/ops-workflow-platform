import { useState } from 'react';
import { FileDown, FileSpreadsheet, FileText, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api/client';

export default function Reports() {
  const [range, setRange] = useState<'week' | 'month'>('week');
  const [summary, setSummary] = useState<{ aiSummary: string; totalUpdated: number; completed: number; blocked: number } | null>(null);
  const [loading, setLoading] = useState(false);

  async function download(format: 'csv' | 'xlsx' | 'pdf') {
    try {
      const res = await api.get(`/reports/export.${format}`, { params: { range }, responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `report.${format}`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success(`${format.toUpperCase()} downloaded`);
    } catch {
      toast.error('Export failed');
    }
  }

  async function generateSummary() {
    setLoading(true);
    try {
      const res = await api.get('/reports/summary', { params: { range } });
      setSummary(res.data);
    } catch {
      toast.error('Summary generation failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-lg font-semibold">Reporting</h1>
        <p className="text-sm text-slate-500">Export operational data and generate AI executive summaries.</p>
      </div>

      <div className="card p-5">
        <div className="flex items-center gap-3 mb-4">
          <label className="text-sm font-medium">Report period</label>
          <select className="input w-auto" value={range} onChange={(e) => setRange(e.target.value as any)}>
            <option value="week">Weekly Report</option>
            <option value="month">Monthly Report</option>
          </select>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <button className="btn-secondary" onClick={() => download('csv')}>
            <FileDown size={15} /> Export CSV
          </button>
          <button className="btn-secondary" onClick={() => download('xlsx')}>
            <FileSpreadsheet size={15} /> Export Excel
          </button>
          <button className="btn-secondary" onClick={() => download('pdf')}>
            <FileText size={15} /> Export PDF
          </button>
        </div>
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <Sparkles size={15} className="text-brand-500" /> AI Executive Summary
          </h3>
          <button className="btn-primary" onClick={generateSummary} disabled={loading}>
            {loading ? 'Generating...' : 'Generate'}
          </button>
        </div>
        {summary && (
          <div>
            <div className="flex gap-4 text-xs text-slate-500 mb-3">
              <span><b className="text-slate-800">{summary.totalUpdated}</b> items updated</span>
              <span><b className="text-slate-800">{summary.completed}</b> completed</span>
              <span><b className="text-slate-800">{summary.blocked}</b> at risk</span>
            </div>
            <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 rounded-lg p-3">{summary.aiSummary}</p>
          </div>
        )}
        {!summary && <p className="text-sm text-slate-400">Click Generate to produce an AI-written summary of this period's operations.</p>}
      </div>
    </div>
  );
}
