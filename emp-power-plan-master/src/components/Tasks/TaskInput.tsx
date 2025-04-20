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
        console.log('Loading saved progress for task:', taskId);
        const savedProgress = await databaseService.getTaskProgress(taskId);
        console.log('Loaded saved progress:', savedProgress);
        
        if (savedProgress) {
          setInputText(savedProgress.currentText || '');
          setProgress(savedProgress.progressPercentage || 0);
          setLastSaved(savedProgress.lastUpdated);
        }
      } catch (error) {
        console.error('Error loading saved progress:', error);
        setError('Failed to load saved progress');
      }
    };

    if (user?.id && taskId) {
      loadSavedProgress();
    }
  }, [taskId, user?.id, databaseService]);

  // Calculate progress based on text length and content
  const calculateProgress = (text: string): number => {
    if (!text.trim()) return 0;
    
    // Basic progress calculation based on text length
    const minLength = 100; // Minimum expected length
    const maxLength = 1000; // Maximum expected length for 100%
    
    // Calculate base progress from length
    let lengthProgress = Math.min((text.length / maxLength) * 100, 100);
    
    // Additional factors
    const hasParagraphs = text.includes('\n\n');
    const hasProperSentences = text.match(/[.!?]\s/g)?.length > 3;
    const hasGoodLength = text.length > minLength;
    
    // Bonus progress for good structure
    if (hasParagraphs) lengthProgress += 5;
    if (hasProperSentences) lengthProgress += 5;
    if (hasGoodLength) lengthProgress += 5;
    
    // Cap at 100%
    return Math.min(Math.round(lengthProgress), 100);
  };

  // Debounced function to save progress
  const saveProgressDebounced = useCallback(
    debounce(async (text: string) => {
      if (!user?.id || !taskId) return;

      try {
        setIsSaving(true);
        const calculatedProgress = calculateProgress(text);
        console.log('Saving progress:', { taskId, progress: calculatedProgress });
        
        await databaseService.saveTaskProgress(taskId, text, calculatedProgress);
        setProgress(calculatedProgress);
        setLastSaved(new Date());
        setError(null);

        // If progress is 100%, show completion message
        if (calculatedProgress === 100) {
          toast.success('Task completed successfully!');
        }
      } catch (error) {
        console.error('Error saving progress:', error);
        setError('Failed to save progress');
        toast.error('Failed to save progress');
      } finally {
        setIsSaving(false);
      }
    }, 1000),
    [taskId, user?.id, databaseService]
  );

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setInputText(newText);
    
    // Update progress immediately in UI
    const newProgress = calculateProgress(newText);
    setProgress(newProgress);
    
    // Save to database with debounce
    saveProgressDebounced(newText);
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>{taskTitle}</CardTitle>
        <CardDescription>{taskDescription}</CardDescription>
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