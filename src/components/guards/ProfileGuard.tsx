import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface ProfileGuardProps {
  children: React.ReactNode;
}

export function ProfileGuard({ children }: ProfileGuardProps) {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Check if profile is incomplete (missing required onboarding fields)
  const isProfileComplete = profile &&
    profile.bio &&
    profile.phone &&
    profile.location &&
    profile.avatar_url;

  if (!isProfileComplete) {
    return <Navigate to="/profile-setup" replace />;
  }

  return <>{children}</>;
}
