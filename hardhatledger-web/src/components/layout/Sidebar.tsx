import { NavLink } from 'react-router-dom';
import { HiHome, HiCube, HiShoppingCart, HiDocumentReport, HiUserGroup, HiTruck, HiCollection, HiClipboardList, HiChartBar, HiCash, HiDocumentText, HiShieldCheck, HiTag, HiX, HiKey, HiClipboardCheck, HiDatabase } from 'react-icons/hi';
import { useAuthStore } from '../../stores/authStore';

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  permission?: string;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

export function Sidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { user, hasRole, hasPermission } = useAuthStore();

  const groups: NavGroup[] = [
    {
      title: 'POS',
      items: [
        { to: '/pos', label: 'Point of Sale', icon: <HiShoppingCart className="w-5 h-5" />, permission: 'pos.access' },
        { to: '/pos/transactions', label: 'Transactions', icon: <HiDocumentReport className="w-5 h-5" />, permission: 'pos.access' },
        { to: '/clients', label: 'Clients', icon: <HiUserGroup className="w-5 h-5" />, permission: 'clients.view' },
      ],
    },
    {
      title: 'Inventory',
      items: [
        { to: '/inventory', label: 'Products', icon: <HiCube className="w-5 h-5" />, permission: 'products.view' },
        { to: '/inventory/categories', label: 'Categories', icon: <HiCollection className="w-5 h-5" />, permission: 'categories.view' },
        { to: '/inventory/stock', label: 'Stock Levels', icon: <HiClipboardList className="w-5 h-5" />, permission: 'inventory.view' },
        { to: '/inventory/movements', label: 'Stock Movements', icon: <HiDocumentReport className="w-5 h-5" />, permission: 'inventory.view' },
        { to: '/inventory/pricing', label: 'Tier Pricing', icon: <HiTag className="w-5 h-5" />, permission: 'products.edit' },
        { to: '/purchase-orders', label: 'Purchase Orders', icon: <HiDocumentText className="w-5 h-5" />, permission: 'purchase-orders.view' },
        { to: '/suppliers', label: 'Suppliers', icon: <HiTruck className="w-5 h-5" />, permission: 'suppliers.view' },
      ],
    },
    {
      title: 'Accounting',
      items: [
        { to: '/accounting', label: 'Overview', icon: <HiCash className="w-5 h-5" />, permission: 'accounting.view' },
        { to: '/accounting/journal', label: 'Journal Entries', icon: <HiDocumentReport className="w-5 h-5" />, permission: 'accounting.view' },
        { to: '/accounting/reports/income', label: 'Reports', icon: <HiChartBar className="w-5 h-5" />, permission: 'accounting.view' },
      ],
    },
  ];

  const isVisible = (item: NavItem) => {
    if (!item.permission) return true;
    return hasPermission(item.permission);
  };

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `neu-sidebar-link ${isActive ? 'neu-sidebar-link-active' : ''}`;

  return (
    <>
      {/* Overlay — mobile only */}
      {isOpen && (
        <div
          className="fixed inset-0 z-20 lg:hidden"
          style={{ background: 'var(--n-modal-overlay)', backdropFilter: 'blur(4px)' }}
          onClick={onClose}
          aria-label="Close menu"
        />
      )}
      <aside className={`neu-sidebar fixed lg:static inset-y-0 left-0 z-30 w-64 transform transition-transform duration-300 lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col`}>
        {/* Logo + mobile close */}
        <div className="flex items-center gap-3 px-6 py-5 shrink-0" style={{ borderBottom: '1px solid var(--n-sidebar-border)' }}>
          <img src="/HHLicon.png" alt="HardhatLedger" className="shrink-0" style={{ width: 36, height: 36, objectFit: 'contain' }} />
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-base" style={{ fontFamily: 'var(--n-font-display)', color: 'var(--n-sidebar-text)' }}>HardhatLedger</h1>
            <p className="text-xs" style={{ color: 'var(--n-sidebar-dim)' }}>CW Devs</p>
          </div>
          {/* Close button — mobile only */}
          <button
            onClick={onClose}
            className="lg:hidden shrink-0 p-1 rounded-lg transition-colors"
            style={{ color: 'var(--n-sidebar-dim)' }}
            aria-label="Close sidebar"
          >
            <HiX className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-5">
          {(hasPermission('dashboard.view') || hasRole('Super Admin')) && (
            <NavLink to="/dashboard" end onClick={onClose} className={linkClass}>
              <HiHome className="w-5 h-5" />
              Dashboard
            </NavLink>
          )}

          {groups.map((group) => {
            const visibleItems = group.items.filter(isVisible);
            if (visibleItems.length === 0) return null;
            return (
              <div key={group.title}>
                <p className="neu-sidebar-section">{group.title}</p>
                <div className="space-y-0.5">
                  {visibleItems.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === '/accounting'}
                      onClick={onClose}
                      className={linkClass}
                    >
                      {item.icon}
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              </div>
            );
          })}

          {(hasPermission('users.view') || hasPermission('audit-logs.view') || hasRole('Super Admin')) && (
            <div>
              <p className="neu-sidebar-section">Admin</p>
              <div className="space-y-0.5">
                {hasPermission('users.view') && (
                  <NavLink to="/users" onClick={onClose} className={linkClass}>
                    <HiShieldCheck className="w-5 h-5" />
                    User Management
                  </NavLink>
                )}
                {hasPermission('roles.view') && (
                  <NavLink to="/roles" onClick={onClose} className={linkClass}>
                    <HiKey className="w-5 h-5" />
                    Role Management
                  </NavLink>
                )}
                {hasPermission('audit-logs.view') && (
                  <NavLink to="/admin/audit-trail" onClick={onClose} className={linkClass}>
                    <HiClipboardCheck className="w-5 h-5" />
                    Audit Trail
                  </NavLink>
                )}
                {hasRole('Super Admin') && (
                  <NavLink to="/admin/database-control" onClick={onClose} className={linkClass}>
                    <HiDatabase className="w-5 h-5" />
                    Database Control
                  </NavLink>
                )}
              </div>
            </div>
          )}
        </nav>

        {/* User footer */}
        <div className="shrink-0 px-4 py-3" style={{ borderTop: '1px solid var(--n-sidebar-border)' }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'var(--n-accent-glow)' }}>
              <span style={{ color: 'var(--n-accent)', fontSize: '0.875rem', fontWeight: 700 }}>{user?.name?.charAt(0)}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: 'var(--n-sidebar-text)' }}>{user?.name}</p>
              <p className="text-xs truncate" style={{ color: 'var(--n-sidebar-dim)' }}>{user?.roles?.[0]}</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
