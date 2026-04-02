import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { HiMenu, HiLogout } from 'react-icons/hi';
import { Sidebar } from './Sidebar';
import { useAuthStore } from '../../stores/authStore';
import { Toaster } from 'react-hot-toast';

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { logout, user } = useAuthStore();

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-4 lg:px-6 h-14 flex items-center justify-between shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 hover:bg-gray-100 rounded-lg"
          >
            <HiMenu className="w-5 h-5" />
          </button>

          <div className="flex-1" />

          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600 hidden sm:block">{user?.name}</span>
            <button
              onClick={logout}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <HiLogout className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>

      <Toaster position="top-right" toastOptions={{
        style: { fontSize: '14px' },
        success: { duration: 3000 },
        error: { duration: 5000 },
      }} />
    </div>
  );
}
