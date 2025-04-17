import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, Bell, Clock } from 'lucide-react';
import { Notification } from '@/types';
import { Task, User } from '@/types';
import { useDatabaseService } from '@/services/DatabaseServiceContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

const NotificationDetails: React.FC = () => {
  const { notificationId } = useParams<{ notificationId: string }>();
  const navigate = useNavigate();
  const databaseService = useDatabaseService();
  const [notification, setNotification] = useState<Notification | null>(null);
  const [relatedTask, setRelatedTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadNotificationDetails = async () => {
      if (!notificationId) return;

      try {
        setLoading(true);
        
        // Get notification details
        const { data: notificationData, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('id', notificationId)
          .single();

        if (error) throw error;

        const formattedNotification: Notification = {
          id: notificationData.id,
          userId: notificationData.user_id,
          title: notificationData.title,
          message: notificationData.message,
          type: notificationData.type,
          read: notificationData.read,
          createdAt: notificationData.created_at,
          taskId: notificationData.task_id
        };

        setNotification(formattedNotification);

        // If notification has a related task, fetch its details
        if (notificationData.task_id) {
          const taskData = await databaseService.getTaskById(notificationData.task_id);
          setRelatedTask(taskData);
        }

        // Mark notification as read
        await supabase
          .from('notifications')
          .update({ read: true })
          .eq('id', notificationId);

      } catch (error) {
        console.error('Error loading notification details:', error);
        toast.error('Failed to load notification details');
      } finally {
        setLoading(false);
      }
    };

    loadNotificationDetails();
  }, [notificationId, databaseService]);

  const handleBack = () => {
    navigate('/');
  };

  const handleViewTask = () => {
    if (relatedTask) {
      navigate(`/tasks/${relatedTask.id}`);
    }
  };

  const getNotificationTypeColor = (type: string) => {
    switch (type) {
      case 'task_assigned':
        return 'bg-blue-100 text-blue-800';
      case 'task_updated':
        return 'bg-yellow-100 text-yellow-800';
      case 'task_completed':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <Button variant="ghost" onClick={handleBack} className="mb-4">
          <ChevronLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span className="ml-2">Loading notification details...</span>
        </div>
      </div>
    );
  }

  if (!notification) {
    return (
      <div className="container mx-auto p-4">
        <Button variant="ghost" onClick={handleBack} className="mb-4">
          <ChevronLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>
        <div>Notification not found</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <Button variant="ghost" onClick={handleBack} className="mb-4">
        <ChevronLeft className="h-4 w-4 mr-2" />
        Back to Dashboard
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              <CardTitle>{notification.title}</CardTitle>
            </div>
            <Badge className={getNotificationTypeColor(notification.type)}>
              {notification.type.replace('_', ' ')}
            </Badge>
          </div>
          <div className="flex items-center text-sm text-muted-foreground">
            <Clock className="h-4 w-4 mr-1" />
            {format(new Date(notification.createdAt), 'PPpp')}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <CardDescription className="text-base whitespace-pre-wrap">
            {notification.message}
          </CardDescription>

          {relatedTask && (
            <div className="mt-6 p-4 bg-muted rounded-lg">
              <h3 className="text-lg font-semibold mb-2">Related Task Details</h3>
              <div className="space-y-2">
                <p><strong>Title:</strong> {relatedTask.title}</p>
                <p><strong>Status:</strong> {relatedTask.status}</p>
                <p><strong>Priority:</strong> {relatedTask.priority}</p>
                {relatedTask.dueDate && (
                  <p><strong>Due Date:</strong> {format(new Date(relatedTask.dueDate), 'PPP')}</p>
                )}
                <Button onClick={handleViewTask} className="mt-4">
                  View Task Details
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default NotificationDetails; 