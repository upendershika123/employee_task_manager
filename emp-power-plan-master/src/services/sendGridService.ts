import { Task, User } from '@/types';
import { toast } from 'sonner';

// Get the app URL from Vite environment variables
const APP_URL = import.meta.env.VITE_APP_URL || window.location.origin;
const API_URL = import.meta.env.VITE_API_URL || `${window.location.origin}/api`;

interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html: string;
}

class SendGridService {
  private async sendEmail(options: EmailOptions) {
    console.log('🚀 Attempting to send email:', {
      to: options.to,
      subject: options.subject
    });

    try {
      const response = await fetch(`${API_URL}/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: options.to,
          subject: options.subject,
          html: options.html,
          text: options.text || options.html.replace(/<[^>]*>/g, '')
        }),
      });

      if (!response.ok) {
        let errorMessage = 'Failed to send email';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          errorMessage = `${errorMessage}: ${response.statusText}`;
        }
        console.error('❌ Email sending failed:', errorMessage);
        throw new Error(errorMessage);
      }

      console.log('✅ Email sent successfully to:', options.to);
      return { success: true };
    } catch (error) {
      console.error('❌ Email Error:', error);
      return { success: false, error };
    }
  }

  async sendTaskAssignmentEmail(user: User, task: Task, assignedBy: User): Promise<void> {
    console.log('📧 Sending task assignment email:', {
      to: user.email,
      taskTitle: task.title,
      assignedBy: assignedBy.name
    });

    try {
      const emailData: EmailOptions = {
        to: user.email,
        subject: `New Task Assigned: ${task.title}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">New Task Assigned</h2>
            <p>Hello ${user.name},</p>
            <p>${assignedBy.name} has assigned you a new task:</p>
            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
              <h3 style="margin-top: 0;">${task.title}</h3>
              <p><strong>Description:</strong> ${task.description}</p>
              <p><strong>Priority:</strong> ${task.priority}</p>
              <p><strong>Due Date:</strong> ${task.due_date ? new Date(task.due_date).toLocaleDateString() : 'Not set'}</p>
              <p><strong>Status:</strong> ${task.status}</p>
            </div>
            <p>You can view and manage this task in your dashboard.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${APP_URL}/tasks/${task.id}" 
                 style="background-color: #2563eb; color: white; padding: 12px 24px; 
                        text-decoration: none; border-radius: 6px; display: inline-block;">
                View Task
              </a>
            </div>
            <p>Best regards,<br>Your Task Management System</p>
          </div>
        `
      };

      const result = await this.sendEmail(emailData);
      if (result.success) {
        console.log('✅ Task assignment email sent successfully');
        toast.success('Task assignment notification sent');
      } else {
        console.warn('⚠️ Failed to send task assignment email');
        toast.error('Failed to send task assignment notification');
      }
    } catch (error) {
      console.error('❌ Error sending task assignment email:', error);
    }
  }

  async sendTaskCompletionEmail(task: Task, completedByUser: User, teamLead: User): Promise<void> {
    if (!task || !completedByUser || !teamLead) {
      console.error('❌ Missing required data for completion email:', { task, completedByUser, teamLead });
      return;
    }

    console.log('📧 Sending task completion email:', {
      task: task.title,
      completedBy: completedByUser.name,
      to: teamLead.email
    });

    const taskUrl = `${APP_URL}/tasks/${task.id}`;
    
    const emailData: EmailOptions = {
      to: teamLead.email,
      subject: `Task Completed: ${task.title}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Task Completed and Ready for Review</h2>
          <p>Hello ${teamLead.name},</p>
          <p>${completedByUser.name} has completed the task "${task.title}".</p>
          
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Task Details:</h3>
            <ul style="list-style: none; padding: 0;">
              <li style="margin-bottom: 10px;"><strong>Task:</strong> ${task.title}</li>
              <li style="margin-bottom: 10px;"><strong>Completed by:</strong> ${completedByUser.name}</li>
              <li style="margin-bottom: 10px;"><strong>Completed at:</strong> ${new Date().toLocaleString()}</li>
              <li style="margin-bottom: 10px;"><strong>Status:</strong> Ready for review</li>
            </ul>
          </div>

          <p>Please review the completed task in your dashboard.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${taskUrl}" 
               style="background-color: #2563eb; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 6px; display: inline-block;">
              Review Task
            </a>
          </div>

          <p style="color: #6b7280; font-size: 14px;">
            This is an automated message. Please do not reply to this email.
          </p>
        </div>
      `
    };

    try {
      const result = await this.sendEmail(emailData);
      if (result.success) {
        console.log('✅ Task completion email sent successfully');
        toast.success('Task completion notification sent');
      } else {
        console.warn('⚠️ Failed to send task completion email');
        toast.error('Failed to send task completion notification');
      }
    } catch (error) {
      console.error('❌ Error sending task completion email:', error);
    }
  }

  async sendTaskReviewEmail(
    task: Task,
    reviewStatus: 'accepted' | 'rejected' | 'needs_improvement',
    reviewer: User,
    assignedUser: User
  ): Promise<void> {
    console.log('📧 Sending task review email:', {
      task: task.title,
      status: reviewStatus,
      reviewer: reviewer.name,
      to: assignedUser.email
    });

    const statusColors = {
      accepted: '#22c55e',
      rejected: '#ef4444',
      needs_improvement: '#f59e0b'
    };

    const messages = {
      accepted: 'has been accepted',
      rejected: 'has been rejected',
      needs_improvement: 'needs improvement'
    };

    const emailData = {
      to: assignedUser.email,
      subject: `Task Review Update: ${task.title}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: ${statusColors[reviewStatus]};">Task Review Update</h2>
          <p>Hello ${assignedUser.name},</p>
          <p>Your task "${task.title}" ${messages[reviewStatus]} by ${reviewer.name}.</p>
          
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Task Details:</h3>
            <ul style="list-style: none; padding: 0;">
              <li style="margin-bottom: 10px;"><strong>Task:</strong> ${task.title}</li>
              <li style="margin-bottom: 10px;"><strong>Reviewed by:</strong> ${reviewer.name}</li>
              <li style="margin-bottom: 10px;"><strong>Review Status:</strong> ${reviewStatus}</li>
              <li style="margin-bottom: 10px;"><strong>Review Date:</strong> ${new Date().toLocaleString()}</li>
            </ul>
          </div>

          ${reviewStatus !== 'accepted' ? `
            <p><strong>Next Steps:</strong> Please review the feedback, make the necessary changes, and resubmit the task.</p>
          ` : `
            <p><strong>Congratulations!</strong> Your task has been accepted.</p>
          `}

          <div style="text-align: center; margin: 30px 0;">
            <a href="${APP_URL}/tasks/${task.id}" 
               style="background-color: ${statusColors[reviewStatus]}; color: white; 
                      padding: 12px 24px; text-decoration: none; border-radius: 6px; 
                      display: inline-block;">
              View Task
            </a>
          </div>
        </div>
      `
    };

    try {
      const result = await this.sendEmail(emailData);
      if (result.success) {
        console.log('✅ Task review email sent successfully');
        toast.success('Task review notification sent');
      } else {
        console.warn('⚠️ Failed to send task review email');
        toast.error('Failed to send task review notification');
      }
    } catch (error) {
      console.error('❌ Error sending task review email:', error);
    }
  }
}

export const sendGridService = new SendGridService(); 