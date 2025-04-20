import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../Auth/AuthContext';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import debounce from 'lodash/debounce';
import { TaskProgress } from '@/types';
import { AlertCircle } from 'lucide-react';
import { useDatabaseService } from '@/services/DatabaseService';

interface TaskInputProps {
  taskId: string;
  taskTitle: string;
  taskDescription: string;
}

const TaskInput: React.FC<TaskInputProps> = ({ taskId, taskTitle, taskDescription }) => {
  const { user } = useAuth();
  const [inputText, setInputText] = useState('');
  const [progress, setProgress] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isConnected, setIsConnected] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const databaseService = useDatabaseService();

  // Load saved progress when component mounts
  useEffect(() => {
    const loadSavedProgress = async () => {
      try {
        const response = await fetch(`/api/tasks/${taskId}/progress?userId=${user?.id}`);
        if (response.ok) {
          const data: TaskProgress = await response.json();
          setInputText(data.currentText || '');
          setProgress(data.progress || 0);
          setLastSaved(data.lastSaved ? new Date(data.lastSaved) : null);
        }
      } catch (error) {
        console.error('Error loading saved progress:', error);
      }
    };

    if (user?.id) {
      loadSavedProgress();
    }
  }, [taskId, user?.id]);

  // Check connection status periodically
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const connected = await databaseService.testConnection();
        setIsConnected(connected);
        if (!connected) {
          setError('Lost connection to server. Progress may not be saved.');
        } else {
          setError(null);
        }
      } catch (err) {
        setIsConnected(false);
        setError('Error checking server connection.');
      }
    };

    const interval = setInterval(checkConnection, 30000); // Check every 30 seconds
    checkConnection(); // Initial check

    return () => clearInterval(interval);
  }, [databaseService]);

  // Debounced function to check progress
  const checkProgress = useCallback(
    debounce(async (text: string) => {
      if (!user?.id) return;

      try {
        setIsSaving(true);
        const response = await fetch('/api/tasks/check-progress', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            taskId,
            userId: user.id,
            text,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          setProgress(data.progress);
          setLastSaved(new Date());

          // If progress is 100%, mark task as completed
          if (data.progress === 100) {
            toast.success('Task completed successfully!');
            // You can add additional completion logic here
          }
        }
      } catch (error) {
        console.error('Error checking progress:', error);
        toast.error('Failed to save progress');
      } finally {
        setIsSaving(false);
      }
    }, 500),
    [taskId, user?.id]
  );

  const saveProgress = useCallback(async (text: string, progress: number) => {
    try {
      await databaseService.saveTaskProgress(taskId, text, progress);
      setError(null);
    } catch (err) {
      console.error('Error saving progress:', err);
      setError('Failed to save progress. Please try again.');
    }
  }, [taskId, databaseService]);

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setInputText(newText);
    checkProgress(newText);
  };

  // Add this function
  const testSupabaseConnection = async () => {
    try {
      const { data, error } = await databaseService.testConnection();
      console.log('Supabase Connection Test:', {
        success: !error,
        url: window.location.origin,
        timestamp: new Date().toISOString(),
        error: error || 'None'
      });
      
      if (!error) {
        toast.success('Successfully connected to Supabase!');
      } else {
        toast.error('Failed to connect to Supabase');
      }
    } catch (err) {
      console.error('Connection test failed:', err);
      toast.error('Connection test failed');
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>{taskTitle}</CardTitle>
        <CardDescription>{taskDescription}</CardDescription>
        {/* Add this button */}
        <Button 
          onClick={testSupabaseConnection}
          variant="outline"
          size="sm"
          className="mt-2"
        >
          Test Connection
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 text-red-500 bg-red-50 p-2 rounded-md">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}
          {!isConnected && (
            <div className="flex items-center gap-2 text-yellow-500 bg-yellow-50 p-2 rounded-md">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">Offline mode - progress will be saved when connection is restored</span>
            </div>
          )}
          <Textarea
            placeholder="Start typing here..."
            value={inputText}
            onChange={handleInputChange}
            className="min-h-[200px] font-mono"
          />
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Progress</span>
              <span>{progress.toFixed(1)}%</span>
            </div>
            <Progress value={progress} className="w-full" />
          </div>
          {lastSaved && (
            <p className="text-sm text-muted-foreground">
              Last saved: {lastSaved.toLocaleTimeString()}
            </p>
          )}
          {isSaving && (
            <p className="text-sm text-muted-foreground">Saving...</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default TaskInput; 