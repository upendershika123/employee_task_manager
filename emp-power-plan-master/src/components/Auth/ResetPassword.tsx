import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Lock } from 'lucide-react';

const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSessionValid, setIsSessionValid] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      try {
        // First, try to get the current session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('Session error:', sessionError);
          // If there's a session error, try to exchange the code
          const code = searchParams.get('code');
          if (code) {
            console.log('Attempting to exchange code for session');
            const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
            
            if (exchangeError) {
              console.error('Error exchanging code:', exchangeError);
              toast.error('Invalid or expired reset link. Please request a new one.');
              navigate('/login');
              return;
            }
            
            if (data?.session) {
              console.log('Successfully exchanged code for session');
              setIsSessionValid(true);
              return;
            }
          }
          
          toast.error('Invalid or expired session. Please request a new password reset link.');
          navigate('/login');
          return;
        }
        
        if (!session) {
          console.log('No session found, checking for code');
          const code = searchParams.get('code');
          if (code) {
            console.log('Attempting to exchange code for session');
            const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
            
            if (exchangeError) {
              console.error('Error exchanging code:', exchangeError);
              toast.error('Invalid or expired reset link. Please request a new one.');
              navigate('/login');
              return;
            }
            
            if (data?.session) {
              console.log('Successfully exchanged code for session');
              setIsSessionValid(true);
              return;
            }
          }
          
          toast.error('Invalid or expired session. Please request a new password reset link.');
          navigate('/login');
          return;
        }
        
        console.log('Valid session found');
        setIsSessionValid(true);
      } catch (error) {
        console.error('Error checking session:', error);
        toast.error('An error occurred. Please try again.');
        navigate('/login');
      }
    };
    
    checkSession();
  }, [navigate, searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters long');
      return;
    }
    
    setIsLoading(true);
    
    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });
      
      if (error) {
        console.error('Error updating password:', error);
        toast.error('Failed to update password. Please try again.');
        return;
      }
      
      // Sign out the user after password reset
      await supabase.auth.signOut();
      
      toast.success('Password updated successfully! You can now log in with your new password.');
      navigate('/login');
    } catch (error) {
      console.error('Error in password reset:', error);
      toast.error('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isSessionValid) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-lg">Verifying your session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-2">
            <div className="rounded-full bg-primary/10 p-3">
              <Lock className="w-8 h-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Reset Your Password</CardTitle>
          <CardDescription>
            Enter your new password below
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? 'Updating...' : 'Update Password'}
            </Button>
            
            <Button
              type="button"
              variant="ghost"
              onClick={() => navigate('/login')}
              className="text-primary hover:text-primary/80"
            >
              Back to Login
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default ResetPassword; 