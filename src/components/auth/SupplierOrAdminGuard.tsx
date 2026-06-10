import { Navigate } from 'react-router-dom';
import { useProfile } from '../../context/ProfileContext';

interface SupplierOrAdminGuardProps {
  children: React.ReactNode;
}

export function SupplierOrAdminGuard({ children }: SupplierOrAdminGuardProps) {
  const { user, isAdmin, userType, isLoading } = useProfile();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-bg">
        <div className="text-brand-muted text-sm">Loading…</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin && userType !== 'supplier_staff') {
    return <Navigate to="/calculator" replace />;
  }

  return <>{children}</>;
}
