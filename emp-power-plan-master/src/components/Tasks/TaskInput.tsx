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
  const [error, setError] = useState<string | null>(null);
  const databaseService = useDatabaseService();

  // Load saved progress when component mounts
  useEffect(() => {
    let mounted = true;

    const loadSavedProgress = async () => {
      if (!user?.id || !taskId) return;

      try {
        console.log('Loading saved progress for task:', taskId, 'user:', user.id);
        const savedProgress = await databaseService.getTaskProgress(taskId);
        console.log('Loaded saved progress:', savedProgress);
        
        if (mounted && savedProgress) {
          setInputText(savedProgress.currentText || '');
          setProgress(savedProgress.progressPercentage || 0);
          setLastSaved(savedProgress.lastUpdated);
          console.log('Updated state with saved progress');
        }
      } catch (error) {
        console.error('Error loading saved progress:', error);
        if (mounted) {
          setError('Failed to load saved progress');
          toast.error('Failed to load saved progress');
        }
      }
    };

    loadSavedProgress();
    return () => { mounted = false; };
  }, [taskId, user?.id, databaseService]);

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

  // Save progress with debounce
  const saveProgressDebounced = useCallback(
    debounce(async (text: string, currentProgress: number) => {
      if (!user?.id || !taskId) return;

      try {
        setIsSaving(true);
        console.log('Saving progress:', { taskId, text: text.substring(0, 50) + '...', progress: currentProgress });
        
        await databaseService.saveTaskProgress(taskId, text, currentProgress);
        setLastSaved(new Date());
        setError(null);

        if (currentProgress === 100) {
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
              <p>Saving...</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default TaskInput; 