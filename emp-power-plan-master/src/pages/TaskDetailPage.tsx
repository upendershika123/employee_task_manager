import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import TaskInput from '@/components/Tasks/TaskInput';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { AutomaticTask } from '@/types';
import { useAuth } from '@/components/Auth/AuthContext';

const TaskDetailPage: React.FC = () => {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [task, setTask] = useState<AutomaticTask | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTask = async () => {
      try {
        const response = await fetch(`/api/tasks/${taskId}`);
        if (response.ok) {
          const data = await response.json();
          setTask(data);
        } else {
          toast.error('Failed to load task');
          navigate('/dashboard');
        }
      } catch (error) {
        console.error('Error fetching task:', error);
        toast.error('Failed to load task');
        navigate('/dashboard');
      } finally {
        setIsLoading(false);
      }
    };

    if (taskId) {
      fetchTask();
    }
  }, [taskId, navigate]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-medium">Loading task...</h2>
        </div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-medium">Task not found</h2>
          <Button onClick={() => navigate('/dashboard')} className="mt-4">
            Go back to dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Button>
      </div>

      <TaskInput
        taskId={task.taskId}
        taskTitle={task.taskTitle}
        taskDescription={task.taskDescription}
      />
    </div>
  );
};

export default TaskDetailPage; 