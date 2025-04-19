import { AuthService } from './types';
import { User } from '../types';
import { supabase } from '@/integrations/supabase/client';
import { supabaseAdmin } from '@/integrations/supabase/admin';
import { toast } from 'sonner';

interface AuthUser {
  id: string;
  email: string;
  user_metadata: {
    name: string;
    role: string;
    team_id: string | null;
  };
}

class RealAuthService implements AuthService {
  async register(email: string, password: string, name: string): Promise<User | null> {
    try {
      // First, sign up the user with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${import.meta.env.VITE_APP_URL}/auth/callback`,
          data: {
            name,
            role: 'team_member', // Default role
            team_id: null
          }
        }
      });

      if (authError) {
        console.error('Registration error:', authError);
        toast.error('Registration failed. Please try again.');
        throw authError;
      }

      if (authData.user) {
        // Then, create the user profile in the users table
        const { data: userData, error: userError } = await supabase
          .from('users')
          .insert({
            id: authData.user.id,
            email: email.toLowerCase(),
            name,
            role: 'team_member', // Default role
            team_id: null,
            avatar: null
          })
          .select()
          .single();

        if (userError) {
          console.error('Error creating user profile:', userError);
          toast.error('Error creating user profile. Please try again.');
          throw userError;
        }

        const user: User = {
          id: userData.id,
          name: userData.name,
          email: userData.email,
          role: userData.role,
          teamId: userData.team_id,
          avatar: userData.avatar
        };

        // Send verification email using the admin client
        const { error: verificationError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
          email.toLowerCase(),
          {
            redirectTo: `${import.meta.env.VITE_APP_URL}/auth/callback`
          }
        );

        if (verificationError) {
          console.error('Error sending verification email:', verificationError);
          // Don't throw here, as the user was created successfully
        }

        toast.success('Registration successful! Please check your email to verify your account.');
        return user;
      }

      return null;
    } catch (error) {
      console.error('Registration error:', error);
      toast.error('Registration failed. Please try again.');
      throw error;
    }
  }

  async login(email: string, password: string): Promise<User | null> {
    try {
      console.log('Attempting login for:', email);
      
      // First, check if the user exists in the users table
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('email', email.toLowerCase())
        .single();

      if (userError || !userData) {
        console.error('User not found in database:', email);
        toast.error('User not found');
        return null;
      }

      console.log('User found in database, checking auth status...');

      // Try to sign in
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase(),
        password
      });

      if (signInError) {
        console.error('Sign in error:', signInError);
        
        // If the error is due to no password set or invalid credentials
        if (signInError.message.includes('Invalid login credentials')) {
          console.log('No password set or invalid credentials, checking if user exists...');
          
          // Check if the user exists in auth
          const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers();

          if (authError) {
            console.error('Error checking auth users:', authError);
            toast.error('Failed to verify user status. Please try again.');
            return null;
          }

          const existingAuthUser = authData.users.find((user: any) => user.email === email.toLowerCase());

          if (!existingAuthUser) {
            console.log('User not found in auth, creating new user...');
            // Create new user without password
            const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
              email: email.toLowerCase(),
              email_confirm: false,
              user_metadata: {
                name: userData.name,
                role: userData.role,
                team_id: userData.team_id
              }
            });

            if (createError) {
              console.error('Error creating auth user:', createError);
              toast.error('Failed to create user account. Please try again.');
              return null;
            }
          }

          // Don't automatically send an email here
          // Instead, inform the user they need to use the "resend verification" option
          toast.info('Please use the "Resend Verification Email" option to set up your password.');
          return null;
        }

        toast.error(signInError.message);
        return null;
      }

      if (!signInData.user) {
        console.error('No user data returned from sign in');
        toast.error('Authentication failed');
        return null;
      }

      // Check if email is verified
      if (!signInData.user.email_confirmed_at) {
        console.log('Email not verified, sending verification email...');
        const { error: verificationError } = await supabase.auth.resend({
          type: 'signup',
          email: email.toLowerCase(),
          options: {
            emailRedirectTo: `${import.meta.env.VITE_APP_URL}/auth/callback`
          }
        });

        if (verificationError) {
          console.error('Error sending verification email:', verificationError);
          toast.error('Failed to send verification email. Please try again.');
          return null;
        }

        toast.info('Please verify your email before logging in. Check your inbox for the verification link.');
        return null;
      }

      console.log('Login successful for:', email);
      toast.success(`Welcome back, ${userData.name}!`);

      return {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        role: userData.role,
        teamId: userData.team_id,
        avatar: userData.avatar
      };
    } catch (error) {
      console.error('Error in login:', error);
      toast.error('An unexpected error occurred');
      return null;
    }
  }

  async logout(): Promise<void> {
    try {
      await supabase.auth.signOut();
      toast.info('You have been logged out.');
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  }

  async getCurrentUser(): Promise<User | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return null;

      const { data: userData, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', user.email)
        .single();

      if (error) throw error;

      return {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        role: userData.role,
        teamId: userData.team_id,
        avatar: userData.avatar
      };
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }

  async resendVerificationEmail(email: string): Promise<void> {
    try {
      console.log('Resending verification email to:', email);
      
      // Check if the user exists in the users table
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('email', email.toLowerCase())
        .single();

      if (userError || !userData) {
        console.error('User not found in database:', email);
        toast.error('User not found. Please contact your administrator.');
        return;
      }

      // Check if the user has a password set up in Supabase Auth
      const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers();
      
      if (authError) {
        console.error('Error checking auth users:', authError);
        toast.error('Failed to check user authentication status. Please try again.');
        return;
      }
      
      const authUser = authUsers.users.find((user: any) => user.email === email.toLowerCase());
      
      if (!authUser) {
        // User exists in the database but not in Supabase Auth
        // This means they were created by an admin but don't have a password set up yet
        console.log('User exists in database but not in Supabase Auth. Sending invite email.');
        
        const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
          email.toLowerCase(),
          {
            redirectTo: `${import.meta.env.VITE_APP_URL}/auth/callback?type=recovery`
          }
        );
        
        if (inviteError) {
          console.error('Error sending invite email:', inviteError);
          toast.error('Failed to send invite email. Please try again.');
          return;
        }
        
        console.log('Invite email sent successfully');
        toast.success('An email has been sent to set up your account. Please check your inbox.');
        return;
      }
      
      // User exists in both database and Supabase Auth
      // Check if they have a password set up
      if (!authUser.confirmed_at) {
        // User exists but hasn't confirmed their email
        console.log('User exists but hasn\'t confirmed their email. Sending verification email.');
        
        const { error: resendError } = await supabase.auth.resend({
          type: 'signup',
          email: email.toLowerCase(),
          options: {
            emailRedirectTo: `${import.meta.env.VITE_APP_URL}/auth/callback?type=recovery`
          }
        });
        
        if (resendError) {
          console.error('Error sending verification email:', resendError);
          toast.error('Failed to send verification email. Please try again.');
          return;
        }
        
        console.log('Verification email sent successfully');
        toast.success('Verification email has been sent. Please check your inbox to verify your account.');
        return;
      }
      
      // User exists, is confirmed, but might need a password reset
      console.log('User exists and is confirmed. Sending password reset email.');
      
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.toLowerCase(),
        {
          redirectTo: `${import.meta.env.VITE_APP_URL}/auth/callback?type=recovery`
        }
      );
      
      if (resetError) {
        console.error('Error sending password reset email:', resetError);
        toast.error('Failed to send password reset email. Please try again.');
        return;
      }
      
      console.log('Password reset email sent successfully');
      toast.success('Password reset email has been sent. Please check your inbox to reset your password.');
    } catch (error) {
      console.error('Error resending verification email:', error);
      toast.error('Failed to resend verification email. Please try again.');
    }
  }
}

export const realAuthService = new RealAuthService(); 