import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../Auth/AuthContext';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import debounce from 'lodash/debounce';
import { TaskProgress } from '@/types';

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

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setInputText(newText);
    checkProgress(newText);
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>{taskTitle}</CardTitle>
        <CardDescription>{taskDescription}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
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