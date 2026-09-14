import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useUser } from '../../context/UserContext';
import { loginPath } from '../../lib/navigation';

export default function RequireAuth() {
  const { currentUser } = useUser();
  const location = useLocation();

  if (!currentUser) {
    const next = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={loginPath(next)} replace />;
  }

  return <Outlet />;
}
