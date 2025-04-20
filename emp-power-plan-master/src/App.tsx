import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/components/Auth/AuthContext";
import { DatabaseServiceProvider } from "@/services/DatabaseServiceContext";
import { useEffect, useState } from "react";
import { initializeDatabase } from "@/utils/initializeDatabase";
import LoginForm from '@/components/Auth/LoginForm';
import { RegisterForm } from '@/components/Auth/RegisterForm';
import { AuthCallback } from '@/components/AuthCallback';
import ResetPassword from '@/components/Auth/ResetPassword';
import PrivateRoute from '@/components/Auth/PrivateRoute';
import Dashboard from '@/components/Dashboard/Dashboard';
import TaskDetails from '@/components/Tasks/TaskDetails';
import UserPerformancePage from '@/components/Performance/UserPerformancePage';
import PerformancePage from '@/components/Performance/PerformancePage';
import AutomaticTasksPage from '@/components/AutomaticTasks/AutomaticTasksPage';
import NotificationDetails from '@/components/Notifications/NotificationDetails';
import CompletedTasksPage from '@/components/Tasks/CompletedTasksPage';
import LandingPage from '@/pages/LandingPage';

const queryClient = new QueryClient();

const App = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  
  useEffect(() => {
    const init = async () => {
      await initializeDatabase();
      setIsInitialized(true);
    };
    
    init();
  }, []);
  
  if (!isInitialized) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h2 className="text-xl font-medium">Initializing application...</h2>
        <p className="text-muted-foreground mt-2">Please wait while we connect to the database.</p>
      </div>
    </div>;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <DatabaseServiceProvider>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <Router>
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
                <Route path="/login" element={<LoginForm />} />
                <Route path="/register" element={<RegisterForm />} />
                <Route path="/auth/callback" element={<AuthCallback />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/performance" element={<PrivateRoute><PerformancePage /></PrivateRoute>} />
                <Route path="/performance/:userId" element={<PrivateRoute><UserPerformancePage /></PrivateRoute>} />
                <Route path="/automatic-tasks" element={<PrivateRoute><AutomaticTasksPage /></PrivateRoute>} />
                <Route path="/tasks/:taskId" element={<PrivateRoute><TaskDetails /></PrivateRoute>} />
                <Route path="/completed-tasks" element={<PrivateRoute><CompletedTasksPage /></PrivateRoute>} />
                <Route path="/notifications/:notificationId" element={<PrivateRoute><NotificationDetails /></PrivateRoute>} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </Router>
          </TooltipProvider>
        </AuthProvider>
      </DatabaseServiceProvider>
    </QueryClientProvider>
  );
};

export default App;
