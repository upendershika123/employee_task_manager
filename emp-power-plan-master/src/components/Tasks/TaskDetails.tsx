import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { TaskProgress } from '@/types';
import { Task } from '@/types/task';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ChevronLeft, CheckCircle, Save, Loader2, Check, X, AlertCircle } from 'lucide-react';
import { useDatabaseService } from '@/services/DatabaseServiceContext';
import { progressService } from '@/services/progressService';
import { useAuth } from '@/components/Auth/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { sendGridService } from '@/services/sendGridService';
import { toast } from 'sonner';
import debounce from 'lodash/debounce';
import { notificationService } from '@/services/notificationService';

// Add new notification types
type NotificationType = 
  | 'task_assigned' 
  | 'task_updated' 
  | 'task_completed'
  | 'task_review_accepted'
  | 'task_review_rejected'
  | 'task_review_needs_improvement';

const TaskDetails: React.FC = () => {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const databaseService = useDatabaseService();
  const { user } = useAuth();
  const [task, setTask] = useState<Task | null>(null);
  const [userText, setUserText] = useState('');
  const [progress, setProgress] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [isReviewer, setIsReviewer] = useState(false);

  // Load task and existing progress
  useEffect(() => {
    const loadTaskAndProgress = async () => {
      if (!taskId || !user) return;
      try {
        setIsLoading(true);
        
        // First, load the task
        const taskData = await databaseService.getTaskById(taskId);
        
        // Check access permissions
        const isAssignedUser = taskData.assigned_to === user.id;
        const isReviewer = (user.role === 'admin' || user.role === 'team_lead');
        const isCompleted = taskData.status === 'completed';
        
        // Only allow access if:
        // 1. User is the assigned user, or
        // 2. Task is completed and user is a reviewer (team lead/admin)
        if (!isAssignedUser && !(isCompleted && isReviewer)) {
          toast.error('You are not authorized to access this task');
          navigate('/');
          return;
        }
        
        setTask(taskData);
        setIsReadOnly(!isAssignedUser || isCompleted);
        setIsReviewer(isReviewer);

        // Then try to load saved progress from task_input_history
        try {
          const { data, error } = await supabase
            .from('task_input_history')
            .select('*')
            .eq('task_id', taskId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          if (error) {
            console.log('No previous progress found for this task');
            return;
          }

          if (data) {
            setUserText(data.input_text || '');
            setProgress(data.progress || 0);
            console.log('Loaded saved progress:', data);
          }
        } catch (progressError) {
          console.log('No previous progress found for this task');
        }
      } catch (error) {
        console.error('Error loading task:', error);
        toast.error('Failed to load task details');
        setProgress(0);
        setUserText('');
      } finally {
        setIsLoading(false);
      }
    };

    loadTaskAndProgress();
  }, [taskId, databaseService, user, navigate]);

  // Auto-save on window unload if there are unsaved changes
  useEffect(() => {
    const handleBeforeUnload = async (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges && taskId) {
        try {
          const { error } = await supabase
            .from('task_input_history')
            .upsert({
              task_id: taskId,
              input_text: userText,
              progress: Math.round(progress), // Round to nearest integer
              created_at: new Date().toISOString()
            });

          if (error) throw error;
        } catch (error) {
          console.error('Error auto-saving progress:', error);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges, taskId, userText, progress]);

  // Calculate progress
  const calculateProgress = useCallback((text: string) => {
    const progressPercentage = progressService.compareText(text);
    setProgress(progressPercentage);
    return progressPercentage;
  }, []);

  const updateTaskStatus = async (newStatus: 'pending' | 'in_progress' | 'completed') => {
    if (!taskId || !user) return;

    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status: newStatus })
        .eq('id', taskId);

      if (error) throw error;

      // Update local task state
      setTask(prev => prev ? { ...prev, status: newStatus } : null);
    } catch (error) {
      console.error('Error updating task status:', error);
      toast.error('Failed to update task status');
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setUserText(newText);
    
    // Always recalculate progress on text change
    calculateProgress(newText);
    setHasUnsavedChanges(true);
  };

  const handleSaveProgress = async () => {
    if (!taskId || !user) return;

    try {
      setIsSaving(true);
      
      const currentProgress = calculateProgress(userText); // Recalculate before saving
      
      const { error } = await supabase
        .from('task_input_history')
        .upsert({
          task_id: taskId,
          input_text: userText,
          progress: Math.round(currentProgress),
          created_at: new Date().toISOString()
        });

      if (error) throw error;

      setHasUnsavedChanges(false);
      toast.success('Progress saved successfully');
      
      // Update task status based on current progress
      if (currentProgress < 100 && task?.status === 'completed') {
        await updateTaskStatus('in_progress');
      }
    } catch (error) {
      console.error('Error saving progress:', error);
      toast.error('Failed to save progress');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmitTask = async () => {
    if (!task || !user || !taskId) {
      toast.error('Missing task or user information');
      return;
    }

    try {
      setIsSubmitting(true);

      // 1. Save current progress
      await handleSaveProgress();

      // 2. Update task status
      const { error: updateError } = await supabase
        .from('tasks')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          review_status: 'pending'
        })
        .eq('id', taskId);

      if (updateError) {
        toast.error('Failed to update task status');
        throw updateError;
      }

      // 3. Get team lead information
      const { data: teamLead, error: teamLeadError } = await supabase
        .from('users')
        .select('*')
        .eq('team_id', task.team_id)
        .eq('role', 'team_lead')
        .single();

      if (teamLeadError) {
        console.error('Error finding team lead:', teamLeadError);
        toast.warning('Task completed but could not notify team lead');
        return;
      }

      if (teamLead) {
        // 4. Create notification
        const { error: notificationError } = await supabase
          .from('notifications')
          .insert({
            user_id: teamLead.id,
            title: 'Task Completed',
            message: `Task "${task.title}" has been completed by ${user.name} and is ready for review.`,
            type: 'task_completed',
            task_id: taskId,
            created_at: new Date().toISOString()
          });

        if (notificationError) {
          console.error('Error creating notification:', notificationError);
          toast.warning('Task completed but notification failed');
        }

        // 5. Send email notification
        try {
          await sendGridService.sendTaskCompletionEmail(task, user, teamLead);
        } catch (emailError) {
          console.error('Error sending email:', emailError);
          toast.warning('Task completed but email notification failed');
        }
      }

      // 6. Update local state
      setTask(prev => {
        if (!prev) return null;
        return {
          ...prev,
          status: 'completed',
          completed_at: new Date(),
          review_status: 'pending'
        };
      });
      setIsReadOnly(true);

      toast.success('Task submitted successfully');
      navigate('/dashboard');

    } catch (error) {
      console.error('Error submitting task:', error);
      toast.error('Failed to submit task');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    if (hasUnsavedChanges) {
      const shouldSave = window.confirm('You have unsaved changes. Would you like to save before leaving?');
      if (shouldSave) {
        handleSaveProgress().then(() => navigate('/'));
        return;
      }
    }
    navigate('/');
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-gray-100 text-gray-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleReviewAction = async (action: 'accept' | 'reject' | 'needs_improvement') => {
    try {
      if (!task) return;

      // Get the work done text from task_input_history
      const { data: taskInput, error: taskInputError } = await supabase
        .from('task_input_history')
        .select('input_text')
        .eq('task_id', task.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (taskInputError) {
        throw new Error('Failed to get task input history');
      }

      if (action === 'accept') {
        // Insert into completed_tasks
        const { error: completedTaskError } = await supabase
          .from('completed_tasks')
          .insert({
            task_id: task.id,
            title: task.title,
            description: task.description,
            assigned_to: task.assigned_to,
            assigned_by: task.assigned_by,
            team_id: task.team_id,
            priority: task.priority,
            status: 'completed',
            due_date: task.due_date,
            completed_at: new Date().toISOString(),
            accepted_at: new Date().toISOString(),
            accepted_by: user?.id,
            work_done: taskInput?.input_text || '',
            created_at: task.created_at,
            updated_at: new Date().toISOString()
          });

        if (completedTaskError) {
          throw new Error('Failed to move task to completed tasks');
        }

        // Create notification
        const { error: notificationError } = await supabase
          .from('notifications')
          .insert({
            user_id: task.assigned_to,
            title: 'Task Accepted',
            message: `Your task "${task.title}" has been accepted.`,
            type: 'task_review_accepted',
            task_id: task.id,
            created_at: new Date().toISOString(),
            read: false
          });

        if (notificationError) {
          throw new Error('Failed to create notification');
        }

        // Delete from tasks
        const { error: deleteError } = await supabase
          .from('tasks')
          .delete()
          .eq('id', task.id);

        if (deleteError) {
          throw new Error('Failed to delete task');
        }
      } else {
        // For reject or needs improvement, update the review_status
        const { error: updateError } = await supabase
          .from('tasks')
          .update({
            review_status: action === 'reject' ? 'rejected' : 'needs_improvement',
            status: 'in_progress', // Allow editing by setting back to in_progress
            updated_at: new Date().toISOString()
          })
          .eq('id', task.id);

        if (updateError) {
          throw new Error('Failed to update task status');
        }

        // Create notification
        const { error: notificationError } = await supabase
          .from('notifications')
          .insert({
            user_id: task.assigned_to,
            title: action === 'reject' ? 'Task Rejected' : 'Task Needs Improvement',
            message: `Your task "${task.title}" has been ${action === 'reject' ? 'rejected' : 'marked as needing improvement'}.`,
            type: action === 'reject' ? 'task_review_rejected' : 'task_review_needs_improvement',
            task_id: task.id,
            created_at: new Date().toISOString(),
            read: false
          });

        if (notificationError) {
          throw new Error('Failed to create notification');
        }
      }

      toast.success(action === 'accept' ? 'Task accepted successfully' : 
                  action === 'reject' ? 'Task rejected' : 
                  'Task marked as needing improvement');
      navigate('/dashboard');
    } catch (error) {
      console.error('Error reviewing task:', error);
      toast.error('Failed to review task');
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-4">
        <Button variant="ghost" onClick={handleBack} className="mb-4">
          <ChevronLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading task details...</span>
        </div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="container mx-auto p-4">
        <Button variant="ghost" onClick={handleBack} className="mb-4">
          <ChevronLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>
        <div>Task not found</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <Button variant="ghost" onClick={handleBack} className="mb-4">
        <ChevronLeft className="h-4 w-4 mr-2" />
        Back to Dashboard
      </Button>

      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between mb-2">
            <CardTitle className="text-2xl font-bold">{task.title}</CardTitle>
            <div className="flex gap-2">
              <Badge className={getPriorityColor(task.priority)}>
                {task.priority}
              </Badge>
              <Badge className={getStatusColor(task.status)}>
                {task.status}
              </Badge>
            </div>
          </div>
          {task.due_date && (
            <p className="text-sm text-muted-foreground">
              Due date: {new Date(task.due_date).toLocaleDateString()}
            </p>
          )}
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">Description</h3>
              <CardDescription>
                {task.description || 'No description provided'}
              </CardDescription>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold">Task Progress</h3>
                <span className="text-sm text-muted-foreground">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="mb-4" />
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-2">Work Done</h3>
              <Textarea
                placeholder="Start typing to track your progress..."
                value={userText}
                onChange={handleTextChange}
                className="min-h-[200px] mb-4"
                readOnly={isReadOnly}
              />
              
              {!isReadOnly && (
                <div className="flex justify-end gap-4">
                  <Button
                    onClick={handleSaveProgress}
                    disabled={isSaving || !hasUnsavedChanges}
                    variant="outline"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save Progress
                      </>
                    )}
                  </Button>

                  {progress >= 100 && task?.status !== 'completed' && (
                    <Button
                      onClick={handleSubmitTask}
                      disabled={isSubmitting || hasUnsavedChanges}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Submit Completed Task
                        </>
                      )}
                    </Button>
                  )}
                </div>
              )}

              {isReviewer && task.status === 'completed' && (
                <div className="flex justify-end gap-4 mt-4">
                  <Button
                    onClick={() => handleReviewAction('accept')}
                    disabled={isSubmitting}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Accept
                  </Button>
                  <Button
                    onClick={() => handleReviewAction('needs_improvement')}
                    disabled={isSubmitting}
                    className="bg-yellow-600 hover:bg-yellow-700"
                  >
                    <AlertCircle className="h-4 w-4 mr-2" />
                    Needs Improvement
                  </Button>
                  <Button
                    onClick={() => handleReviewAction('reject')}
                    disabled={isSubmitting}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TaskDetails; 