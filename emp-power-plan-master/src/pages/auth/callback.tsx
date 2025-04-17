import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const AuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error getting session:', error);
          toast.error('Failed to verify email. Please try again.');
          navigate('/login');
          return;
        }

        if (session) {
          toast.success('Email verified successfully! You can now log in.');
          navigate('/login');
        } else {
          toast.error('Session not found. Please try again.');
          navigate('/login');
        }
      } catch (error) {
        console.error('Error in auth callback:', error);
        toast.error('An error occurred. Please try again.');
        navigate('/login');
      }
    };

    handleAuthCallback();
  }, [navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Verifying your email...</h1>
        <p className="text-gray-600">Please wait while we verify your email address.</p>
      </div>
    </div>
  );
};

export default AuthCallback; 