import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        console.log('Auth callback triggered with URL:', window.location.href);
        
        // Get the hash parameters from the URL
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const type = hashParams.get('type');
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');

        console.log('Hash params:', { type, accessToken: !!accessToken, refreshToken: !!refreshToken });

        if (accessToken && refreshToken) {
          console.log('Setting session with tokens');
          // Set the session
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });

          if (sessionError) {
            console.error('Error setting session:', sessionError);
            toast.error('Failed to set session. Please try again.');
            navigate('/login');
            return;
          }

          // Get the current user
          const { data: { user }, error: userError } = await supabase.auth.getUser();

          if (userError || !user) {
            console.error('Error getting user:', userError);
            toast.error('Failed to get user information. Please try again.');
            navigate('/login');
            return;
          }

          console.log('User authenticated:', user.email);

          if (type === 'recovery') {
            // Redirect to password reset page
            console.log('Redirecting to password reset page');
            navigate('/reset-password');
            return;
          }

          // If it's a verification, redirect to login
          toast.success('Account verified successfully! Please log in.');
          navigate('/login');
        } else {
          // Check if this is a password reset link
          const type = searchParams.get('type');
          const token = searchParams.get('token');
          
          console.log('Search params:', { type, token: !!token });
          
          if (type === 'recovery' && token) {
            console.log('Processing recovery token');
            // Set the session with the token
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: token,
              refresh_token: ''
            });

            if (sessionError) {
              console.error('Error setting session:', sessionError);
              toast.error('Failed to set session. Please try again.');
              navigate('/login');
              return;
            }

            // Redirect to password reset page
            console.log('Redirecting to password reset page');
            navigate('/reset-password');
            return;
          }
          
          // Check if this is a magic link or invite link
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();
          
          if (session && !sessionError) {
            console.log('Valid session found, redirecting to reset password');
            navigate('/reset-password');
            return;
          }

          console.error('No valid authentication found in URL');
          toast.error('Invalid verification link. Please try again.');
          navigate('/login');
        }
      } catch (error) {
        console.error('Error in auth callback:', error);
        toast.error('An error occurred during verification. Please try again.');
        navigate('/login');
      } finally {
        setIsLoading(false);
      }
    };

    handleCallback();
  }, [navigate, searchParams]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-lg">Verifying your account...</p>
        </div>
      </div>
    );
  }

  return null;
} 