import { supabase } from '@/integrations/supabase/client';
import { supabaseAdmin } from '@/integrations/supabase/admin';
import { Task, User } from '@/types';
import { toast } from 'sonner';
import { sendGridService } from './sendGridService';

export type NotificationType = 
  | 'task_assigned' 
  | 'task_updated' 
  | 'task_completed'
  | 'task_review_accepted'
  | 'task_review_rejected'
  | 'task_review_needs_improvement';

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  read: boolean;
  createdAt: string;
  taskId?: string;
}

class NotificationService {
  async sendTaskAssignmentEmail(user: User, task: Task, assignedBy: User): Promise<void> {
    try {
      // Create in-app notification first
      await this.createNotification({
        userId: user.id,
        title: 'New Task Assigned',
        message: `You have been assigned a new task: ${task.title}`,
        type: 'task_assigned',
        taskId: task.id,
      });

      // Send email using SendGrid
      try {
        await sendGridService.sendTaskAssignmentEmail(user, task, assignedBy);
        console.log('Email notification sent successfully');
      } catch (emailError) {
        console.error('Error sending email:', emailError);
        toast.error('Failed to send email notification');
      }

    } catch (error) {
      console.error('Error in sendTaskAssignmentEmail:', error);
      toast.error('Failed to create notification');
    }
  }

  async sendTaskReviewNotification(
    task: Task, 
    reviewStatus: 'accepted' | 'rejected' | 'needs_improvement',
    reviewer: User,
    assignedUser: User
  ): Promise<void> {
    try {
      const messages = {
        accepted: `Your task "${task.title}" has been accepted.`,
        rejected: `Your task "${task.title}" has been rejected. Please make necessary changes.`,
        needs_improvement: `Your task "${task.title}" needs improvement. Please update and resubmit.`
      };

      // Create in-app notification
      await this.createNotification({
        userId: task.assignedTo,
        title: `Task Review: ${task.title}`,
        message: messages[reviewStatus],
        type: `task_review_${reviewStatus}` as NotificationType,
        taskId: task.id
      });

      // Send email notification
      try {
        await sendGridService.sendTaskReviewEmail(task, reviewStatus, reviewer, assignedUser);
      } catch (emailError) {
        console.error('Error sending review email:', emailError);
        toast.warning('Notification created but email delivery failed');
      }

    } catch (error) {
      console.error('Error in sendTaskReviewNotification:', error);
      throw error;
    }
  }

  async createNotification(notification: Omit<Notification, 'id' | 'read' | 'createdAt'>): Promise<void> {
    try {
      const { error } = await supabase
        .from('notifications')
        .insert({
          user_id: notification.userId,
          title: notification.title,
          message: notification.message,
          type: notification.type,
          read: false,
          created_at: new Date().toISOString(),
          task_id: notification.taskId,
        });

      if (error) {
        console.error('Error creating notification:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error in createNotification:', error);
      throw error;
    }
  }

  async getNotifications(userId: string): Promise<Notification[]> {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching notifications:', error);
        throw error;
      }

      return data.map(notification => ({
        id: notification.id,
        userId: notification.user_id,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        read: notification.read,
        createdAt: notification.created_at,
        taskId: notification.task_id,
      }));
    } catch (error) {
      console.error('Error in getNotifications:', error);
      throw error;
    }
  }

  async markNotificationAsRead(notificationId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId);

      if (error) {
        console.error('Error marking notification as read:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error in markNotificationAsRead:', error);
      throw error;
    }
  }

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', userId)
        .eq('read', false);

      if (error) {
        console.error('Error marking all notifications as read:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error in markAllNotificationsAsRead:', error);
      throw error;
    }
  }
}

export const notificationService = new NotificationService(); 