import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const databaseService = useDatabaseService();
  const maxRetries = 3;
  const retryDelay = 2000; // 2 seconds
  const progressRef = useRef({ text: '', progress: 0 });

  // Load saved progress when component mounts
  useEffect(() => {
    let mounted = true;
    let retryAttempt = 0;

    const loadSavedProgress = async () => {
      if (!user?.id || !taskId) return;

      try {
        console.log('Loading saved progress for task:', taskId, 'user:', user.id);
        const savedProgress = await databaseService.getTaskProgress(taskId);
        console.log('Loaded saved progress:', savedProgress);
        
        if (mounted && savedProgress) {
          const savedText = savedProgress.currentText || '';
          const savedProgress = savedProgress.progressPercentage || 0;
          
          setInputText(savedText);
          setProgress(savedProgress);
          setLastSaved(savedProgress.lastUpdated);
          
          // Keep a reference for recovery
          progressRef.current = { text: savedText, progress: savedProgress };
          
          console.log('Updated state with saved progress');
        }
      } catch (error) {
        console.error('Error loading saved progress:', error);
        if (mounted) {
          setError('Failed to load saved progress');
          toast.error('Failed to load saved progress');
          
          // Retry loading if we haven't exceeded max attempts
          if (retryAttempt < maxRetries) {
            retryAttempt++;
            setTimeout(loadSavedProgress, retryDelay);
          }
        }
      }
    };

    loadSavedProgress();
    return () => { mounted = false; };
  }, [taskId, user?.id, databaseService]);

  // Save progress with debounce and retry logic
  const saveProgressDebounced = useCallback(
    debounce(async (text: string, currentProgress: number) => {
      if (!user?.id || !taskId) return;

      const attemptSave = async (attempt: number = 0) => {
        try {
          setIsSaving(true);
          console.log('Saving progress:', { 
            taskId, 
            text: text.substring(0, 50) + '...', 
            progress: currentProgress,
            attempt: attempt + 1 
          });
          
          await databaseService.saveTaskProgress(taskId, text, currentProgress);
          setLastSaved(new Date());
          setError(null);
          setRetryCount(0);
          
          // Update our reference after successful save
          progressRef.current = { text, progress: currentProgress };

          if (currentProgress === 100) {
            toast.success('Task completed successfully!');
          }
        } catch (error) {
          console.error('Error saving progress:', error);
          
          if (attempt < maxRetries) {
            setRetryCount(attempt + 1);
            // Exponential backoff
            const delay = retryDelay * Math.pow(2, attempt);
            setTimeout(() => attemptSave(attempt + 1), delay);
          } else {
            setError('Failed to save progress after multiple attempts');
            toast.error('Failed to save progress');
            // Revert to last known good state if save fails
            setInputText(progressRef.current.text);
            setProgress(progressRef.current.progress);
          }
        } finally {
          setIsSaving(false);
        }
      };

      attemptSave();
    }, 2000), // Increased debounce time for better network handling
    [taskId, user?.id, databaseService]
  );

  // Calculate progress based on text length and content
  const calculateProgress = useCallback((text: string): number => {
    if (!text || !text.trim()) return 0;
    
    // Basic progress calculation based on text length
    const minLength = 50; // Minimum expected length
    const maxLength = 500; // Maximum expected length for 100%
    
    // Calculate base progress from length
    let lengthProgress = Math.min((text.length / maxLength) * 100, 100);
    
    // Additional factors
    const paragraphs = text.split('\n\n').filter(p => p.trim().length > 0);
    const sentences = text.match(/[.!?]+\s+/g) || [];
    
    // Bonus progress for structure and content
    const hasParagraphs = paragraphs.length >= 2;
    const hasProperSentences = sentences.length >= 3;
    const hasGoodLength = text.length >= minLength;
    
    // Add bonuses
    if (hasParagraphs) lengthProgress += 10;
    if (hasProperSentences) lengthProgress += 10;
    if (hasGoodLength) lengthProgress += 10;
    
    // Cap at 100% and round to nearest integer
    return Math.min(Math.round(lengthProgress), 100);
  }, []);

  // Handle input changes with optimistic updates
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setInputText(newText);
    
    // Calculate and update progress
    const newProgress = calculateProgress(newText);
    console.log('Calculated progress:', newProgress, 'for text length:', newText.length);
    setProgress(newProgress);
    
    // Save to database
    saveProgressDebounced(newText, newProgress);
  }, [calculateProgress, saveProgressDebounced]);

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
              {retryCount > 0 && (
                <span className="text-sm">Retry attempt {retryCount}/{maxRetries}</span>
              )}
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
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="w-full" />
          </div>
          <div className="text-sm text-muted-foreground space-y-1">
            {lastSaved && (
              <p>Last saved: {lastSaved.toLocaleTimeString()}</p>
            )}
            {isSaving && (
              <p>Saving{retryCount > 0 ? ` (Retry ${retryCount}/${maxRetries})` : '...'}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default TaskInput; 