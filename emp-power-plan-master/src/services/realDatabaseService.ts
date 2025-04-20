import { DatabaseService } from './types';
import { User, Task, Team, Performance, AutomaticTask, TaskAssignmentLog } from '../types';
import { supabase, supabaseAdmin } from '@/integrations/supabase/client';
import { v4 as uuidv4 } from 'uuid';
import { doc, setDoc, collection, getDocs, query, where, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/firebase/firebaseConfig';
import { toast } from 'sonner';

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
    console.log('Fetching all users...');
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('role', { ascending: false }); // Order by role to put admins and team leads first
    
    if (error) {
      console.error('Error fetching users:', error);
      throw error;
    }
    
    if (!data) {
      console.log('No users found');
      return [];
    }
    
    console.log('Fetched users:', data);
    
    const users = data.map(user => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      team_id: user.team_id,
      avatar: user.avatar,
    }));
    
    console.log('Processed users:', users);
    return users;
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

      // Get current user's session to check permissions
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        throw new Error('Failed to get current user session');
      }

      if (session) {
        // Get current user's role and team
        const { data: currentUser, error: currentUserError } = await supabase
          .from('users')
          .select('role, team_id')
          .eq('id', session.user.id)
          .single();

        if (currentUserError) {
          throw new Error('Failed to get current user details');
        }

        // If current user is a team lead
        if (currentUser.role === 'team_lead') {
          // Team leads can only create team members
          if (userData.role !== 'team_member') {
            throw new Error('Team leads can only create team members');
          }
          // Force assign the team lead's team_id
          userData.team_id = currentUser.team_id;
        }
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
        // Create new user with UUID from auth
        const { data, error } = await supabase
          .from('users')
          .insert({
            id: authUserId, // Use the UUID from Supabase Auth
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
      // If user is being updated to team lead role, check if the team already has a lead
      if (updates.role === 'team_lead' && updates.team_id) {
        const { data: existingTeamLead, error: checkError } = await supabase
          .from('users')
          .select('*')
          .eq('team_id', updates.team_id)
          .eq('role', 'team_lead');

        if (checkError) {
          console.error('Error checking existing team lead:', checkError);
          throw checkError;
        }

        if (existingTeamLead && existingTeamLead.length > 0 && existingTeamLead[0].id !== id) {
          throw new Error('This team already has a team lead');
        }
      }

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

      // If user is made team lead, update the team's lead_id
      if (updates.role === 'team_lead' && updates.team_id) {
        const { error: teamError } = await supabase
          .from('teams')
          .update({ lead_id: id })
          .eq('id', updates.team_id);

        if (teamError) {
          console.error('Error updating team lead:', teamError);
          // Log error but don't throw as the user update was successful
        }
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
    try {
      if (!teamData.id) {
        teamData.id = `team-${Date.now()}`;
      }

      // If a team lead is being assigned, check if they're already a lead for another team
      if (teamData.leadId) {
        const { data: existingTeamLead, error: checkError } = await supabase
          .from('teams')
          .select('*')
          .eq('lead_id', teamData.leadId);

        if (checkError) {
          console.error('Error checking existing team lead:', checkError);
          throw checkError;
        }

        if (existingTeamLead && existingTeamLead.length > 0) {
          throw new Error('This user is already a team lead for another team');
        }
      }
      
      const { data, error } = await supabase
        .from('teams')
        .insert({
          id: teamData.id,
          name: teamData.name || '',
          lead_id: teamData.leadId || null,
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
    } catch (error) {
      console.error('Error in createTeam:', error);
      throw error;
    }
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
      // Get the current date
      const now = new Date();
      const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      // First get all completed tasks
      const { data: completedTasks, error: completedError } = await supabase
        .from('completed_tasks')
        .select(`
          *,
          assigned_to,
          completed_at,
          accepted_at,
          due_date,
          priority,
          status
        `);

      if (completedError) {
        console.error('Error fetching completed tasks:', completedError);
        throw completedError;
      }

      // Get all users
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('*');

      if (usersError) {
        console.error('Error fetching users:', usersError);
        throw usersError;
      }

      // Group completed tasks by user
      const userPerformance = users.map(user => {
        const userTasks = completedTasks.filter(task => task.assigned_to === user.id);
        
        if (userTasks.length === 0) {
          return {
            userId: user.id,
            completedTasks: 0,
            onTimeCompletion: 0,
            averageTaskDuration: 0,
            period: currentPeriod
          };
        }

        // Calculate metrics
        const totalTasks = userTasks.length;
        const onTimeTasks = userTasks.filter(task => {
          const completedDate = new Date(task.completed_at);
          const dueDate = new Date(task.due_date);
          return completedDate <= dueDate;
        }).length;

        // Calculate average duration (from assignment to completion)
        let totalDuration = 0;
        userTasks.forEach(task => {
          const createdDate = new Date(task.created_at);
          const completedDate = new Date(task.completed_at);
          const duration = completedDate.getTime() - createdDate.getTime();
          totalDuration += duration;
        });

        const averageDuration = totalTasks > 0 ? totalDuration / totalTasks : 0;
        const onTimePercentage = totalTasks > 0 ? (onTimeTasks / totalTasks) * 100 : 0;

        return {
          userId: user.id,
          completedTasks: totalTasks,
          onTimeCompletion: onTimePercentage,
          averageTaskDuration: averageDuration,
          period: currentPeriod
        };
      });

      return userPerformance;
    } catch (error) {
      console.error('Error in getPerformanceMetrics:', error);
      throw error;
    }
  }

  async getPerformanceByUserId(userId: string): Promise<Performance | null> {
    try {
      // Get the current period (YYYY-MM)
      const now = new Date();
      const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      // Get completed tasks for the user in the current period
      const { data: completedTasks, error: tasksError } = await supabase
        .from('completed_tasks')
        .select('*')
        .eq('assigned_to', userId)
        .gte('completed_at', `${currentPeriod}-01`) // Start of current month
        .lt('completed_at', `${now.getFullYear()}-${String(now.getMonth() + 2).padStart(2, '0')}-01`); // Start of next month

      if (tasksError) {
        console.error('Error fetching completed tasks:', tasksError);
        throw tasksError;
      }

      if (!completedTasks || completedTasks.length === 0) {
        // Return default values if no completed tasks
        return {
          userId,
          completedTasks: 0,
          onTimeCompletion: 0,
          averageTaskDuration: 0,
          period: currentPeriod
        };
      }

      // Calculate metrics
      const totalTasks = completedTasks.length;
      const onTimeTasks = completedTasks.filter(task => {
        const completedDate = new Date(task.completed_at);
        const dueDate = new Date(task.due_date);
        return completedDate <= dueDate;
      }).length;

      // Calculate average duration (from assignment to completion)
      let totalDuration = 0;
      completedTasks.forEach(task => {
        const createdDate = new Date(task.created_at);
        const completedDate = new Date(task.completed_at);
        const duration = completedDate.getTime() - createdDate.getTime();
        totalDuration += duration;
      });

      const averageDuration = totalTasks > 0 ? totalDuration / totalTasks : 0;
      const onTimePercentage = totalTasks > 0 ? (onTimeTasks / totalTasks) * 100 : 0;

      // Update or insert performance record
      const { data: performanceData, error: upsertError } = await supabase
        .from('performance')
        .upsert({
          user_id: userId,
          completed_tasks: totalTasks,
          on_time_completion: onTimePercentage,
          average_task_duration: averageDuration,
          period: currentPeriod
        })
        .select()
        .single();

      if (upsertError) {
        console.error('Error upserting performance data:', upsertError);
        throw upsertError;
      }

      return {
        userId: performanceData.user_id,
        completedTasks: performanceData.completed_tasks,
        onTimeCompletion: performanceData.on_time_completion,
        averageTaskDuration: performanceData.average_task_duration,
        period: performanceData.period
      };
    } catch (error) {
      console.error('Error in getPerformanceByUserId:', error);
      throw error;
    }
  }

  // Simplified updatePerformanceMetrics to use the new direct calculation
  async updatePerformanceMetrics(userId: string): Promise<void> {
    try {
      // This will now just call getPerformanceByUserId which handles the calculations
      await this.getPerformanceByUserId(userId);
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
          // If user already exists in auth, proceed with password reset
          if (createError.message.includes('already been registered')) {
            console.log('User already exists in auth, sending password reset email...');
            const { error: resetError } = await supabaseAdmin.auth.admin.generateLink({
              type: 'recovery',
              email: email.toLowerCase(),
              options: {
                redirectTo: `${window.location.origin}/auth/callback?type=recovery`
              }
            });

            if (resetError) {
              console.error('Error sending password reset email:', resetError);
              throw new Error('Failed to send password reset email');
            }
            return;
          }
          console.error('Error creating auth user:', createError);
          throw new Error('Failed to create auth user');
        }
        
        // Send invite email for new users
        const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
          email.toLowerCase(),
          {
            redirectTo: `${window.location.origin}/auth/callback?type=recovery`
          }
        );

        if (inviteError) {
          console.error('Error sending invite email:', inviteError);
          throw new Error('Failed to send invite email');
        }
      } else {
        // For existing users, send a password reset email
        console.log('User exists in auth, sending password reset email...');
        const { error: resetError } = await supabaseAdmin.auth.admin.generateLink({
          type: 'recovery',
          email: email.toLowerCase(),
          options: {
            redirectTo: `${window.location.origin}/auth/callback?type=recovery`
          }
        });

        if (resetError) {
          console.error('Error sending password reset email:', resetError);
          throw new Error('Failed to send password reset email');
        }
      }

      console.log('Email sent successfully to:', email);
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
    console.log('Fetching users for team:', teamId);
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('team_id', teamId);
    
    if (error) {
      console.error('Error fetching users by team ID:', error);
      throw error;
    }
    
    if (!data) {
      console.log('No users found for team:', teamId);
      return [];
    }
    
    console.log('Found users for team:', data);
    
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

      // Process tasks by team
      for (const task of automaticTasks) {
        const teamId = task.team_id;
        
        // Skip if no users available for this team
        if (!usersByTeam[teamId]?.length) continue;

        // Get the first available user from the task's team
        const userId = usersByTeam[teamId][0];

        try {
          // Get the user's auth ID from the users table
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('id', userId)
            .single();

          if (userError) {
            console.error('Error fetching user data:', userError);
            continue;
          }

          // Call the stored procedure to assign the task
          const { error: assignError } = await supabase
            .rpc('assign_automatic_task', {
              p_task_id: task.task_id,
              p_user_id: userData.id, // Use the user's actual ID from the database
              p_task_title: task.task_title,
              p_task_description: task.task_description || '',
              p_priority: task.priority,
              p_team_id: teamId,
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
          }
        } catch (error) {
          console.error('Error assigning task:', error);
          continue;
        }
      }
    } catch (error) {
      console.error('Error in checkAndAssignAutomaticTasks:', error);
      throw error;
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

  async deleteUser(userId: string, adminPassword: string): Promise<void> {
    try {
      // First, get the current user's email
      const { data: { user }, error: userGetError } = await supabase.auth.getUser();
      
      if (userGetError || !user?.email) {
        console.error('Failed to get current user:', userGetError);
        toast.error('Failed to verify admin credentials');
        throw new Error('Failed to get current user');
      }

      // Verify admin password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: adminPassword,
      });

      if (signInError) {
        console.error('Admin password verification failed:', signInError);
        toast.error('Invalid admin password');
        throw new Error('Invalid admin password');
      }

      // Get user details from the users table
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (userError || !userData) {
        console.error('Error fetching user:', userError);
        toast.error('User not found');
        throw new Error('User not found');
      }

      // Get the user's auth ID from auth.users
      const { data: authUsers, error: authListError } = await supabaseAdmin.auth.admin.listUsers();
      
      if (authListError) {
        console.error('Error listing auth users:', authListError);
        toast.error('Failed to verify user authentication');
        throw authListError;
      }

      // Find the auth user that matches our database user's email
      const authUser = authUsers.users.find(u => u.email === userData.email);
      
      if (!authUser) {
        console.error('Auth user not found for email:', userData.email);
        // Continue with database deletion even if auth user is not found
      } else {
        // Delete user from auth if found
        const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(authUser.id);

        if (authError) {
          console.error('Error deleting auth user:', authError);
          toast.error('Failed to delete user authentication');
          throw authError;
        }
      }

      // Get team members if the user is a team lead
      let teamMembers: User[] = [];
      if (userData.role === 'team_lead' && userData.team_id) {
        const { data: members, error: membersError } = await supabase
          .from('users')
          .select('*')
          .eq('team_id', userData.team_id)
          .eq('role', 'team_member');

        if (membersError) {
          console.error('Error fetching team members:', membersError);
        } else {
          teamMembers = members || [];
        }
      }

      // Start database transaction to delete user data
      const { data: transactionResult, error: transactionError } = await supabase.rpc('delete_user_transaction', {
        p_user_id: userId,
        p_user_role: userData.role,
        p_team_id: userData.team_id
      });

      if (transactionError) {
        console.error('Error in delete user transaction:', transactionError);
        toast.error('Failed to delete user');
        throw transactionError;
      }

      // If there's a new team lead, send notifications
      if (transactionResult && transactionResult.length > 0) {
        const { new_team_lead_id, new_team_lead_email } = transactionResult[0];
        
        if (new_team_lead_id) {
          // Notify the new team lead
          await supabase.from('notifications').insert({
            user_id: new_team_lead_id,
            title: 'Team Members Transferred',
            message: `You are now managing ${teamMembers.length} team members from ${userData.name}'s team.`,
            type: 'team_transfer'
          });

          // Notify each team member
          for (const member of teamMembers) {
            await supabase.from('notifications').insert({
              user_id: member.id,
              title: 'Team Lead Change',
              message: `Your team lead has changed. Your new team lead is ${new_team_lead_email}.`,
              type: 'team_transfer'
            });
          }
        }
      }

      toast.success('User deleted successfully');
    } catch (error) {
      console.error('Error in deleteUser:', error);
      throw error;
    }
  }
}

export const realDatabaseService = new RealDatabaseService();
