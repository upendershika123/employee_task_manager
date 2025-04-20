import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, AuthContextType } from '../../types';
import { realAuthService } from '../../services/realAuthService';
import { supabase } from '@/integrations/supabase/client';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      try {
        // First check if there's a session in localStorage
        const storedSession = localStorage.getItem('supabase.auth.token');
        if (storedSession) {
          const session = JSON.parse(storedSession);
          if (session?.user) {
            const currentUser = await realAuthService.getCurrentUser();
            setUser(currentUser);
            return;
          }
        }

        // If no stored session, try to get current user
        const currentUser = await realAuthService.getCurrentUser();
        setUser(currentUser);
      } catch (error) {
        console.error('Error loading user:', error);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadUser();

    // Set up auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        const currentUser = await realAuthService.getCurrentUser();
        setUser(currentUser);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const loggedInUser = await realAuthService.login(email, password);
      setUser(loggedInUser);
    } catch (error) {
      // Error handling is done in the service
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    await realAuthService.logout();
    setUser(null);
  };

  const value = {
    user,
    login,
    logout,
    isAuthenticated: !!user,
    isLoading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
