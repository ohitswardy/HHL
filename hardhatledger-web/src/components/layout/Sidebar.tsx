import { NavLink } from 'react-router-dom';
import { HiHome, HiCube, HiShoppingCart, HiDocumentReport, HiUserGroup, HiTruck, HiCollection, HiClipboardList, HiChartBar, HiCash, HiDocumentText, HiShieldCheck, HiTag, HiX } from 'react-icons/hi';
import { useAuthStore } from '../../stores/authStore';

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  roles?: string[];
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

export function Sidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { user, hasRole } = useAuthStore();

  const groups: NavGroup[] = [
    {
      title: 'POS',
      items: [
        { to: '/pos', label: 'Point of Sale', icon: <HiShoppingCart className="w-5 h-5" />, roles: ['Sales Clerk', 'Admin', 'Manager', 'Super Admin'] },
        { to: '/pos/transactions', label: 'Transactions', icon: <HiDocumentReport className="w-5 h-5" />, roles: ['Sales Clerk', 'Admin', 'Manager', 'Super Admin'] },
        { to: '/clients', label: 'Clients', icon: <HiUserGroup className="w-5 h-5" />, roles: ['Admin', 'Manager', 'Super Admin'] },
      ],
    },
    {
      title: 'Inventory',
      items: [
        { to: '/inventory', label: 'Products', icon: <HiCube className="w-5 h-5" />, roles: ['Admin', 'Manager', 'Super Admin'] },
        { to: '/inventory/categories', label: 'Categories', icon: <HiCollection className="w-5 h-5" />, roles: ['Admin', 'Manager', 'Super Admin'] },
        { to: '/inventory/stock', label: 'Stock Levels', icon: <HiClipboardList className="w-5 h-5" />, roles: ['Admin', 'Manager', 'Super Admin'] },
        { to: '/inventory/movements', label: 'Stock Movements', icon: <HiDocumentReport className="w-5 h-5" />, roles: ['Manager', 'Super Admin'] },
        { to: '/inventory/pricing', label: 'Tier Pricing', icon: <HiTag className="w-5 h-5" />, roles: ['Admin', 'Manager', 'Super Admin'] },
        { to: '/purchase-orders', label: 'Purchase Orders', icon: <HiDocumentText className="w-5 h-5" />, roles: ['Manager', 'Super Admin'] },
        { to: '/suppliers', label: 'Suppliers', icon: <HiTruck className="w-5 h-5" />, roles: ['Manager', 'Super Admin'] },
      ],
    },
    {
      title: 'Accounting',
      items: [
        { to: '/accounting', label: 'Overview', icon: <HiCash className="w-5 h-5" />, roles: ['Manager', 'Super Admin'] },
        { to: '/accounting/journal', label: 'Journal Entries', icon: <HiDocumentReport className="w-5 h-5" />, roles: ['Manager', 'Super Admin'] },
        { to: '/accounting/reports/income', label: 'Reports', icon: <HiChartBar className="w-5 h-5" />, roles: ['Manager', 'Super Admin'] },
      ],
    },
  ];

  const isVisible = (item: NavItem) => {
    if (!item.roles) return true;
    return item.roles.some((role) => hasRole(role));
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
            <p className="text-xs" style={{ color: 'var(--n-sidebar-dim)' }}>Construction Materials</p>
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
          <NavLink to="/dashboard" end onClick={onClose} className={linkClass}>
            <HiHome className="w-5 h-5" />
            Dashboard
          </NavLink>

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

          {hasRole('Super Admin') || hasRole('Manager') ? (
            <div>
              <p className="neu-sidebar-section">Admin</p>
              <div className="space-y-0.5">
                <NavLink to="/users" onClick={onClose} className={linkClass}>
                  <HiShieldCheck className="w-5 h-5" />
                  User Management
                </NavLink>
              </div>
            </div>
          ) : null}
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
