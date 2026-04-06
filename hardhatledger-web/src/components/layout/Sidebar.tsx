import { NavLink } from 'react-router-dom';
import { HiHome, HiCube, HiShoppingCart, HiDocumentReport, HiUserGroup, HiTruck, HiCollection, HiClipboardList, HiChartBar, HiCash, HiDocumentText, HiShieldCheck } from 'react-icons/hi';
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
        { to: '/inventory/stock', label: 'Stock Levels', icon: <HiCollection className="w-5 h-5" />, roles: ['Admin', 'Manager', 'Super Admin'] },
        { to: '/inventory/movements', label: 'Stock Movements', icon: <HiClipboardList className="w-5 h-5" />, roles: ['Manager', 'Super Admin'] },
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

  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-black/30 z-20 lg:hidden" onClick={onClose} />}
      <aside className={`fixed lg:static inset-y-0 left-0 z-30 w-64 bg-navy text-white transform transition-transform lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col`}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-white/10 shrink-0">
          <div className="w-9 h-9 bg-amber rounded-lg flex items-center justify-center">
            <span className="text-navy-dark font-bold text-lg">H</span>
          </div>
          <div>
            <h1 className="font-bold text-base">HardhatLedger</h1>
            <p className="text-xs text-white/60">Construction Materials</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-5">
          {/* Dashboard */}
          <NavLink
            to="/dashboard"
            end
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-white/15 text-amber border-l-[3px] border-amber'
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
              }`
            }
          >
            <HiHome className="w-5 h-5" />
            Dashboard
          </NavLink>

          {/* Grouped sections */}
          {groups.map((group) => {
            const visibleItems = group.items.filter(isVisible);
            if (visibleItems.length === 0) return null;
            return (
              <div key={group.title}>
                <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/35">
                  {group.title}
                </p>
                <div className="space-y-0.5">
                  {visibleItems.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === '/accounting'}
                      onClick={onClose}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                          isActive
                            ? 'bg-white/15 text-amber border-l-[3px] border-amber'
                            : 'text-white/70 hover:bg-white/10 hover:text-white'
                        }`
                      }
                    >
                      {item.icon}
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Admin */}
          {hasRole('Super Admin') || hasRole('Manager') ? (
            <div>
              <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/35">
                Admin
              </p>
              <div className="space-y-0.5">
                <NavLink
                  to="/users"
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-white/15 text-amber border-l-[3px] border-amber'
                        : 'text-white/70 hover:bg-white/10 hover:text-white'
                    }`
                  }
                >
                  <HiShieldCheck className="w-5 h-5" />
                  User Management
                </NavLink>
              </div>
            </div>
          ) : null}
        </nav>

        {/* User footer */}
        <div className="shrink-0 px-4 py-3 border-t border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-amber/20 rounded-full flex items-center justify-center">
              <span className="text-amber text-sm font-bold">{user?.name?.charAt(0)}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.name}</p>
              <p className="text-xs text-white/50 truncate">{user?.roles?.[0]}</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
