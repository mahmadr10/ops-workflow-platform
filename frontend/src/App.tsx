import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './store/auth';
import Layout from './components/Layout';
import Login from './pages/Login';
import Board from './pages/Board';
import Workflows from './pages/Workflows';
import Dashboard from './pages/Dashboard';
import Reports from './pages/Reports';
import Chatbot from './pages/Chatbot';
import Users from './pages/Users';

function RequireAuth({ children }: { children: JSX.Element }) {
  const token = useAuth((s) => s.token);
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

function RequireAdmin({ children }: { children: JSX.Element }) {
  const role = useAuth((s) => s.user?.role);
  if (role !== 'ADMIN') return <Navigate to="/board" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route path="/board" element={<Board />} />
        <Route path="/workflows" element={<Workflows />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/chat" element={<Chatbot />} />
        <Route
          path="/users"
          element={
            <RequireAdmin>
              <Users />
            </RequireAdmin>
          }
        />
        <Route path="/" element={<Navigate to="/board" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/board" replace />} />
    </Routes>
  );
}
