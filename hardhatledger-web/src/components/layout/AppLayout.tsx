import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { HiMenu, HiLogout, HiSun, HiMoon } from 'react-icons/hi';
import { Sidebar } from './Sidebar';
import { useAuthStore } from '../../stores/authStore';
import { useThemeStore } from '../../stores/themeStore';
import { Toaster } from 'react-hot-toast';

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { logout, user } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();

  return (
    <div className="flex h-screen" style={{ background: 'var(--n-base)' }}>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="neu-header px-4 lg:px-6 h-14 flex items-center justify-between shrink-0 gap-3">
          {/* Burger — mobile only; hidden on lg+ thanks to @layer components fix */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden neu-btn-icon shrink-0"
            aria-label="Open menu"
          >
            <HiMenu className="w-5 h-5" />
          </button>

          {/* Mascot logo — absolutely centred in topbar on mobile/tablet */}
          <img
            src="/HHLicon.png"
            alt="HardhatLedger"
            className="lg:hidden"
            style={{ width: 32, height: 32, objectFit: 'contain', position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}
          />

          <div className="flex-1" />

          <div className="flex items-center gap-3">
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="neu-theme-toggle"
              aria-label="Toggle dark mode"
            >
              <span className="neu-theme-toggle-knob" />
              <span className="absolute inset-0 flex items-center justify-between px-1.5 pointer-events-none">
                <HiSun className="w-3.5 h-3.5" style={{ color: theme === 'light' ? '#F5A623' : 'var(--n-text-dim)' }} />
                <HiMoon className="w-3.5 h-3.5" style={{ color: theme === 'dark' ? '#F5A623' : 'var(--n-text-dim)' }} />
              </span>
            </button>

            <span className="text-sm hidden sm:block" style={{ color: 'var(--n-text-secondary)' }}>{user?.name}</span>
            <button
              onClick={logout}
              className="neu-btn-icon danger"
              title="Logout"
            >
              <HiLogout className="w-4 h-4" />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>

      <Toaster position="top-right" toastOptions={{
        style: {
          fontSize: '14px',
          fontFamily: 'var(--n-font-body)',
          background: 'var(--n-surface)',
          color: 'var(--n-text)',
          borderRadius: '14px',
          boxShadow: '6px 6px 14px var(--n-shadow-dark), -6px -6px 14px var(--n-shadow-light)',
        },
        success: { duration: 3000 },
        error: { duration: 5000 },
      }} />
    </div>
  );
}
