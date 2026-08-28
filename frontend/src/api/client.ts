import axios from 'axios';
import { useAuth } from '../store/auth';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
});

api.interceptors.request.use((config) => {
  const token = useAuth.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      useAuth.getState().logout();
    }
    return Promise.reject(err);
  }
);

// Attachment URLs come back from the API as relative paths (e.g. "/uploads/xyz.png"). In dev
// that resolves fine against the frontend's own origin thanks to the Vite proxy; in production
// the frontend (Vercel) and backend (Railway) are different origins, so this resolves the
// relative path against the real API origin instead.
export function resolveFileUrl(url: string): string {
  if (/^https?:\/\//.test(url)) return url;
  const apiUrl = import.meta.env.VITE_API_URL as string | undefined;
  const origin = apiUrl?.startsWith('http') ? apiUrl.replace(/\/api\/?$/, '') : '';
  return `${origin}${url}`;
}
