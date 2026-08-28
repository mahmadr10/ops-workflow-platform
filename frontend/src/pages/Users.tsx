import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Copy, Check, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { api } from '../api/client';
import type { Role, User } from '../types';

const roles: Role[] = ['ADMIN', 'MANAGER', 'EMPLOYEE', 'READONLY'];

const roleBadge: Record<Role, string> = {
  ADMIN: 'bg-purple-100 text-purple-700',
  MANAGER: 'bg-blue-100 text-blue-700',
  EMPLOYEE: 'bg-slate-100 text-slate-600',
  READONLY: 'bg-amber-100 text-amber-700',
};

// Admin-only page: create as many team accounts as needed, directly, no self-service signup
// required. This is the "admin can add more and more accounts" requirement.
export default function Users() {
  const qc = useQueryClient();
  const { data: users } = useQuery<User[]>({ queryKey: ['users'], queryFn: async () => (await api.get('/users')).data });

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('EMPLOYEE');
  const [lastCreated, setLastCreated] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const createMutation = useMutation({
    mutationFn: () => api.post('/users', { name, email, role }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['users'] });
      setLastCreated({ email: res.data.user.email, password: res.data.temporaryPassword });
      setName('');
      setEmail('');
      setRole('EMPLOYEE');
      toast.success('Account created');
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to create account'),
  });

  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: Role }) => api.patch(`/users/${id}/role`, { role }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success('Role updated');
    },
    onError: () => toast.error('Failed to update role'),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    createMutation.mutate();
  }

  function copyPassword() {
    if (!lastCreated) return;
    navigator.clipboard.writeText(lastCreated.password).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-lg font-semibold">Team Accounts</h1>
        <p className="text-sm text-slate-500">Admins can create as many accounts as the team needs, directly, without any signup flow.</p>
      </div>

      <div className="card p-5">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
          <Plus size={15} /> Create a new account
        </h3>
        <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div>
            <label className="text-xs font-medium text-slate-500">Full name</label>
            <input className="input mt-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="Hina Riaz" required />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500">Email</label>
            <input
              className="input mt-1"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="hina@digitalsofts.com"
              required
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500">Role</label>
            <select className="input mt-1" value={role} onChange={(e) => setRole(e.target.value as Role)}>
              {roles.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn-primary" disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Creating...' : 'Create account'}
          </button>
        </form>

        {lastCreated && (
          <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 flex items-center justify-between">
            <div className="text-sm">
              <span className="font-medium text-green-800">{lastCreated.email}</span>
              <span className="text-green-600"> was created. Temporary password: </span>
              <code className="bg-white px-1.5 py-0.5 rounded border border-green-200 font-mono text-xs">{lastCreated.password}</code>
              <span className="text-xs text-green-600 block mt-0.5">Shown only once, share it with them securely.</span>
            </div>
            <button className="btn-ghost" onClick={copyPassword} title="Copy password">
              {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
            </button>
          </div>
        )}
      </div>

      <div className="card p-5">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
          <ShieldCheck size={15} /> All accounts ({users?.length ?? 0})
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
                <th className="pb-2 font-medium">Name</th>
                <th className="pb-2 font-medium">Email</th>
                <th className="pb-2 font-medium">Role</th>
                <th className="pb-2 font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {users?.map((u) => (
                <tr key={u.id}>
                  <td className="py-2 font-medium">{u.name}</td>
                  <td className="py-2 text-slate-500">{u.email}</td>
                  <td className="py-2">
                    <select
                      className={`label-pill border-none cursor-pointer ${roleBadge[u.role]}`}
                      value={u.role}
                      onChange={(e) => roleMutation.mutate({ id: u.id, role: e.target.value as Role })}
                    >
                      {roles.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 text-slate-400 text-xs">{u.createdAt ? format(new Date(u.createdAt), 'MMM d, yyyy') : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
