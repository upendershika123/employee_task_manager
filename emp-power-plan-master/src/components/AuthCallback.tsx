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
        const type = searchParams.get('type');
        const code = searchParams.get('code');
        
        console.log('Auth callback params:', { type, code: !!code });

        if (type === 'recovery' && code) {
          console.log('Processing recovery code');
          
          // Exchange the code for a session
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          
          if (error) {
            console.error('Error exchanging code for session:', error);
            toast.error('Invalid or expired recovery link. Please request a new one.');
            navigate('/login');
            return;
          }

          if (data?.session) {
            console.log('Successfully exchanged code for session');
            // Redirect to password reset page
            navigate('/reset-password');
            return;
          }
        }

        // Handle other types of callbacks (verification, magic link, etc.)
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (session && !sessionError) {
          console.log('Valid session found');
          if (type === 'recovery') {
            navigate('/reset-password');
          } else {
            toast.success('Account verified successfully! Please log in.');
            navigate('/login');
          }
          return;
        }

        console.error('No valid authentication found in URL');
        toast.error('Invalid verification link. Please try again.');
        navigate('/login');
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
          <p className="mt-4 text-lg">Processing your request...</p>
        </div>
      </div>
    );
  }

  return null;
} 