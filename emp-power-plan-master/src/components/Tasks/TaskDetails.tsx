import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Task, TaskProgress } from '@/types';
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
import { format } from 'date-fns';

// Add new notification types
type NotificationType = 
  | 'task_assigned' 
  | 'task_updated' 
  | 'task_completed'
  | 'task_review_accepted'
  | 'task_review_rejected'
  | 'task_review_needs_improvement';

interface CompletedTask extends Task {
  status: 'completed';
  review_status: 'accepted';
  accepted_at: string;
  accepted_by: string;
}

const TaskDetails: React.FC<{}> = () => {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const databaseService = useDatabaseService();
  const { user } = useAuth();
  const [task, setTask] = useState<Task | CompletedTask | null>(null);
  const [userText, setUserText] = useState('');
  const [progress, setProgress] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [isReviewer, setIsReviewer] = useState(false);
  const [reviewerName, setReviewerName] = useState<string>('');

  // Load task and existing progress
  useEffect(() => {
    const loadTaskAndProgress = async () => {
      if (!taskId || !user) return;
      try {
        setIsLoading(true);
        
        // First, try to load from completed_tasks
        const { data: completedTask, error: completedTaskError } = await supabase
          .from('completed_tasks')
          .select('*')
          .eq('task_id', taskId)
          .order('accepted_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (completedTaskError) {
          console.error('Error loading completed task:', completedTaskError);
          toast.error('Failed to load task details');
          return;
        }

        let taskData: Task | CompletedTask | null = null;

        if (completedTask) {
          // Task is in completed_tasks table
          taskData = {
            id: completedTask.task_id,
            title: completedTask.title,
            description: completedTask.description,
            assigned_to: completedTask.assigned_to,
            assigned_by: completedTask.assigned_by,
            team_id: completedTask.team_id,
            priority: completedTask.priority,
            status: 'completed' as const,
            review_status: 'accepted' as const,
            due_date: completedTask.due_date,
            created_at: completedTask.created_at,
            updated_at: completedTask.updated_at,
            completed_at: completedTask.completed_at,
            accepted_at: completedTask.accepted_at,
            accepted_by: completedTask.accepted_by
          } as CompletedTask;
        } else {
          // Try to load from tasks table
          taskData = await databaseService.getTaskById(taskId);
        }
        
        // Check if task exists in either table
        if (!taskData) {
          toast.error('Task not found');
          navigate('/');
          return;
        }
        
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
        
        // If the user is assigned to this task and it's in pending status, update it to in_progress
        if (isAssignedUser && taskData.status === 'pending' && !('accepted_at' in taskData)) {
          try {
            const { error: updateError } = await supabase
              .from('tasks')
              .update({ 
                status: 'in_progress',
                updated_at: new Date().toISOString()
              })
              .eq('id', taskData.id);

            if (updateError) {
              console.error('Error updating task status:', updateError);
              toast.error('Failed to update task status');
            } else {
              // Update the local task data with proper type handling
              const updatedTask: Task = {
                ...taskData as Task,
                status: 'in_progress',
                review_status: 'pending',
                updated_at: new Date().toISOString()
              };
              
              // Create notification for task status update
              await notificationService.createNotification({
                userId: taskData.assigned_by,
                title: 'Task Status Updated',
                message: `Task "${taskData.title}" has been started by ${user.name}.`,
                type: 'task_updated'
              });

              // Update the task data in state
              setTask(updatedTask);
            }
          } catch (error) {
            console.error('Error updating task status:', error);
          }
        } else {
        setTask(taskData);
        }
        
        setIsReadOnly(!isAssignedUser || isCompleted);
        setIsReviewer(isReviewer);

        // If task is completed, load reviewer information
        if (isCompleted && 'accepted_by' in taskData) {
          try {
            const { data: reviewer, error: reviewerError } = await supabase
              .from('users')
              .select('name')
              .eq('id', taskData.accepted_by)
              .maybeSingle();

            if (reviewerError) {
              console.error('Error loading reviewer:', reviewerError);
              return;
            }

            if (reviewer) {
              setReviewerName(reviewer.name);
            }
          } catch (error) {
            console.error('Error loading reviewer information:', error);
          }
        }

        // Then try to load saved progress from task_input_history
        try {
          const { data, error } = await supabase
            .from('task_input_history')
            .select('*')
            .eq('task_id', taskId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

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
      if (task) {
        const updatedTask: Task = {
          ...task as Task,
          status: newStatus,
          updated_at: new Date().toISOString()
        };
        setTask(updatedTask);
      }
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
    if (!taskId || !user || !task) return;

    try {
      setIsSubmitting(true);
      
      // Update task status to completed
      const updatedTask: Task = {
        ...task as Task,
        status: 'completed',
        review_status: 'pending',
        completed_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('tasks')
        .update(updatedTask)
        .eq('id', taskId);

      if (error) throw error;

      // Update local task state
      setTask(updatedTask);
      
      // Create notification for task completion
        await notificationService.createNotification({
        userId: task.assigned_by,
        title: 'Task Completed',
          message: `Task "${task.title}" has been completed and is ready for review.`,
        type: 'task_completed',
        taskId: taskId
      });

      // Send email notification
      try {
        const assignedByUser = await databaseService.getUserById(task.assigned_by);
        const completedByUser = await databaseService.getUserById(task.assigned_to);

        if (assignedByUser && completedByUser) {
          await sendGridService.sendTaskCompletionEmail(
            task,
            completedByUser,
            assignedByUser
          );
        }
      } catch (emailError) {
        console.error('Error sending task completion email:', emailError);
        // Don't throw the error as the task update was successful
      }
      
      toast.success('Task submitted for review');
      navigate('/');
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
      setIsSubmitting(true);

      if (action === 'accept') {
        // For accept, move to completed_tasks table
        const { error: insertError } = await supabase
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
            accepted_by: user.id,
            work_done: task.work_done || '',
            created_at: task.created_at,
            updated_at: new Date().toISOString()
          });

        if (insertError) {
          console.error('Error inserting completed task:', insertError);
          toast.error('Failed to accept task');
          return;
        }

        // Delete from tasks table
        const { error: deleteError } = await supabase
          .from('tasks')
          .delete()
          .eq('id', task.id);

        if (deleteError) {
          console.error('Error deleting task:', deleteError);
          toast.error('Failed to delete task');
          return;
        }

        // Send acceptance notification
        try {
          const assignedUser = await databaseService.getUserById(task.assigned_to);
          if (assignedUser) {
            await notificationService.sendTaskReviewNotification(
              task,
              'accepted',
              user,
              assignedUser
            );
          }
        } catch (notificationError) {
          console.error('Error sending acceptance notification:', notificationError);
          // Don't throw the error as the task acceptance was successful
        }

        toast.success('Task accepted successfully');
        navigate('/dashboard');
      } else {
        // For reject or needs improvement, update the task status
        const { error: updateError } = await supabase
          .from('tasks')
          .update({
            status: 'in_progress',
            review_status: action === 'reject' ? 'rejected' : 'needs_improvement',
            updated_at: new Date().toISOString()
          })
          .eq('id', task.id);

        if (updateError) {
          console.error('Error updating task:', updateError);
          toast.error('Failed to update task status');
          return;
        }

        // Send rejection or needs improvement notification
        try {
          const assignedUser = await databaseService.getUserById(task.assigned_to);
          if (assignedUser) {
            await notificationService.sendTaskReviewNotification(
              task,
              action === 'reject' ? 'rejected' : 'needs_improvement',
              user,
              assignedUser
            );
          }
        } catch (notificationError) {
          console.error('Error sending review notification:', notificationError);
          // Don't throw the error as the task update was successful
        }

        toast.success(action === 'reject' ? 'Task rejected' : 'Task marked as needing improvement');
        navigate('/dashboard');
      }
    } catch (error) {
      console.error('Error reviewing task:', error);
      toast.error('Failed to review task');
    } finally {
      setIsSubmitting(false);
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
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" onClick={handleBack} className="gap-2">
          <ChevronLeft className="h-4 w-4" />
          Back
      </Button>
        {task?.status === 'completed' && (
          <Badge className="bg-green-100 text-green-800">
            <CheckCircle className="h-4 w-4 mr-1" />
            Completed
          </Badge>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span className="ml-2">Loading task details...</span>
        </div>
      ) : task ? (
        <div className="space-y-6">
          <Card>
        <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{task.title}</span>
              <Badge className={getPriorityColor(task.priority)}>
                {task.priority}
              </Badge>
              </CardTitle>
              <CardDescription>{task.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
              <Badge className={getStatusColor(task.status)}>
                {task.status}
              </Badge>
                  {task.status === 'completed' && reviewerName && (
                    <span className="text-sm text-muted-foreground">
                      Accepted by {reviewerName}
                    </span>
                  )}
            </div>
                {task.due_date && (
                  <p className="text-sm text-muted-foreground">
                    Due: {format(new Date(task.due_date), 'PPP')}
                  </p>
                )}
                {task.completed_at && (
            <p className="text-sm text-muted-foreground">
                    Completed: {format(new Date(task.completed_at), 'PPP')}
            </p>
          )}
            </div>
            </CardContent>
          </Card>

          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between mb-2">
                <CardTitle className="text-2xl font-bold">Task Progress</CardTitle>
                <span className="text-sm text-muted-foreground">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="mb-4" />
            </CardHeader>
            <CardContent>
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
        </CardContent>
      </Card>
        </div>
      ) : null}
    </div>
  );
};

export default TaskDetails; 