import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';

interface ProtectedRouteProps {
  children: React.ReactNode;
  permission?: string;
  roles?: string[];
}

export function ProtectedRoute({ children, permission, roles }: ProtectedRouteProps) {
  const { user, hasPermission, hasRole } = useAuthStore();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (permission && !hasPermission(permission)) {
    return <Navigate to="/dashboard" replace />;
  }

  if (roles && !roles.some((role) => hasRole(role))) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
