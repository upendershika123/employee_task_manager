import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../Auth/AuthContext';
import { realDatabaseService as databaseService } from '../../services/realDatabaseService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getInitials } from '@/utils/helpers';
import { toast } from 'sonner';
import { ArrowLeft, BarChart2, TrendingUp, Clock, CheckCircle, Award } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { User } from '@/types/index';
import { Performance, NormalizedPerformance } from '@/types/performance';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, BarChart, Bar } from 'recharts';

const UserPerformancePage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { userId } = useParams<{ userId: string }>();
  const [performanceData, setPerformanceData] = useState<NormalizedPerformance | null>(null);
  const [userData, setUserData] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Function to normalize a value between 0 and 1
  const normalizeValue = (value: number, min: number, max: number) => {
    if (max === min) return 1; // Handle edge case
    return (value - min) / (max - min);
  };

  // Function to safely format number with decimals
  const formatNumber = (value: number | undefined | null, decimals: number = 1): string => {
    if (value === undefined || value === null) return '0';
    return Number(value).toFixed(decimals);
  };

  // Function to calculate performance score
  const calculatePerformanceScore = (data: Performance[], currentData: Performance) => {
    // Find min and max values for normalization
    const minCompleted = Math.min(...data.map(d => d.completedTasks || 0));
    const maxCompleted = Math.max(...data.map(d => d.completedTasks || 0));
    const minDuration = Math.min(...data.map(d => d.averageTaskDuration || 0));
    const maxDuration = Math.max(...data.map(d => d.averageTaskDuration || 0));

    // Normalize values
    const normalizedCompleted = normalizeValue(currentData.completedTasks || 0, minCompleted, maxCompleted);
    const normalizedOnTime = (currentData.onTimeCompletion || 0) / 100; // Already in percentage
    const normalizedDuration = normalizeValue(currentData.averageTaskDuration || 0, minDuration, maxDuration);

    // Calculate weighted score (40% completed tasks, 30% on-time, 30% duration)
    const score = (
      0.4 * normalizedCompleted +
      0.3 * normalizedOnTime +
      0.3 * (1 - normalizedDuration) // Invert duration because lower is better
    );

    return score;
  };

  // Function to get performance category and color
  const getPerformanceCategory = (score: number): { category: string; color: string } => {
    if (score >= 0.85) return { category: 'Excellent', color: 'text-green-500' };
    if (score >= 0.70) return { category: 'Good', color: 'text-blue-500' };
    if (score >= 0.50) return { category: 'Average', color: 'text-yellow-500' };
    return { category: 'Needs Improvement', color: 'text-red-500' };
  };

  // Function to prepare data for the line chart
  const prepareLineChartData = (data: NormalizedPerformance) => {
    return [{
      name: data.userId,
      completedTasks: data.completedTasks || 0,
      onTimeCompletion: data.onTimeCompletion || 0,
      timeSpent: Math.abs(data.averageTaskDuration) / (1000 * 60 * 60), // Convert to hours
      performanceScore: data.normalizedScore * 100,
      tasksPerDay: data.completedTasks ? (data.completedTasks / 30) : 0,
      efficiency: data.onTimeCompletion * (1 - (Math.abs(data.averageTaskDuration) / (1000 * 60 * 60 * 24 * 30))),
      productivity: (data.completedTasks || 0) * (data.onTimeCompletion || 0) / 100
    }];
  };

  // Function to prepare data for the bar chart
  const prepareBarChartData = (data: NormalizedPerformance) => {
    return [{
      name: data.userId,
      completedTasks: data.completedTasks || 0,
      onTimeCompletion: data.onTimeCompletion || 0,
      performanceScore: data.normalizedScore * 100,
      efficiency: data.onTimeCompletion * (1 - (data.averageTaskDuration ? data.averageTaskDuration / (1000 * 60 * 60 * 24 * 30) : 0)),
      productivity: (data.completedTasks || 0) * (data.onTimeCompletion || 0) / 100
    }];
  };

  // Function to prepare data for the stacked bar chart
  const prepareStackedBarChartData = (data: NormalizedPerformance) => {
    return [{
      name: data.userId,
      highPriority: data.completedTasks ? Math.floor(data.completedTasks * 0.3) : 0,
      mediumPriority: data.completedTasks ? Math.floor(data.completedTasks * 0.5) : 0,
      lowPriority: data.completedTasks ? Math.floor(data.completedTasks * 0.2) : 0
    }];
  };

  // Function to prepare data for the radar chart
  const prepareRadarChartData = (data: NormalizedPerformance) => {
    return [
      {
        subject: 'Tasks Completed',
        A: data.completedTasks || 0,
        fullMark: Math.max(data.completedTasks || 0, 10)
      },
      {
        subject: 'On-Time %',
        A: data.onTimeCompletion || 0,
        fullMark: 100
      },
      {
        subject: 'Time Spent (hours)',
        A: Math.abs(data.averageTaskDuration) / (1000 * 60 * 60),
        fullMark: Math.max(Math.abs(data.averageTaskDuration) / (1000 * 60 * 60), 10)
      },
      {
        subject: 'Performance Score',
        A: data.normalizedScore * 100,
        fullMark: 100
      },
      {
        subject: 'Tasks/Day',
        A: data.completedTasks ? (data.completedTasks / 30) : 0,
        fullMark: Math.max(data.completedTasks ? (data.completedTasks / 30) : 0, 1)
      },
      {
        subject: 'Efficiency',
        A: data.onTimeCompletion * (1 - (Math.abs(data.averageTaskDuration) / (1000 * 60 * 60 * 24 * 30))),
        fullMark: 100
      }
    ];
  };

  // Custom tooltip for charts
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border rounded shadow-md">
          <p className="font-bold">{userData?.name || userId}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }}>
              {entry.name}: {entry.value.toFixed(1)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  useEffect(() => {
    const fetchUserPerformanceData = async () => {
      try {
        setIsLoading(true);
        if (!user || !userId) return;

        // Fetch user data
        const userInfo = await databaseService.getUserById(userId);
        setUserData(userInfo);

        // Fetch performance data
        const userPerf = await databaseService.getPerformanceByUserId(userId);
        if (userPerf) {
          const allPerf = await databaseService.getPerformanceMetrics();
          const score = calculatePerformanceScore(allPerf, userPerf);
          const { category, color } = getPerformanceCategory(score);
          
          setPerformanceData({
            ...userPerf,
            normalizedScore: score,
            performanceCategory: category,
            performanceColor: color
          });
        }
      } catch (error) {
        console.error('Error fetching user performance data:', error);
        toast.error('Failed to fetch user performance data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserPerformanceData();
  }, [user, userId]);

  const handleBackToPerformance = () => {
    navigate('/performance');
  };

  // If user is not logged in or is not authorized, redirect to dashboard
  if (!user) {
    navigate('/');
    return null;
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex items-center mb-6">
        <Button variant="outline" size="sm" onClick={handleBackToPerformance} className="mr-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Performance Overview
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">
          {userData ? `${userData.name}'s Performance Metrics` : 'User Performance Metrics'}
        </h1>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <p className="text-muted-foreground">Loading performance data...</p>
        </div>
      ) : !performanceData ? (
        <div className="text-center py-8">
          <p className="text-muted-foreground">No performance data available for this user.</p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Tasks Completed</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {performanceData.completedTasks || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Total completed tasks
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">On-Time Completion</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatNumber(performanceData.onTimeCompletion, 1)}%
                </div>
                <p className="text-xs text-muted-foreground">
                  Tasks completed on time
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Time Spent</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatNumber(Math.abs(performanceData.averageTaskDuration) / (1000 * 60 * 60), 1)} hours
                </div>
                <p className="text-xs text-muted-foreground">
                  Average time spent per task
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Performance Score</CardTitle>
                <Award className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatNumber(performanceData.normalizedScore * 100, 1)}%
                </div>
                <Progress value={performanceData.normalizedScore * 100} className="h-2" />
                <Badge className={performanceData.performanceColor}>
                  {performanceData.performanceCategory}
                </Badge>
              </CardContent>
            </Card>
          </div>

          {/* Performance Charts Matrix */}
          <div className="grid grid-cols-2 gap-6 mb-8">
            {/* Row 1: Bar Charts */}
            <Card>
              <CardHeader>
                <CardTitle>Performance Metrics</CardTitle>
                <CardDescription>Key performance indicators</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart 
                      data={prepareBarChartData(performanceData)}
                      margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis 
                        dataKey="name" 
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend verticalAlign="top" height={36} />
                      <Bar dataKey="performanceScore" name="Performance Score" fill="#8884d8" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="efficiency" name="Efficiency" fill="#82ca9d" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="productivity" name="Productivity" fill="#ffc658" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Task Priority Distribution</CardTitle>
                <CardDescription>Completed tasks by priority</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart 
                      data={prepareStackedBarChartData(performanceData)}
                      margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis 
                        dataKey="name" 
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend verticalAlign="top" height={36} />
                      <Bar dataKey="highPriority" name="High Priority" stackId="a" fill="#ff7300" />
                      <Bar dataKey="mediumPriority" name="Medium Priority" stackId="a" fill="#ffc658" />
                      <Bar dataKey="lowPriority" name="Low Priority" stackId="a" fill="#82ca9d" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Row 2: Existing Charts */}
            <Card>
              <CardHeader>
                <CardTitle>Performance Metrics</CardTitle>
                <CardDescription>Detailed performance breakdown</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart 
                      data={prepareRadarChartData(performanceData)}
                      margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                    >
                      <PolarGrid stroke="#f0f0f0" />
                      <PolarAngleAxis 
                        dataKey="subject" 
                        tick={{ fontSize: 12 }}
                        stroke="#666"
                      />
                      <PolarRadiusAxis 
                        angle={30} 
                        domain={[0, 100]} 
                        tick={{ fontSize: 12 }}
                        stroke="#666"
                      />
                      <Radar 
                        name="Performance" 
                        dataKey="A" 
                        stroke="#8884d8" 
                        fill="#8884d8" 
                        fillOpacity={0.6}
                        strokeWidth={2}
                      />
                      <Legend verticalAlign="top" height={36} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Task Completion Trends</CardTitle>
                <CardDescription>Overview of task completion metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart 
                      data={prepareLineChartData(performanceData)}
                      margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis 
                        dataKey="name" 
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend verticalAlign="top" height={36} />
                      <Line 
                        yAxisId="left"
                        type="monotone" 
                        dataKey="completedTasks" 
                        stroke="#8884d8" 
                        name="Completed Tasks"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                      <Line 
                        yAxisId="right"
                        type="monotone" 
                        dataKey="onTimeCompletion" 
                        stroke="#82ca9d" 
                        name="On-Time %"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                      <Line 
                        yAxisId="left"
                        type="monotone" 
                        dataKey="timeSpent" 
                        stroke="#ffc658" 
                        name="Time Spent (hours)"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                      <Line 
                        yAxisId="right"
                        type="monotone" 
                        dataKey="performanceScore" 
                        stroke="#ff7300" 
                        name="Performance Score"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                      <Line 
                        yAxisId="left"
                        type="monotone" 
                        dataKey="tasksPerDay" 
                        stroke="#00C49F" 
                        name="Tasks/Day"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
};

export default UserPerformancePage; 