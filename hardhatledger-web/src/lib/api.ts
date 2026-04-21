import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('hhl_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('hhl_token');
      localStorage.removeItem('hhl_user');
      // Dispatch a custom event so the React Router tree can navigate without
      // a full page reload (avoids discarding in-memory state).
      window.dispatchEvent(new CustomEvent('hhl:unauthenticated'));
    }
    return Promise.reject(error);
  }
);

export default api;
