import { Redirect } from 'wouter';
import { useAuth } from '@/contexts/auth-context';
import Login from '@/pages/login';

export default function HomeRedirect() {
  const { user, token, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  if (user || token) {
    return <Redirect to="/dashboard" />;
  }

  return <Login />;
}
