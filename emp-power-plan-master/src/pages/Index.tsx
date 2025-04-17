
import React from 'react';
import { useAuth } from '../components/Auth/AuthContext';
import LoginForm from '../components/Auth/LoginForm';
import Dashboard from '../components/Dashboard/Dashboard';

const Index = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-center">
          <p className="text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {isAuthenticated ? (
        <Dashboard />
      ) : (
        <div className="min-h-screen flex items-center justify-center p-4">
          <LoginForm />
        </div>
      )}
    </div>
  );
};

export default Index;
