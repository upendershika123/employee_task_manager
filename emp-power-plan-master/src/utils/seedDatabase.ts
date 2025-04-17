import { mockUsers, mockTeams, mockTasks } from './mockData';
import { supabaseAdmin } from '@/integrations/supabase/client';

export const seedDatabase = async () => {
  console.log('Seeding database with initial data...');
  
  try {
    // First, insert teams
    console.log('Inserting teams...');
    const { data: teamsData, error: teamsError } = await supabaseAdmin
      .from('teams')
      .insert(
        mockTeams.map(team => ({
          id: team.id,
          name: team.name,
          lead_id: team.leadId,
        }))
      );
    
    if (teamsError) {
      console.error('Error inserting teams:', teamsError);
      throw teamsError;
    }
    
    // Next, insert users
    console.log('Inserting users...');
    const { data: usersData, error: usersError } = await supabaseAdmin
      .from('users')
      .insert(
        mockUsers.map(user => ({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          team_id: user.teamId,
          avatar: user.avatar,
        }))
      );
    
    if (usersError) {
      console.error('Error inserting users:', usersError);
      throw usersError;
    }
    
    // Finally, insert tasks
    console.log('Inserting tasks...');
    const { data: tasksData, error: tasksError } = await supabaseAdmin
      .from('tasks')
      .insert(
        mockTasks.map(task => ({
          id: task.id,
          title: task.title,
          description: task.description,
          assigned_to: task.assignedTo,
          assigned_by: task.assignedBy,
          priority: task.priority,
          status: task.status,
          due_date: task.dueDate,
          created_at: task.createdAt,
          updated_at: task.updatedAt,
          completed_at: task.completedAt,
          team_id: task.teamId,
        }))
      );
    
    if (tasksError) {
      console.error('Error inserting tasks:', tasksError);
      throw tasksError;
    }
    
    console.log('Database seeded successfully!');
    return true;
  } catch (error) {
    console.error('Error seeding database:', error);
    return false;
  }
};

// Function to check if database is empty and needs seeding
export const checkAndSeedDatabase = async () => {
  try {
    // Check if we have any teams
    const { data: existingTeams, error: teamsError } = await supabaseAdmin
      .from('teams')
      .select('id')
      .limit(1);
    
    if (teamsError) throw teamsError;
    
    // If no teams exist, seed the database
    if (!existingTeams || existingTeams.length === 0) {
      return await seedDatabase();
    }
    
    console.log('Database already contains data, skipping seed.');
    return true;
  } catch (error) {
    console.error('Error checking database:', error);
    return false;
  }
};
