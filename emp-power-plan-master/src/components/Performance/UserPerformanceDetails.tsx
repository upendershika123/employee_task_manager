import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../Auth/AuthContext';
import { useDatabaseService } from '@/services/DatabaseServiceContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { getInitials } from '@/utils/helpers';
import { toast } from 'sonner';
import { ArrowLeft, BarChart2, TrendingUp, Clock, CheckCircle, Calendar, Target } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface PerformanceData {
  id: string;
  user_id: string;
  tasks_completed: number;
  tasks_in_progress: number;
  tasks_pending: number;
  completion_rate: number;
  average_completion_time: number;
  created_at: string;
  updated_at: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string;
  teamId?: string;
}

interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  assignedTo: string;
  assignedBy: string;
  teamId: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

const UserPerformanceDetails: React.FC = () => {
  const { user } = useAuth();
  const databaseService = useDatabaseService();
  const navigate = useNavigate();
  const { userId } = useParams<{ userId: string }>();
  const [performanceData, setPerformanceData] = useState<PerformanceData | null>(null);
  const [userData, setUserData] = useState<User | null>(null);
  const [userTasks, setUserTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    const loadData = async () => {
      if (!userId) return;
      
      try {
        setLoading(true);
        
        // Fetch user data
        const { data: userResult, error: userError } = await databaseService.supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .single();
        
        if (userError) throw userError;
        setUserData(userResult);
        
        // Fetch performance data
        const { data: perfResult, error: perfError } = await databaseService.supabase
          .from('performance')
          .select('*')
          .eq('user_id', userId)
          .single();
        
        if (perfError) {
          console.error('Error fetching performance data:', perfError);
          // If no performance data exists, create a default entry
          setPerformanceData({
            id: '',
            user_id: userId,
            tasks_completed: 0,
            tasks_in_progress: 0,
            tasks_pending: 0,
            completion_rate: 0,
            average_completion_time: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        } else {
          setPerformanceData(perfResult);
        }
        
        // Fetch user tasks
        const { data: tasksResult, error: tasksError } = await databaseService.supabase
          .from('tasks')
          .select('*')
          .eq('assignedTo', userId);
        
        if (tasksError) throw tasksError;
        setUserTasks(tasksResult || []);
        
      } catch (error) {
        console.error('Error loading user performance data:', error);
        toast.error('Failed to load user performance data');
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [userId, databaseService]);

  const handleBackToPerformance = () => {
    navigate('/performance');
  };

  const calculateTaskCompletionTime = (task: Task) => {
    if (!task.completedAt || !task.createdAt) return 0;
    
    const completedDate = new Date(task.completedAt);
    const createdDate = new Date(task.createdAt);
    const diffTime = Math.abs(completedDate.getTime() - createdDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  };

  const getAverageCompletionTime = () => {
    if (!userTasks.length) return 0;
    
    const completedTasks = userTasks.filter(task => task.status === 'completed');
    if (!completedTasks.length) return 0;
    
    const totalDays = completedTasks.reduce((sum, task) => {
      return sum + calculateTaskCompletionTime(task);
    }, 0);
    
    return Math.round(totalDays / completedTasks.length);
  };

  const getTaskStatusDistribution = () => {
    const total = userTasks.length;
    if (!total) return { completed: 0, inProgress: 0, pending: 0 };
    
    const completed = userTasks.filter(task => task.status === 'completed').length;
    const inProgress = userTasks.filter(task => task.status === 'in_progress').length;
    const pending = userTasks.filter(task => task.status === 'pending').length;
    
    return {
      completed: Math.round((completed / total) * 100),
      inProgress: Math.round((inProgress / total) * 100),
      pending: Math.round((pending / total) * 100)
    };
  };

  const getTaskPriorityDistribution = () => {
    const total = userTasks.length;
    if (!total) return { high: 0, medium: 0, low: 0 };
    
    const high = userTasks.filter(task => task.priority === 'high').length;
    const medium = userTasks.filter(task => task.priority === 'medium').length;
    const low = userTasks.filter(task => task.priority === 'low').length;
    
    return {
      high: Math.round((high / total) * 100),
      medium: Math.round((medium / total) * 100),
      low: Math.round((low / total) * 100)
    };
  };

  const statusDistribution = getTaskStatusDistribution();
  const priorityDistribution = getTaskPriorityDistribution();
  const averageCompletionTime = getAverageCompletionTime();

  return (
    <div className="container mx-auto p-4">
      <div className="flex items-center mb-6">
        <Button variant="outline" size="sm" onClick={handleBackToPerformance} className="mr-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Performance
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">User Performance Details</h1>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <p className="text-muted-foreground">Loading user performance data...</p>
        </div>
      ) : userData ? (
        <>
          <div className="flex flex-col md:flex-row gap-6 mb-8">
            <Card className="md:w-1/3">
              <CardHeader>
                <div className="flex items-center">
                  <Avatar className="h-12 w-12 mr-4">
                    <AvatarImage src={userData.avatar} alt={userData.name} />
                    <AvatarFallback>{getInitials(userData.name)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle>{userData.name}</CardTitle>
                    <CardDescription>{userData.email}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium">Role</p>
                    <p className="text-sm text-muted-foreground">{userData.role.replace('_', ' ')}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Team ID</p>
                    <p className="text-sm text-muted-foreground">{userData.teamId || 'N/A'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="md:w-2/3 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{performanceData?.completion_rate || 0}%</div>
                  <Progress value={performanceData?.completion_rate || 0} className="h-2 mt-2" />
                  <p className="text-xs text-muted-foreground mt-1">
                    Task completion rate
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Average Completion Time</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{averageCompletionTime} days</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Time to complete tasks
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Tasks Completed</CardTitle>
                  <CheckCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{performanceData?.tasks_completed || 0}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Successfully completed tasks
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Tasks In Progress</CardTitle>
                  <BarChart2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{performanceData?.tasks_in_progress || 0}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Currently working on
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="tasks">Tasks</TabsTrigger>
              <TabsTrigger value="trends">Trends</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Task Status Distribution</CardTitle>
                    <CardDescription>
                      Breakdown of tasks by status
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-sm font-medium">Completed</span>
                          <span className="text-sm text-muted-foreground">{statusDistribution.completed}%</span>
                        </div>
                        <Progress value={statusDistribution.completed} className="h-2" />
                      </div>
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-sm font-medium">In Progress</span>
                          <span className="text-sm text-muted-foreground">{statusDistribution.inProgress}%</span>
                        </div>
                        <Progress value={statusDistribution.inProgress} className="h-2" />
                      </div>
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-sm font-medium">Pending</span>
                          <span className="text-sm text-muted-foreground">{statusDistribution.pending}%</span>
                        </div>
                        <Progress value={statusDistribution.pending} className="h-2" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Task Priority Distribution</CardTitle>
                    <CardDescription>
                      Breakdown of tasks by priority
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-sm font-medium">High</span>
                          <span className="text-sm text-muted-foreground">{priorityDistribution.high}%</span>
                        </div>
                        <Progress value={priorityDistribution.high} className="h-2" />
                      </div>
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-sm font-medium">Medium</span>
                          <span className="text-sm text-muted-foreground">{priorityDistribution.medium}%</span>
                        </div>
                        <Progress value={priorityDistribution.medium} className="h-2" />
                      </div>
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-sm font-medium">Low</span>
                          <span className="text-sm text-muted-foreground">{priorityDistribution.low}%</span>
                        </div>
                        <Progress value={priorityDistribution.low} className="h-2" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Performance Summary</CardTitle>
                  <CardDescription>
                    Key performance indicators
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-center">
                      <Target className="h-8 w-8 mr-3 text-primary" />
                      <div>
                        <p className="text-sm font-medium">Efficiency Score</p>
                        <p className="text-2xl font-bold">
                          {Math.round((performanceData?.completion_rate || 0) * (1 - (averageCompletionTime / 30)))}%
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <Calendar className="h-8 w-8 mr-3 text-primary" />
                      <div>
                        <p className="text-sm font-medium">Tasks Per Week</p>
                        <p className="text-2xl font-bold">
                          {userTasks.length > 0 ? Math.round(userTasks.length / 4) : 0}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <CheckCircle className="h-8 w-8 mr-3 text-primary" />
                      <div>
                        <p className="text-sm font-medium">On-Time Completion</p>
                        <p className="text-2xl font-bold">
                          {userTasks.filter(task => task.status === 'completed' && calculateTaskCompletionTime(task) <= 7).length}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="tasks" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Tasks</CardTitle>
                  <CardDescription>
                    Tasks assigned to this user
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {userTasks.length === 0 ? (
                    <p className="text-muted-foreground">No tasks found for this user.</p>
                  ) : (
                    <div className="space-y-4">
                      {userTasks.map(task => (
                        <div key={task.id} className="flex items-start justify-between p-4 border rounded-lg">
                          <div>
                            <h3 className="font-medium">{task.title}</h3>
                            <p className="text-sm text-muted-foreground">{task.description}</p>
                            <div className="flex gap-2 mt-2">
                              <span className={`text-xs px-2 py-1 rounded-full ${
                                task.status === 'completed' ? 'bg-green-100 text-green-800' :
                                task.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                                'bg-yellow-100 text-yellow-800'
                              }`}>
                                {task.status.replace('_', ' ')}
                              </span>
                              <span className={`text-xs px-2 py-1 rounded-full ${
                                task.priority === 'high' ? 'bg-red-100 text-red-800' :
                                task.priority === 'medium' ? 'bg-orange-100 text-orange-800' :
                                'bg-green-100 text-green-800'
                              }`}>
                                {task.priority}
                              </span>
                            </div>
                          </div>
                          <div className="text-right text-sm text-muted-foreground">
                            <div>Created: {new Date(task.createdAt).toLocaleDateString()}</div>
                            {task.completedAt && (
                              <div>Completed: {new Date(task.completedAt).toLocaleDateString()}</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="trends" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Performance Trends</CardTitle>
                  <CardDescription>
                    Historical performance data
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64 flex items-center justify-center border rounded-lg">
                    <p className="text-muted-foreground">Performance trend charts will be displayed here.</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      ) : (
        <div className="flex justify-center items-center h-64">
          <p className="text-muted-foreground">User not found.</p>
        </div>
      )}
    </div>
  );
};

export default UserPerformanceDetails; 