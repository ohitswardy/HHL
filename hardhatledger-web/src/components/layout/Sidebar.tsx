import { NavLink } from 'react-router-dom';
import { HiHome, HiCube, HiShoppingCart, HiDocumentReport, HiUserGroup, HiTruck, HiCollection, HiClipboardList, HiChartBar, HiCash, HiDocumentText, HiShieldCheck } from 'react-icons/hi';
import { useAuthStore } from '../../stores/authStore';

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  permission?: string;
  roles?: string[];
}

export function Sidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { user, hasRole } = useAuthStore();

  const navItems: NavItem[] = [
    { to: '/dashboard', label: 'Dashboard', icon: <HiHome className="w-5 h-5" /> },
    { to: '/pos', label: 'Point of Sale', icon: <HiShoppingCart className="w-5 h-5" />, roles: ['Sales Clerk', 'Admin', 'Manager', 'Super Admin'] },
    { to: '/inventory', label: 'Products', icon: <HiCube className="w-5 h-5" />, roles: ['Admin', 'Manager', 'Super Admin'] },
    { to: '/inventory/stock', label: 'Stock Levels', icon: <HiCollection className="w-5 h-5" />, roles: ['Admin', 'Manager', 'Super Admin'] },
    { to: '/inventory/movements', label: 'Stock Movements', icon: <HiClipboardList className="w-5 h-5" />, roles: ['Manager', 'Super Admin'] },
    { to: '/purchase-orders', label: 'Purchase Orders', icon: <HiDocumentText className="w-5 h-5" />, roles: ['Manager', 'Super Admin'] },
    { to: '/clients', label: 'Clients', icon: <HiUserGroup className="w-5 h-5" />, roles: ['Admin', 'Manager', 'Super Admin'] },
    { to: '/suppliers', label: 'Suppliers', icon: <HiTruck className="w-5 h-5" />, roles: ['Manager', 'Super Admin'] },
    { to: '/accounting', label: 'Accounting', icon: <HiCash className="w-5 h-5" />, roles: ['Manager', 'Super Admin'] },
    { to: '/accounting/journal', label: 'Journal Entries', icon: <HiDocumentReport className="w-5 h-5" />, roles: ['Manager', 'Super Admin'] },
    { to: '/accounting/reports/income', label: 'Reports', icon: <HiChartBar className="w-5 h-5" />, roles: ['Manager', 'Super Admin'] },
    { to: '/users', label: 'User Management', icon: <HiShieldCheck className="w-5 h-5" />, roles: ['Super Admin', 'Manager'] },
  ];

  const filteredItems = navItems.filter((item) => {
    if (!item.roles) return true;
    return item.roles.some((role) => hasRole(role));
  });

  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-black/30 z-20 lg:hidden" onClick={onClose} />}
      <aside className={`fixed lg:static inset-y-0 left-0 z-30 w-64 bg-navy text-white transform transition-transform lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center gap-3 px-6 py-5 border-b border-white/10">
          <div className="w-9 h-9 bg-amber rounded-lg flex items-center justify-center">
            <span className="text-navy-dark font-bold text-lg">H</span>
          </div>
          <div>
            <h1 className="font-bold text-base">HardhatLedger</h1>
            <p className="text-xs text-white/60">Construction Materials</p>
          </div>
        </div>

        <nav className="mt-4 px-3 space-y-1 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 140px)' }}>
          {filteredItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/dashboard'}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-white/15 text-amber border-l-3 border-amber'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 px-4 py-3 border-t border-white/10">
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
