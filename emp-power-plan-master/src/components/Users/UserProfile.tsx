import React, { useEffect, useState } from 'react';
import { User, Task } from '@/types';
import { useDatabaseService } from '@/services/DatabaseServiceContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { getInitials, calculateCompletionPercentage } from '@/utils/helpers';
import { format } from 'date-fns';
import UserStats from './UserStats';

interface UserProfileProps {
  userId: string;
  userTasks: Task[];
}

const UserProfile: React.FC<UserProfileProps> = ({ userId, userTasks }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const databaseService = useDatabaseService();
  
  useEffect(() => {
    const loadUser = async () => {
      try {
        const userData = await databaseService.getUserById(userId);
        setUser(userData);
      } catch (error) {
        console.error('Error loading user profile:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadUser();
  }, [userId, databaseService]);
  
  if (loading) {
    return <div className="flex justify-center p-4">Loading profile...</div>;
  }
  
  if (!user) {
    return <div className="text-center p-4">User not found</div>;
  }
  
  const completedTasks = userTasks.filter(task => task.status === 'completed');
  const pendingTasks = userTasks.filter(task => task.status === 'pending');
  const inProgressTasks = userTasks.filter(task => task.status === 'in_progress');
  const completionPercentage = calculateCompletionPercentage(completedTasks.length, userTasks.length);
  
  // Calculate task completion statistics for charts
  const taskCompletionData = [
    {
      name: user.name,
      completed: completedTasks.length,
      pending: pendingTasks.length,
      inProgress: inProgressTasks.length,
    }
  ];
  
  // Calculate performance by priority
  const highPriorityCompleted = completedTasks.filter(task => task.priority === 'high').length;
  const mediumPriorityCompleted = completedTasks.filter(task => task.priority === 'medium').length;
  const lowPriorityCompleted = completedTasks.filter(task => task.priority === 'low').length;
  
  const teamPerformance = [
    { name: 'High Priority', value: highPriorityCompleted },
    { name: 'Medium Priority', value: mediumPriorityCompleted },
    { name: 'Low Priority', value: lowPriorityCompleted },
  ];
  
  return (
    <div className="space-y-6 pt-4">
      <Card>
        <CardHeader className="flex flex-row items-center gap-4">
          <Avatar className="h-16 w-16">
            <AvatarImage src={user.avatar} alt={user.name} />
            <AvatarFallback className="text-lg">{getInitials(user.name)}</AvatarFallback>
          </Avatar>
          <div>
            <CardTitle className="text-xl">{user.name}</CardTitle>
            <CardDescription>{user.email}</CardDescription>
            <div className="mt-1 flex items-center gap-2">
              <Badge>{user.role.replace('_', ' ')}</Badge>
            </div>
          </div>
        </CardHeader>
      </Card>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Assigned Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userTasks.length}</div>
            <Progress value={completionPercentage} className="h-2 mt-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {completionPercentage}% completion rate
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Task Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-xs">Completed</span>
                <span className="text-xs font-bold">{completedTasks.length}</span>
              </div>
              <div className="w-full bg-green-100 rounded-full h-1.5">
                <div 
                  className="bg-green-500 h-1.5 rounded-full" 
                  style={{ width: `${(completedTasks.length / Math.max(userTasks.length, 1)) * 100}%` }}
                />
              </div>
              
              <div className="flex justify-between">
                <span className="text-xs">In Progress</span>
                <span className="text-xs font-bold">{inProgressTasks.length}</span>
              </div>
              <div className="w-full bg-yellow-100 rounded-full h-1.5">
                <div 
                  className="bg-yellow-500 h-1.5 rounded-full" 
                  style={{ width: `${(inProgressTasks.length / Math.max(userTasks.length, 1)) * 100}%` }}
                />
              </div>
              
              <div className="flex justify-between">
                <span className="text-xs">Pending</span>
                <span className="text-xs font-bold">{pendingTasks.length}</span>
              </div>
              <div className="w-full bg-red-100 rounded-full h-1.5">
                <div 
                  className="bg-red-500 h-1.5 rounded-full" 
                  style={{ width: `${(pendingTasks.length / Math.max(userTasks.length, 1)) * 100}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Last Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {completedTasks.length > 0 ? (
              <div>
                <p className="text-sm font-medium">Last completed task:</p>
                <p className="text-xs text-muted-foreground">
                  {completedTasks
                    .sort((a, b) => {
                      const dateA = a.completedAt ? new Date(a.completedAt).getTime() : 0;
                      const dateB = b.completedAt ? new Date(b.completedAt).getTime() : 0;
                      return dateB - dateA;
                    })[0].title}
                </p>
                <p className="text-xs mt-2">
                  {completedTasks[0].completedAt 
                    ? format(new Date(completedTasks[0].completedAt), 'MMM d, yyyy')
                    : 'Date unknown'}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No completed tasks yet</p>
            )}
          </CardContent>
        </Card>
      </div>
      
      <UserStats 
        taskCompletionData={taskCompletionData}
        teamPerformance={teamPerformance}
      />
      
      <Card>
        <CardHeader>
          <CardTitle>Recent Tasks</CardTitle>
        </CardHeader>
        <CardContent>
          {userTasks.length > 0 ? (
            <div className="space-y-4">
              {userTasks
                .sort((a, b) => {
                  const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
                  const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
                  return dateB - dateA;
                })
                .slice(0, 5)
                .map(task => (
                  <div key={task.id} className="flex items-start gap-2">
                    <div className={`h-3 w-3 mt-1.5 rounded-full ${
                      task.status === 'completed' ? 'bg-green-500' : 
                      task.status === 'in_progress' ? 'bg-yellow-500' : 'bg-red-500'
                    }`} />
                    <div>
                      <p className="text-sm font-medium">{task.title}</p>
                      <p className="text-xs text-muted-foreground">
                        Due: {task.dueDate ? format(new Date(task.dueDate), 'MMM d, yyyy') : 'No due date'}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No tasks assigned</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default UserProfile;
