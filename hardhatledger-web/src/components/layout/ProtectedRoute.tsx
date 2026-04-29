import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';

interface ProtectedRouteProps {
  children: React.ReactNode;
  permission?: string;
  roles?: string[];
}

const ROUTE_PRIORITY: { path: string; permission: string }[] = [
  { path: '/dashboard',         permission: 'dashboard.view' },
  { path: '/pos',               permission: 'pos.access' },
  { path: '/inventory',         permission: 'products.view' },
  { path: '/accounting',        permission: 'accounting.view' },
  { path: '/clients',           permission: 'clients.view' },
  { path: '/suppliers',         permission: 'suppliers.view' },
  { path: '/purchase-orders',   permission: 'purchase-orders.view' },
  { path: '/users',             permission: 'users.view' },
  { path: '/roles',             permission: 'roles.view' },
  { path: '/admin/audit-trail', permission: 'audit-logs.view' },
];

export function ProtectedRoute({ children, permission, roles }: ProtectedRouteProps) {
  const { user, hasPermission, hasRole } = useAuthStore();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const isSuperAdmin = hasRole('Super Admin');

  if (permission && !hasPermission(permission) && !isSuperAdmin) {
    const perms: string[] = user.permissions ?? [];
    const fallback = ROUTE_PRIORITY.find((r) => perms.includes(r.permission));
    return <Navigate to={fallback?.path ?? '/login'} replace />;
  }

  if (roles && !roles.some((role) => hasRole(role))) {
    const perms: string[] = user.permissions ?? [];
    const fallback = ROUTE_PRIORITY.find((r) => perms.includes(r.permission));
    return <Navigate to={fallback?.path ?? '/login'} replace />;
  }

  return <>{children}</>;
}
