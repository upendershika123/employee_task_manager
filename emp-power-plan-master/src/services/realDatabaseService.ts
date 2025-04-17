import { DatabaseService } from './types';
import { User, Task, Team, Performance, AutomaticTask, TaskAssignmentLog } from '../types';
import { supabase, supabaseAdmin } from '@/integrations/supabase/client';
import { v4 as uuidv4 } from 'uuid';
import { doc, setDoc, collection, getDocs, query, where, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/firebase/firebaseConfig';

class RealDatabaseService implements DatabaseService {
  // Add connection test method
  async testConnection(): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('count')
        .limit(1);
      
      if (error) {
        console.error('Database connection error:', error);
        return false;
      }
      
      console.log('Database connection successful');
      return true;
    } catch (error) {
      console.error('Error testing database connection:', error);
      return false;
    }
  }

  // User operations
  async getUsers(): Promise<User[]> {
    const { data, error } = await supabase
      .from('users')
      .select('*');
    
    if (error) {
      console.error('Error fetching users:', error);
      throw error;
    }
    
    return data.map(user => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      team_id: user.team_id,
      avatar: user.avatar,
    }));
  }

  async getUserById(id: string): Promise<User | null> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        // Record not found
        return null;
      }
      console.error('Error fetching user by ID:', error);
      throw error;
    }
    
    if (!data) return null;
    
    return {
      id: data.id,
      name: data.name,
      email: data.email,
      role: data.role,
      team_id: data.team_id,
      avatar: data.avatar,
    };
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        // Record not found
        return null;
      }
      console.error('Error fetching user by email:', error);
      throw error;
    }
    
    if (!data) return null;
    
    return {
      id: data.id,
      name: data.name,
      email: data.email,
      role: data.role,
      team_id: data.team_id,
      avatar: data.avatar,
    };
  }

  async createUser(userData: Partial<User>): Promise<User> {
    try {
      console.log('Starting user creation process...');
      
      // Validate required fields
      if (!userData.email) {
        throw new Error('Email is required');
      }
      if (!userData.name) {
        throw new Error('Name is required');
      }

      // First, check if user already exists in auth
      console.log('Checking if user exists in auth...');
      const { data: existingUser, error: checkError } = await supabaseAdmin.auth.admin.listUsers();
      
      if (checkError) {
        console.error('Error checking for existing user:', checkError);
        throw new Error(`Failed to check for existing user: ${checkError.message}`);
      }

      let authUserId: string;
      const existingAuthUser = existingUser?.users?.find((user: any) => user.email?.toLowerCase() === userData.email.toLowerCase());

      if (existingAuthUser) {
        console.log('User already exists in auth, updating metadata...');
        // User exists, update their metadata
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
          existingAuthUser.id,
          {
            user_metadata: {
              name: userData.name,
              role: userData.role || 'team_member',
              team_id: userData.team_id || null
            }
          }
        );

        if (updateError) {
          console.error('Error updating user metadata:', updateError);
          throw new Error(`Failed to update user metadata: ${updateError.message}`);
        }

        authUserId = existingAuthUser.id;
      } else {
        console.log('Creating new auth account...');
        // User doesn't exist, create new account without password
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: userData.email.toLowerCase(),
          email_confirm: false,
          user_metadata: {
            name: userData.name,
            role: userData.role || 'team_member',
            team_id: userData.team_id || null
          }
        });

        if (authError) {
          console.error('Error creating auth account:', {
            message: authError.message,
            status: authError.status,
            name: authError.name
          });
          throw new Error(`Failed to create auth account: ${authError.message}`);
        }

        if (!authData.user) {
          console.error('No user data returned from auth creation');
          throw new Error('No user data returned from auth creation');
        }

        authUserId = authData.user.id;
      }

      // Check if user exists in the users table
      console.log('Checking if user exists in database...');
      const { data: existingDbUser, error: dbCheckError } = await supabase
        .from('users')
        .select('*')
        .eq('email', userData.email.toLowerCase())
        .single();

      if (dbCheckError && dbCheckError.code !== 'PGRST116') {
        console.error('Error checking database for user:', dbCheckError);
        throw new Error(`Failed to check database for user: ${dbCheckError.message}`);
      }

      let userRecord;
      if (existingDbUser) {
        console.log('User exists in database, updating...');
        // Update existing user
        const { data, error } = await supabase
          .from('users')
          .update({
            name: userData.name,
            role: userData.role || 'team_member',
            team_id: userData.team_id || null,
            avatar: userData.avatar || null
          })
          .eq('id', existingDbUser.id)
          .select()
          .single();

        if (error) {
          console.error('Error updating user in database:', error);
          throw new Error(`Failed to update user in database: ${error.message}`);
        }

        userRecord = data;
      } else {
        console.log('Creating new user in database...');
        // Create new user
        const { data, error } = await supabase
          .from('users')
          .insert({
            id: authUserId,
            name: userData.name,
            email: userData.email.toLowerCase(),
            role: userData.role || 'team_member',
            team_id: userData.team_id || null,
            avatar: userData.avatar || null
          })
          .select()
          .single();

        if (error) {
          console.error('Error creating user in database:', error);
          throw new Error(`Failed to create user in database: ${error.message}`);
        }

        userRecord = data;
      }

      // Don't send any emails here - let the user request verification when they try to log in
      console.log('User created/updated successfully. Verification email will be sent when user attempts to log in.');

      // If this is a new user (not an update), send an invite email immediately
      if (!existingDbUser) {
        console.log('Sending invite email to new user...');
        try {
          await this.sendVerificationEmail(userData.email.toLowerCase());
          console.log('Invite email sent successfully to new user');
        } catch (emailError) {
          console.error('Error sending invite email:', emailError);
          // Don't throw the error, just log it
          // The user was created successfully, so we don't want to fail the whole operation
        }
      }

      // Return the user data
      return {
        id: userRecord.id,
        name: userRecord.name,
        email: userRecord.email,
        role: userRecord.role,
        team_id: userRecord.team_id,
        avatar: userRecord.avatar
      };
    } catch (error) {
      console.error('Error in createUser:', error);
      throw error;
    }
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User> {
    try {
      // First, update the user in the database
      const { data, error } = await supabase
        .from('users')
        .update({
          name: updates.name,
          email: updates.email,
          role: updates.role,
          team_id: updates.team_id,
          avatar: updates.avatar,
        })
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        console.error('Error updating user in database:', error);
        throw new Error(`Failed to update user in database: ${error.message}`);
      }
      
      // Then, update the user's metadata in auth
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
        id,
        {
          user_metadata: {
            name: updates.name,
            role: updates.role,
            team_id: updates.team_id
          }
        }
      );
      
      if (authError) {
        console.error('Error updating user metadata in auth:', authError);
        // Don't throw the error, just log it
        // The user was updated in the database, so we don't want to fail the whole operation
      }
      
      // Return the updated user data
      return {
        id: data.id,
        name: data.name,
        email: data.email,
        role: data.role,
        team_id: data.team_id,
        avatar: data.avatar,
      };
    } catch (error) {
      console.error('Error in updateUser:', error);
      throw error;
    }
  }

  // Team operations
  async getTeams(): Promise<Team[]> {
    const { data, error } = await supabase
      .from('teams')
      .select('*');
    
    if (error) {
      console.error('Error fetching teams:', error);
      throw error;
    }
    
    return data.map(team => ({
      id: team.id,
      name: team.name,
      leadId: team.lead_id,
    }));
  }

  async getTeamById(id: string): Promise<Team | null> {
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        // Record not found
        return null;
      }
      console.error('Error fetching team by ID:', error);
      throw error;
    }
    
    if (!data) return null;
    
    return {
      id: data.id,
      name: data.name,
      leadId: data.lead_id,
    };
  }

  async createTeam(teamData: Partial<Team>): Promise<Team> {
    if (!teamData.id) {
      teamData.id = `team-${Date.now()}`;
    }
    
    const { data, error } = await supabase
      .from('teams')
      .insert({
        id: teamData.id,
        name: teamData.name || '',
        lead_id: teamData.leadId || '',
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error creating team:', error);
      throw error;
    }
    
    return {
      id: data.id,
      name: data.name,
      leadId: data.lead_id,
    };
  }

  async updateTeam(id: string, updates: Partial<Team>): Promise<Team> {
    const { data, error } = await supabase
      .from('teams')
      .update({
        name: updates.name,
        lead_id: updates.leadId,
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating team:', error);
      throw error;
    }
    
    return {
      id: data.id,
      name: data.name,
      leadId: data.lead_id,
    };
  }

  // Task operations
  async getTasks(): Promise<Task[]> {
    const { data, error } = await supabase
      .from('tasks')
      .select('*');
    
    if (error) {
      console.error('Error fetching tasks:', error);
      throw error;
    }
    
    return data.map(task => ({
      id: task.id,
      title: task.title,
      description: task.description,
      assigned_to: task.assigned_to,
      assigned_by: task.assigned_by,
      priority: task.priority,
      status: task.status,
      review_status: task.review_status,
      due_date: task.due_date,
      created_at: task.created_at,
      updated_at: task.updated_at,
      completed_at: task.completed_at,
      team_id: task.team_id,
    }));
  }

  async getTaskById(id: string): Promise<Task | null> {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        // Record not found
        return null;
      }
      console.error('Error fetching task by ID:', error);
      throw error;
    }
    
    if (!data) return null;
    
    return {
      id: data.id,
      title: data.title,
      description: data.description,
      assigned_to: data.assigned_to,
      assigned_by: data.assigned_by,
      priority: data.priority,
      status: data.status,
      review_status: data.review_status,
      due_date: data.due_date,
      created_at: data.created_at,
      updated_at: data.updated_at,
      completed_at: data.completed_at,
      team_id: data.team_id,
    };
  }

  async getTasksByUserId(userId: string): Promise<Task[]> {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('assigned_to', userId);
    
    if (error) {
      console.error('Error fetching tasks by user ID:', error);
      throw error;
    }
    
    return data.map(task => ({
      id: task.id,
      title: task.title,
      description: task.description,
      assigned_to: task.assigned_to,
      assigned_by: task.assigned_by,
      priority: task.priority,
      status: task.status,
      review_status: task.review_status,
      due_date: task.due_date,
      created_at: task.created_at,
      updated_at: task.updated_at,
      completed_at: task.completed_at,
      team_id: task.team_id,
    }));
  }

  async getTasksByTeamId(teamId: string): Promise<Task[]> {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('team_id', teamId);
    
    if (error) {
      console.error('Error fetching tasks by team ID:', error);
      throw error;
    }
    
    return data.map(task => ({
      id: task.id,
      title: task.title,
      description: task.description,
      assigned_to: task.assigned_to,
      assigned_by: task.assigned_by,
      priority: task.priority,
      status: task.status,
      review_status: task.review_status,
      due_date: task.due_date,
      created_at: task.created_at,
      updated_at: task.updated_at,
      completed_at: task.completed_at,
      team_id: task.team_id,
    }));
  }

  async createTask(taskData: Partial<Task>): Promise<Task> {
    try {
      // Log the incoming task data for debugging
      console.log('Creating task with data in realDatabaseService:', taskData);
      
      // Check if team_id is provided
      if (!taskData.team_id) {
        console.error('Team ID is missing in task data:', taskData);
        throw new Error('Team ID is required to create a task');
      }

      // Generate a unique ID for the task
      const taskId = `task-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      // Map the task data to the database column names
      const dbTaskData = {
        id: taskId,
        title: taskData.title,
        description: taskData.description,
        assigned_to: taskData.assigned_to,
        assigned_by: taskData.assigned_by,
        priority: taskData.priority || 'medium',
        status: taskData.status || 'pending',
        review_status: taskData.review_status || 'pending',
        due_date: taskData.due_date,
        created_at: taskData.created_at || new Date().toISOString(),
        updated_at: taskData.updated_at || new Date().toISOString(),
        completed_at: taskData.completed_at,
        team_id: taskData.team_id
      };

      console.log('Creating task in database with data:', dbTaskData);

      const { data, error } = await supabase
        .from('tasks')
        .insert([dbTaskData])
        .select()
        .single();

      if (error) {
        console.error('Error creating task:', error);
        throw new Error(error.message);
      }

      if (!data) {
        throw new Error('No data returned after task creation');
      }

      // Map the database response back to the Task type
      return {
        id: data.id,
        title: data.title,
        description: data.description,
        assigned_to: data.assigned_to,
        assigned_by: data.assigned_by,
        priority: data.priority,
        status: data.status,
        review_status: data.review_status,
        due_date: data.due_date,
        created_at: data.created_at,
        updated_at: data.updated_at,
        completed_at: data.completed_at,
        team_id: data.team_id
      };
    } catch (error) {
      console.error('Error in createTask:', error);
      throw error;
    }
  }

  async updateTask(id: string, updates: Partial<Task>): Promise<Task> {
    try {
      // Set updated_at timestamp
      const updatedAt = new Date().toISOString();
      
      // If task is being marked as completed, set completedAt
      let completedAt = updates.completed_at;
      if (updates.status === 'completed' && !completedAt) {
        completedAt = new Date().toISOString();
      }
      
      const { data, error } = await supabase
        .from('tasks')
        .update({
          title: updates.title,
          description: updates.description,
          assigned_to: updates.assigned_to,
          assigned_by: updates.assigned_by,
          priority: updates.priority,
          status: updates.status,
          review_status: updates.review_status,
          due_date: updates.due_date,
          updated_at: updatedAt,
          completed_at: completedAt,
          team_id: updates.team_id,
        })
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        console.error('Error updating task:', error);
        throw error;
      }
      
      // If task status is being updated to completed, update performance metrics
      if (updates.status === 'completed') {
        await this.updatePerformanceMetrics(data.assigned_to);
      }
      
      return {
        id: data.id,
        title: data.title,
        description: data.description,
        assigned_to: data.assigned_to,
        assigned_by: data.assigned_by,
        priority: data.priority,
        status: data.status,
        review_status: data.review_status,
        due_date: data.due_date,
        created_at: data.created_at,
        updated_at: data.updated_at,
        completed_at: data.completed_at,
        team_id: data.team_id,
      };
    } catch (error) {
      console.error('Error in updateTask:', error);
      throw error;
    }
  }

  // Performance operations
  async getPerformanceMetrics(): Promise<Performance[]> {
    try {
      const { data, error } = await supabase
        .from('performance')
        .select('*');
      
      if (error) {
        console.error('Error fetching performance metrics:', error);
        throw error;
      }
      
      return data.map(perf => ({
        userId: perf.user_id,
        completedTasks: perf.completed_tasks,
        onTimeCompletion: perf.on_time_completion,
        averageTaskDuration: perf.average_task_duration,
        period: perf.period,
      }));
    } catch (error) {
      console.error('Error in getPerformanceMetrics:', error);
      throw error;
    }
  }

  async getPerformanceByUserId(userId: string): Promise<Performance | null> {
    try {
      const { data, error } = await supabase
        .from('performance')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          // Record not found
          return null;
        }
        console.error('Error fetching performance by user ID:', error);
        throw error;
      }
      
      if (!data) return null;
      
      return {
        userId: data.user_id,
        completedTasks: data.completed_tasks,
        onTimeCompletion: data.on_time_completion,
        averageTaskDuration: data.average_task_duration,
        period: data.period,
      };
    } catch (error) {
      console.error('Error in getPerformanceByUserId:', error);
      throw error;
    }
  }

  async updatePerformanceMetrics(userId: string): Promise<void> {
    try {
      console.log('Updating performance metrics for user:', userId);
      
      // Get all completed tasks for the user
      const { data: tasks, error: tasksError } = await supabase
        .from('tasks')
        .select('*')
        .eq('assigned_to', userId)
        .eq('status', 'completed');
      
      if (tasksError) {
        console.error('Error fetching completed tasks:', tasksError);
        throw tasksError;
      }
      
      if (!tasks || tasks.length === 0) {
        console.log('No completed tasks found for user:', userId);
        return;
      }
      
      // Calculate performance metrics
      const completedTasks = tasks.length;
      
      // Calculate on-time completion rate
      const onTimeTasks = tasks.filter(task => {
        const completedDate = new Date(task.completed_at);
        const dueDate = new Date(task.due_date);
        return completedDate <= dueDate;
      }).length;
      
      const onTimeCompletion = completedTasks > 0 ? (onTimeTasks / completedTasks) * 100 : 0;
      
      // Calculate average task duration
      let totalDuration = 0;
      tasks.forEach(task => {
        const createdDate = new Date(task.created_at);
        const completedDate = new Date(task.completed_at);
        const duration = completedDate.getTime() - createdDate.getTime();
        totalDuration += duration;
      });
      
      const averageTaskDuration = completedTasks > 0 ? totalDuration / completedTasks : 0;
      
      // Get current month and year for the period
      const now = new Date();
      const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      
      // Check if performance record exists for this user and period
      const { data: existingRecord, error: checkError } = await supabase
        .from('performance')
        .select('*')
        .eq('user_id', userId)
        .eq('period', period)
        .single();
      
      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Error checking existing performance record:', checkError);
        throw checkError;
      }
      
      if (existingRecord) {
        // Update existing record
        const { error: updateError } = await supabase
          .from('performance')
          .update({
            completed_tasks: completedTasks,
            on_time_completion: onTimeCompletion,
            average_task_duration: averageTaskDuration,
          })
          .eq('user_id', userId)
          .eq('period', period);
        
        if (updateError) {
          console.error('Error updating performance record:', updateError);
          throw updateError;
        }
        
        console.log('Performance record updated for user:', userId);
      } else {
        // Create new record
        const { error: insertError } = await supabase
          .from('performance')
          .insert({
            user_id: userId,
            completed_tasks: completedTasks,
            on_time_completion: onTimeCompletion,
            average_task_duration: averageTaskDuration,
            period: period,
          });
        
        if (insertError) {
          console.error('Error creating performance record:', insertError);
          throw insertError;
        }
        
        console.log('New performance record created for user:', userId);
      }
    } catch (error) {
      console.error('Error in updatePerformanceMetrics:', error);
      throw error;
    }
  }

  async sendVerificationEmail(email: string): Promise<void> {
    try {
      console.log('Attempting to send verification email to:', email);
      
      // First, check if the user exists in the users table
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('email', email.toLowerCase())
        .single();

      if (userError || !userData) {
        console.error('User not found in database:', email);
        throw new Error('User not found');
      }

      console.log('User found, checking auth status...');
      
      // Check if the user exists in Supabase Auth
      const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers();
      
      if (authError) {
        console.error('Error checking auth users:', authError);
        throw new Error('Failed to check user authentication status');
      }
      
      const authUser = authUsers.users.find((user: any) => user.email === email.toLowerCase());
      
      if (!authUser) {
        console.log('User exists in database but not in Supabase Auth. Creating auth user...');
        
        // Create the user in Supabase Auth
        const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: email.toLowerCase(),
          email_confirm: false,
          user_metadata: {
            name: userData.name,
            role: userData.role,
            team_id: userData.team_id
          }
        });
        
        if (createError) {
          console.error('Error creating auth user:', createError);
          throw new Error('Failed to create auth user');
        }
        
        console.log('Auth user created, sending invite email...');
      } else {
        console.log('User exists in both database and Supabase Auth');
      }

      // Send verification email using admin client with redirect URL
      console.log('Sending invite email with redirect URL:', `${window.location.origin}/auth/callback?type=recovery`);
      
      const { error: verificationError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
        email.toLowerCase(),
        {
          redirectTo: `${window.location.origin}/auth/callback?type=recovery`
        }
      );

      if (verificationError) {
        console.error('Error sending verification email:', verificationError);
        // Log the full error details
        console.error('Verification error details:', {
          message: verificationError.message,
          status: verificationError.status,
          name: verificationError.name
        });
        throw new Error('Failed to send verification email');
      }

      console.log('Verification email sent successfully to:', email);
    } catch (error) {
      console.error('Error in sendVerificationEmail:', error);
      throw error;
    }
  }

  // Automatic Task operations
  async getAutomaticTasks(): Promise<AutomaticTask[]> {
    const { data, error } = await supabase
      .from('automatic_task')
      .select('*');
    
    if (error) {
      console.error('Error fetching automatic tasks:', error);
      throw error;
    }
    
    return data.map(task => ({
      taskId: task.task_id,
      taskTitle: task.task_title,
      taskDescription: task.task_description,
      priority: task.priority,
      estimatedTime: task.estimated_time,
      created_at: task.created_at,
      status: task.status,
      assignedTo: task.assigned_to,
      assignedBy: task.assigned_by,
      assignedAt: task.assigned_at,
      teamId: task.team_id,
      dueDate: task.due_date,
    }));
  }

  async getAutomaticTaskById(id: string): Promise<AutomaticTask | null> {
    const { data, error } = await supabase
      .from('automatic_task')
      .select('*')
      .eq('task_id', id)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        // Record not found
        return null;
      }
      console.error('Error fetching automatic task by ID:', error);
      throw error;
    }
    
    if (!data) return null;
    
    return {
      taskId: data.task_id,
      taskTitle: data.task_title,
      taskDescription: data.task_description,
      priority: data.priority,
      estimatedTime: data.estimated_time,
      created_at: data.created_at,
      status: data.status,
      assignedTo: data.assigned_to,
      assignedBy: data.assigned_by,
      assignedAt: data.assigned_at,
      teamId: data.team_id,
      dueDate: data.due_date,
    };
  }

  async getPendingAutomaticTasks(): Promise<AutomaticTask[]> {
    const { data, error } = await supabase
      .from('automatic_task')
      .select('*')
      .eq('status', 'pending')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true });
    
    if (error) {
      console.error('Error fetching pending automatic tasks:', error);
      throw error;
    }
    
    return data.map(task => ({
      taskId: task.task_id,
      taskTitle: task.task_title,
      taskDescription: task.task_description,
      priority: task.priority,
      estimatedTime: task.estimated_time,
      created_at: task.created_at,
      status: task.status,
      assignedTo: task.assigned_to,
      assignedBy: task.assigned_by,
      assignedAt: task.assigned_at,
      teamId: task.team_id,
      dueDate: task.due_date,
    }));
  }

  async createAutomaticTask(task: Partial<AutomaticTask>): Promise<AutomaticTask> {
    try {
      // Validate required fields
      if (!task.taskTitle) {
        throw new Error('Task title is required');
      }
      if (!task.priority) {
        throw new Error('Task priority is required');
      }
      if (!task.teamId) {
        throw new Error('Team ID is required');
      }
      if (!task.dueDate) {
        throw new Error('Due date is required');
      }

      // Get current user's session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('Session error:', sessionError);
        throw new Error('Authentication failed');
      }
      
      if (!session) {
        throw new Error('No active session');
      }

      // Get user's role and team from the users table
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('role, team_id')
        .eq('id', session.user.id)
        .single();

      if (userError) {
        console.error('Error fetching user data:', userError);
        throw new Error('Failed to fetch user data');
      }

      if (!userData) {
        throw new Error('User not found');
      }

      console.log('Current user role:', userData.role);
      console.log('Current user team:', userData.team_id);

      // Check if user has permission to create task
      if (userData.role !== 'admin' && userData.role !== 'team_lead') {
        throw new Error('Insufficient permissions to create automatic tasks');
      }

      // For team leads, ensure they're creating task for their own team
      if (userData.role === 'team_lead' && userData.team_id !== task.teamId) {
        throw new Error('Team leads can only create tasks for their own team');
      }

      // Prepare the task data
      const taskData = {
        task_title: task.taskTitle,
        task_description: task.taskDescription || null,
        priority: task.priority,
        status: 'pending',
        team_id: task.teamId,
        due_date: task.dueDate,
        created_at: new Date().toISOString()
      };

      // Log the data being sent
      console.log('Creating automatic task with data:', taskData);

      // Insert the task
      const { data, error } = await supabase
        .from('automatic_task')
        .insert(taskData)
        .select()
        .single();
      
      if (error) {
        console.error('Error creating automatic task:', error);
        if (error.code === 'PGRST204') {
          throw new Error('No permission to create task');
        } else if (error.code === '23503') {
          throw new Error('Invalid team ID');
        } else {
          throw new Error(`Failed to create automatic task: ${error.message}`);
        }
      }
      
      if (!data) {
        throw new Error('No data returned after task creation');
      }

      // Return the created task
      return {
        taskId: data.task_id,
        taskTitle: data.task_title,
        taskDescription: data.task_description,
        priority: data.priority,
        created_at: data.created_at,
        status: data.status,
        teamId: data.team_id,
        dueDate: data.due_date
      };
    } catch (error) {
      console.error('Error in createAutomaticTask:', error);
      throw error;
    }
  }

  async updateAutomaticTask(id: string, updates: Partial<AutomaticTask>): Promise<AutomaticTask> {
    const { data, error } = await supabase
      .from('automatic_task')
      .update({
        task_title: updates.taskTitle,
        task_description: updates.taskDescription,
        priority: updates.priority,
        status: updates.status,
        assigned_to: updates.assignedTo,
        assigned_by: updates.assignedBy,
        assigned_at: updates.assignedAt,
        team_id: updates.teamId,
        due_date: updates.dueDate,
      })
      .eq('task_id', id)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating automatic task:', error);
      throw error;
    }
    
    return {
      taskId: data.task_id,
      taskTitle: data.task_title,
      taskDescription: data.task_description,
      priority: data.priority,
      created_at: data.created_at,
      status: data.status,
      teamId: data.team_id,
      dueDate: data.due_date,
    };
  }

  async assignAutomaticTask(taskId: string, userId: string, assignedBy: string): Promise<AutomaticTask> {
    // First, get the task to check its status and team
    const task = await this.getAutomaticTaskById(taskId);
    if (!task) {
      throw new Error('Task not found');
    }
    
    if (task.status !== 'pending') {
      throw new Error('Task is not in pending status');
    }
    
    if (!task.teamId) {
      throw new Error('Task has no team assigned');
    }
    
    // If userId is empty, we'll use the automatic assignment logic
    if (!userId) {
      // Get team members for the task's team
      const teamMembers = await this.getUsersByTeamId(task.teamId);
      
      // Filter out team leads and admins
      const availableMembers = teamMembers.filter(
        member => member.role === 'team_member'
      );
      
      if (availableMembers.length === 0) {
        // No team members available, assign to team lead
        const team = await this.getTeamById(task.teamId);
        if (!team || !team.leadId) {
          throw new Error('Team lead not found');
        }
        
        // Assign to team lead
        return this.updateAutomaticTask(taskId, {
          status: 'assigned',
          assignedTo: team.leadId,
          assignedBy,
          assignedAt: new Date().toISOString(),
        });
      }
      
      // Sort by priority and find the least busy team member
      // For simplicity, we'll just pick the first available member
      // In a real implementation, you would check workload and skills
      const selectedMember = availableMembers[0];
      
      // Assign to the selected team member
      return this.updateAutomaticTask(taskId, {
        status: 'assigned',
        assignedTo: selectedMember.id,
        assignedBy,
        assignedAt: new Date().toISOString(),
      });
    } else {
      // Manual assignment to a specific user
      return this.updateAutomaticTask(taskId, {
        status: 'assigned',
        assignedTo: userId,
        assignedBy,
        assignedAt: new Date().toISOString(),
      });
    }
  }

  async getUsersByTeamId(teamId: string): Promise<User[]> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('team_id', teamId);
    
    if (error) {
      console.error('Error fetching users by team ID:', error);
      throw error;
    }
    
    return data.map(user => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      team_id: user.team_id,
      avatar: user.avatar,
    }));
  }

  async getTaskAssignmentLogs(): Promise<TaskAssignmentLog[]> {
    const { data, error } = await supabase
      .from('task_assignment_log')
      .select('*')
      .order('assigned_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching task assignment logs:', error);
      throw error;
    }
    
    return data.map(log => ({
      id: log.id,
      taskId: log.task_id,
      assignedTo: log.assigned_to,
      assignedBy: log.assigned_by,
      assignedAt: log.assigned_at,
      automaticAssignment: log.automatic_assignment,
    }));
  }

  async checkAndAssignAutomaticTasks(): Promise<void> {
    try {
      // First get all users who are team members
      const { data: allUsers, error: usersError } = await supabase
        .from('users')
        .select('id, team_id')
        .eq('role', 'team_member');

      if (usersError) throw usersError;
      if (!allUsers?.length) return;

      // Get all users who have pending tasks
      const { data: usersWithTasks, error: tasksError } = await supabase
        .from('tasks')
        .select('assigned_to')
        .eq('status', 'pending');

      if (tasksError) throw tasksError;

      // Create a set of user IDs who have pending tasks
      const usersWithTasksSet = new Set(usersWithTasks?.map(task => task.assigned_to) || []);

      // Filter out users who have pending tasks
      const usersWithoutTasks = allUsers.filter(user => !usersWithTasksSet.has(user.id));

      if (!usersWithoutTasks.length) return;

      // Get all pending automatic tasks
      const { data: automaticTasks, error: autoTasksError } = await supabase
        .from('automatic_task')
        .select('*')
        .eq('status', 'pending')
        .order('priority', { ascending: false }) // Order by priority (high > medium > low)
        .order('created_at', { ascending: true }); // Then by creation date (oldest first)

      if (autoTasksError) throw autoTasksError;
      if (!automaticTasks?.length) return;

      // Group users by team
      const usersByTeam = usersWithoutTasks.reduce((acc, user) => {
        if (!acc[user.team_id]) {
          acc[user.team_id] = [];
        }
        acc[user.team_id].push(user.id);
        return acc;
      }, {} as Record<string, string[]>);

      // Group tasks by team for easier processing
      const tasksByTeam: Record<string, any[]> = {};
      automaticTasks.forEach(task => {
        if (task.team_id) {
          if (!tasksByTeam[task.team_id]) {
            tasksByTeam[task.team_id] = [];
          }
          tasksByTeam[task.team_id].push(task);
        }
      });

      // Process each team's tasks
      for (const teamId in tasksByTeam) {
        // Skip if team has no available users
        if (!usersByTeam[teamId]?.length) continue;

        // Sort tasks by priority and creation date
        const teamTasks = tasksByTeam[teamId].sort((a, b) => {
          // First sort by priority (high > medium > low)
          const priorityOrder = { high: 0, medium: 1, low: 2 };
          const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
          
          if (priorityDiff !== 0) {
            return priorityDiff;
          }
          
          // If priorities are the same, sort by creation date (oldest first)
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        });

        // Assign tasks to available users in the team
        for (const task of teamTasks) {
          // Skip if no more users available in this team
          if (!usersByTeam[teamId]?.length) break;

          // Get the first available user from the task's team
          const userId = usersByTeam[teamId][0];

          // Call the stored procedure to assign the task
          const { error: assignError } = await supabase
            .rpc('assign_automatic_task', {
              p_task_id: task.task_id,
              p_user_id: userId,
              p_task_title: task.task_title,
              p_task_description: task.task_description,
              p_priority: task.priority,
              p_team_id: task.team_id,
              p_due_date: task.due_date
            });

          if (assignError) {
            console.error('Transaction error:', assignError);
            continue;
          }

          // Remove the assigned user from the available users list
          usersByTeam[teamId] = usersByTeam[teamId].slice(1);
          
          // If no more users in this team, remove the team from the list
          if (usersByTeam[teamId].length === 0) {
            delete usersByTeam[teamId];
            break; // Exit the loop for this team
          }
        }
      }
    } catch (error) {
      console.error('Error in checkAndAssignAutomaticTasks:', error);
    }
  }

  private async sendTaskAssignmentEmail(user: User, task: Task): Promise<void> {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: user.email,
          subject: `New Task Assigned: ${task.title}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">New Task Assigned</h2>
              <p>Hello ${user.name},</p>
              <p>A new task has been automatically assigned to you:</p>
              <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
                <h3 style="margin-top: 0;">${task.title}</h3>
                <p><strong>Description:</strong> ${task.description}</p>
                <p><strong>Priority:</strong> ${task.priority}</p>
                <p><strong>Due Date:</strong> ${new Date(task.dueDate).toLocaleDateString()}</p>
              </div>
              <p>Please log in to your dashboard to view and manage this task.</p>
              <p>Best regards,<br>Task Management System</p>
            </div>
          `,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send email');
      }
    } catch (error) {
      console.error('Error sending task assignment email:', error);
      throw error;
    }
  }
}

export const realDatabaseService = new RealDatabaseService();
