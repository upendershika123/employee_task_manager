import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../Auth/AuthContext';
import { realDatabaseService as databaseService } from '../../services/realDatabaseService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getInitials } from '@/utils/helpers';
import { toast } from 'sonner';
import { ArrowLeft, BarChart2, TrendingUp, Clock, CheckCircle, Award } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { User } from '@/types/index';
import { Performance, NormalizedPerformance } from '@/types/performance';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, BarChart, Bar } from 'recharts';

const PerformancePage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [performanceData, setPerformanceData] = useState<NormalizedPerformance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);

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
    const minDuration = Math.min(...data.map(d => Math.abs(d.averageTaskDuration || 0)));
    const maxDuration = Math.max(...data.map(d => Math.abs(d.averageTaskDuration || 0)));

    // Normalize values
    const normalizedCompleted = normalizeValue(currentData.completedTasks || 0, minCompleted, maxCompleted);
    const normalizedOnTime = (currentData.onTimeCompletion || 0) / 100; // Already in percentage
    const normalizedDuration = normalizeValue(Math.abs(currentData.averageTaskDuration || 0), minDuration, maxDuration);

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
  const prepareLineChartData = (data: NormalizedPerformance[]) => {
    // For team member view, return their individual data
    if (user?.role === 'team_member') {
      return data.map(perf => ({
        name: perf.userName || perf.userId,
        completedTasks: perf.completedTasks || 0,
        onTimeCompletion: perf.onTimeCompletion || 0,
        averageDuration: perf.averageTaskDuration ? perf.averageTaskDuration / (1000 * 60 * 60 * 24) : 0,
        performanceScore: perf.normalizedScore * 100,
        tasksPerDay: perf.completedTasks ? (perf.completedTasks / 30) : 0,
        efficiency: perf.onTimeCompletion * (1 - (perf.averageTaskDuration ? perf.averageTaskDuration / (1000 * 60 * 60 * 24 * 30) : 0)),
        productivity: (perf.completedTasks || 0) * (perf.onTimeCompletion || 0) / 100
      }));
    }

    // For admin view, calculate and return only the averages
    if (user?.role === 'admin') {
      const teamMembers = data.filter(perf => {
        const user = users.find(u => u.id === perf.userId);
        return user && user.role === 'team_member';
      });
      
      const teamLeads = data.filter(perf => {
        const user = users.find(u => u.id === perf.userId);
        return user && user.role === 'team_lead';
      });
      
      const result = [];
      
      // Calculate and add team members average
      if (teamMembers.length > 0) {
        result.push({
          name: 'Team Members Avg',
          completedTasks: teamMembers.reduce((sum, p) => sum + (p.completedTasks || 0), 0) / teamMembers.length,
          onTimeCompletion: teamMembers.reduce((sum, p) => sum + (p.onTimeCompletion || 0), 0) / teamMembers.length,
          averageDuration: teamMembers.reduce((sum, p) => sum + (p.averageTaskDuration || 0), 0) / teamMembers.length / (1000 * 60 * 60 * 24),
          performanceScore: teamMembers.reduce((sum, p) => sum + p.normalizedScore, 0) / teamMembers.length * 100,
          tasksPerDay: teamMembers.reduce((sum, p) => sum + (p.completedTasks || 0), 0) / teamMembers.length / 30,
          efficiency: teamMembers.reduce((sum, p) => sum + (p.onTimeCompletion || 0), 0) / teamMembers.length * (1 - (teamMembers.reduce((sum, p) => sum + (p.averageTaskDuration || 0), 0) / teamMembers.length / (1000 * 60 * 60 * 24 * 30))),
          productivity: teamMembers.reduce((sum, p) => sum + (p.completedTasks || 0) * (p.onTimeCompletion || 0) / 100, 0) / teamMembers.length
        });
      }
      
      // Calculate and add team leads average
      if (teamLeads.length > 0) {
        result.push({
          name: 'Team Leads Avg',
          completedTasks: teamLeads.reduce((sum, p) => sum + (p.completedTasks || 0), 0) / teamLeads.length,
          onTimeCompletion: teamLeads.reduce((sum, p) => sum + (p.onTimeCompletion || 0), 0) / teamLeads.length,
          averageDuration: teamLeads.reduce((sum, p) => sum + (p.averageTaskDuration || 0), 0) / teamLeads.length / (1000 * 60 * 60 * 24),
          performanceScore: teamLeads.reduce((sum, p) => sum + p.normalizedScore, 0) / teamLeads.length * 100,
          tasksPerDay: teamLeads.reduce((sum, p) => sum + (p.completedTasks || 0), 0) / teamLeads.length / 30,
          efficiency: teamLeads.reduce((sum, p) => sum + (p.onTimeCompletion || 0), 0) / teamLeads.length * (1 - (teamLeads.reduce((sum, p) => sum + (p.averageTaskDuration || 0), 0) / teamLeads.length / (1000 * 60 * 60 * 24 * 30))),
          productivity: teamLeads.reduce((sum, p) => sum + (p.completedTasks || 0) * (p.onTimeCompletion || 0) / 100, 0) / teamLeads.length
        });
      }
      
      return result;
    }
    
    // For team lead view, calculate and return only the average of their team members
    if (user?.role === 'team_lead') {
      // Filter data to only include team members from the team lead's team
      const teamMembers = data.filter(perf => {
        const teamUser = users.find(u => u.id === perf.userId);
        return teamUser && teamUser.role === 'team_member' && teamUser.teamId === user.teamId;
      });
      
      const result = [];
      
      // Calculate and add team members average
      if (teamMembers.length > 0) {
        result.push({
          name: 'Team Members Avg',
          completedTasks: teamMembers.reduce((sum, p) => sum + (p.completedTasks || 0), 0) / teamMembers.length,
          onTimeCompletion: teamMembers.reduce((sum, p) => sum + (p.onTimeCompletion || 0), 0) / teamMembers.length,
          averageDuration: teamMembers.reduce((sum, p) => sum + (p.averageTaskDuration || 0), 0) / teamMembers.length / (1000 * 60 * 60 * 24),
          performanceScore: teamMembers.reduce((sum, p) => sum + p.normalizedScore, 0) / teamMembers.length * 100,
          tasksPerDay: teamMembers.reduce((sum, p) => sum + (p.completedTasks || 0), 0) / teamMembers.length / 30,
          efficiency: teamMembers.reduce((sum, p) => sum + (p.onTimeCompletion || 0), 0) / teamMembers.length * (1 - (teamMembers.reduce((sum, p) => sum + (p.averageTaskDuration || 0), 0) / teamMembers.length / (1000 * 60 * 60 * 24 * 30))),
          productivity: teamMembers.reduce((sum, p) => sum + (p.completedTasks || 0) * (p.onTimeCompletion || 0) / 100, 0) / teamMembers.length
        });
      }
      
      return result;
    }
    
    // Default case (should not reach here)
    return data.map(perf => ({
      name: perf.userName || perf.userId,
      completedTasks: perf.completedTasks || 0,
      onTimeCompletion: perf.onTimeCompletion || 0,
      averageDuration: perf.averageTaskDuration ? perf.averageTaskDuration / (1000 * 60 * 60 * 24) : 0,
      performanceScore: perf.normalizedScore * 100,
      tasksPerDay: perf.completedTasks ? (perf.completedTasks / 30) : 0,
      efficiency: perf.onTimeCompletion * (1 - (perf.averageTaskDuration ? perf.averageTaskDuration / (1000 * 60 * 60 * 24 * 30) : 0)),
      productivity: (perf.completedTasks || 0) * (perf.onTimeCompletion || 0) / 100
    }));
  };

  // Function to prepare data for the bar chart
  const prepareBarChartData = (data: NormalizedPerformance[]) => {
    // For team member view, return their individual data
    if (user?.role === 'team_member') {
      return data.map(perf => ({
        name: perf.userName || perf.userId,
        completedTasks: perf.completedTasks || 0,
        onTimeCompletion: perf.onTimeCompletion || 0,
        performanceScore: perf.normalizedScore * 100,
        efficiency: perf.onTimeCompletion * (1 - (perf.averageTaskDuration ? perf.averageTaskDuration / (1000 * 60 * 60 * 24 * 30) : 0)),
        productivity: (perf.completedTasks || 0) * (perf.onTimeCompletion || 0) / 100
      }));
    }

    // For admin view, calculate and return only the averages
    if (user?.role === 'admin') {
      const teamMembers = data.filter(perf => {
        const user = users.find(u => u.id === perf.userId);
        return user && user.role === 'team_member';
      });
      
      const teamLeads = data.filter(perf => {
        const user = users.find(u => u.id === perf.userId);
        return user && user.role === 'team_lead';
      });
      
      const result = [];
      
      // Calculate and add team members average
      if (teamMembers.length > 0) {
        result.push({
          name: 'Team Members Avg',
          completedTasks: teamMembers.reduce((sum, p) => sum + (p.completedTasks || 0), 0) / teamMembers.length,
          onTimeCompletion: teamMembers.reduce((sum, p) => sum + (p.onTimeCompletion || 0), 0) / teamMembers.length,
          performanceScore: teamMembers.reduce((sum, p) => sum + p.normalizedScore, 0) / teamMembers.length * 100,
          efficiency: teamMembers.reduce((sum, p) => sum + (p.onTimeCompletion || 0), 0) / teamMembers.length * (1 - (teamMembers.reduce((sum, p) => sum + (p.averageTaskDuration || 0), 0) / teamMembers.length / (1000 * 60 * 60 * 24 * 30))),
          productivity: teamMembers.reduce((sum, p) => sum + (p.completedTasks || 0) * (p.onTimeCompletion || 0) / 100, 0) / teamMembers.length
        });
      }
      
      // Calculate and add team leads average
      if (teamLeads.length > 0) {
        result.push({
          name: 'Team Leads Avg',
          completedTasks: teamLeads.reduce((sum, p) => sum + (p.completedTasks || 0), 0) / teamLeads.length,
          onTimeCompletion: teamLeads.reduce((sum, p) => sum + (p.onTimeCompletion || 0), 0) / teamLeads.length,
          performanceScore: teamLeads.reduce((sum, p) => sum + p.normalizedScore, 0) / teamLeads.length * 100,
          efficiency: teamLeads.reduce((sum, p) => sum + (p.onTimeCompletion || 0), 0) / teamLeads.length * (1 - (teamLeads.reduce((sum, p) => sum + (p.averageTaskDuration || 0), 0) / teamLeads.length / (1000 * 60 * 60 * 24 * 30))),
          productivity: teamLeads.reduce((sum, p) => sum + (p.completedTasks || 0) * (p.onTimeCompletion || 0) / 100, 0) / teamLeads.length
        });
      }
      
      return result;
    }
    
    // For team lead view, calculate and return only the average of their team members
    if (user?.role === 'team_lead') {
      // Filter data to only include team members from the team lead's team
      const teamMembers = data.filter(perf => {
        const teamUser = users.find(u => u.id === perf.userId);
        return teamUser && teamUser.role === 'team_member' && teamUser.teamId === user.teamId;
      });
      
      const result = [];
      
      // Calculate and add team members average
      if (teamMembers.length > 0) {
        result.push({
          name: 'Team Members Avg',
          completedTasks: teamMembers.reduce((sum, p) => sum + (p.completedTasks || 0), 0) / teamMembers.length,
          onTimeCompletion: teamMembers.reduce((sum, p) => sum + (p.onTimeCompletion || 0), 0) / teamMembers.length,
          performanceScore: teamMembers.reduce((sum, p) => sum + p.normalizedScore, 0) / teamMembers.length * 100,
          efficiency: teamMembers.reduce((sum, p) => sum + (p.onTimeCompletion || 0), 0) / teamMembers.length * (1 - (teamMembers.reduce((sum, p) => sum + (p.averageTaskDuration || 0), 0) / teamMembers.length / (1000 * 60 * 60 * 24 * 30))),
          productivity: teamMembers.reduce((sum, p) => sum + (p.completedTasks || 0) * (p.onTimeCompletion || 0) / 100, 0) / teamMembers.length
        });
      }
      
      return result;
    }
    
    // Default case (should not reach here)
    return data.map(perf => ({
      name: perf.userName || perf.userId,
      completedTasks: perf.completedTasks || 0,
      onTimeCompletion: perf.onTimeCompletion || 0,
      performanceScore: perf.normalizedScore * 100,
      efficiency: perf.onTimeCompletion * (1 - (perf.averageTaskDuration ? perf.averageTaskDuration / (1000 * 60 * 60 * 24 * 30) : 0)),
      productivity: (perf.completedTasks || 0) * (perf.onTimeCompletion || 0) / 100
    }));
  };

  // Function to prepare data for the stacked bar chart
  const prepareStackedBarChartData = (data: NormalizedPerformance[]) => {
    // For team member view, return their individual data
    if (user?.role === 'team_member') {
      return data.map(perf => ({
        name: perf.userName || perf.userId,
        highPriority: perf.completedTasks ? Math.floor(perf.completedTasks * 0.3) : 0,
        mediumPriority: perf.completedTasks ? Math.floor(perf.completedTasks * 0.5) : 0,
        lowPriority: perf.completedTasks ? Math.floor(perf.completedTasks * 0.2) : 0
      }));
    }

    // For admin view, calculate and return only the averages
    if (user?.role === 'admin') {
      const teamMembers = data.filter(perf => {
        const user = users.find(u => u.id === perf.userId);
        return user && user.role === 'team_member';
      });
      
      const teamLeads = data.filter(perf => {
        const user = users.find(u => u.id === perf.userId);
        return user && user.role === 'team_lead';
      });
      
      const result = [];
      
      // Calculate and add team members average
      if (teamMembers.length > 0) {
        result.push({
          name: 'Team Members Avg',
          highPriority: teamMembers.reduce((sum, p) => sum + (p.completedTasks ? Math.floor(p.completedTasks * 0.3) : 0), 0) / teamMembers.length,
          mediumPriority: teamMembers.reduce((sum, p) => sum + (p.completedTasks ? Math.floor(p.completedTasks * 0.5) : 0), 0) / teamMembers.length,
          lowPriority: teamMembers.reduce((sum, p) => sum + (p.completedTasks ? Math.floor(p.completedTasks * 0.2) : 0), 0) / teamMembers.length
        });
      }
      
      // Calculate and add team leads average
      if (teamLeads.length > 0) {
        result.push({
          name: 'Team Leads Avg',
          highPriority: teamLeads.reduce((sum, p) => sum + (p.completedTasks ? Math.floor(p.completedTasks * 0.3) : 0), 0) / teamLeads.length,
          mediumPriority: teamLeads.reduce((sum, p) => sum + (p.completedTasks ? Math.floor(p.completedTasks * 0.5) : 0), 0) / teamLeads.length,
          lowPriority: teamLeads.reduce((sum, p) => sum + (p.completedTasks ? Math.floor(p.completedTasks * 0.2) : 0), 0) / teamLeads.length
        });
      }
      
      return result;
    }
    
    // For team lead view, calculate and return only the average of their team members
    if (user?.role === 'team_lead') {
      // Filter data to only include team members from the team lead's team
      const teamMembers = data.filter(perf => {
        const teamUser = users.find(u => u.id === perf.userId);
        return teamUser && teamUser.role === 'team_member' && teamUser.teamId === user.teamId;
      });
      
      const result = [];
      
      // Calculate and add team members average
      if (teamMembers.length > 0) {
        result.push({
          name: 'Team Members Avg',
          highPriority: teamMembers.reduce((sum, p) => sum + (p.completedTasks ? Math.floor(p.completedTasks * 0.3) : 0), 0) / teamMembers.length,
          mediumPriority: teamMembers.reduce((sum, p) => sum + (p.completedTasks ? Math.floor(p.completedTasks * 0.5) : 0), 0) / teamMembers.length,
          lowPriority: teamMembers.reduce((sum, p) => sum + (p.completedTasks ? Math.floor(p.completedTasks * 0.2) : 0), 0) / teamMembers.length
        });
      }
      
      return result;
    }
    
    // Default case (should not reach here)
    return data.map(perf => ({
      name: perf.userName || perf.userId,
      highPriority: perf.completedTasks ? Math.floor(perf.completedTasks * 0.3) : 0,
      mediumPriority: perf.completedTasks ? Math.floor(perf.completedTasks * 0.5) : 0,
      lowPriority: perf.completedTasks ? Math.floor(perf.completedTasks * 0.2) : 0
    }));
  };

  // Function to prepare data for the radar chart
  const prepareRadarChartData = (data: NormalizedPerformance) => {
    // For team lead view, we need to calculate the average of their team members
    if (user?.role === 'team_lead') {
      // Filter data to only include team members from the team lead's team
      const teamMembers = performanceData.filter(perf => {
        const teamUser = users.find(u => u.id === perf.userId);
        return teamUser && teamUser.role === 'team_member' && teamUser.teamId === user.teamId;
      });
      
      if (teamMembers.length > 0) {
        // Calculate average values
        const avgCompletedTasks = teamMembers.reduce((sum, p) => sum + (p.completedTasks || 0), 0) / teamMembers.length;
        const avgOnTimeCompletion = teamMembers.reduce((sum, p) => sum + (p.onTimeCompletion || 0), 0) / teamMembers.length;
        const avgTaskDuration = teamMembers.reduce((sum, p) => sum + (p.averageTaskDuration || 0), 0) / teamMembers.length;
        const avgScore = teamMembers.reduce((sum, p) => sum + p.normalizedScore, 0) / teamMembers.length;
        const avgTasksPerDay = avgCompletedTasks / 30;
        const avgEfficiency = avgOnTimeCompletion * (1 - (avgTaskDuration / (1000 * 60 * 60 * 24 * 30)));
        
        return [
          {
            subject: 'Tasks Completed',
            A: avgCompletedTasks,
            fullMark: Math.max(...performanceData.map(p => p.completedTasks || 0))
          },
          {
            subject: 'On-Time %',
            A: avgOnTimeCompletion,
            fullMark: 100
          },
          {
            subject: 'Avg Duration (days)',
            A: avgTaskDuration / (1000 * 60 * 60 * 24),
            fullMark: Math.max(...performanceData.map(p => p.averageTaskDuration ? p.averageTaskDuration / (1000 * 60 * 60 * 24) : 0))
          },
          {
            subject: 'Performance Score',
            A: avgScore * 100,
            fullMark: 100
          },
          {
            subject: 'Tasks/Day',
            A: avgTasksPerDay,
            fullMark: Math.max(...performanceData.map(p => p.completedTasks ? (p.completedTasks / 30) : 0))
          },
          {
            subject: 'Efficiency',
            A: avgEfficiency,
            fullMark: 100
          }
        ];
      }
    }
    
    // Default case (for team member and admin)
    return [
      {
        subject: 'Tasks Completed',
        A: data.completedTasks || 0,
        fullMark: Math.max(...performanceData.map(p => p.completedTasks || 0))
      },
      {
        subject: 'On-Time %',
        A: data.onTimeCompletion || 0,
        fullMark: 100
      },
      {
        subject: 'Avg Duration (days)',
        A: data.averageTaskDuration ? data.averageTaskDuration / (1000 * 60 * 60 * 24) : 0,
        fullMark: Math.max(...performanceData.map(p => p.averageTaskDuration ? p.averageTaskDuration / (1000 * 60 * 60 * 24) : 0))
      },
      {
        subject: 'Performance Score',
        A: data.normalizedScore * 100,
        fullMark: 100
      },
      {
        subject: 'Tasks/Day',
        A: data.completedTasks ? (data.completedTasks / 30) : 0,
        fullMark: Math.max(...performanceData.map(p => p.completedTasks ? (p.completedTasks / 30) : 0))
      },
      {
        subject: 'Efficiency',
        A: data.onTimeCompletion * (1 - (data.averageTaskDuration ? data.averageTaskDuration / (1000 * 60 * 60 * 24 * 30) : 0)),
        fullMark: 100
      }
    ];
  };

  // Function to get user name by ID
  const getUserNameById = (userId: string) => {
    if (userId === 'average') return 'Average';
    return `User ${userId}`;
  };

  // Function to handle user click for admin
  const handleUserClick = (userId: string) => {
    navigate(`/performance/${userId}`);
  };

  // Custom tooltip for charts
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border rounded shadow-md">
          <p className="font-bold">{getUserNameById(label)}</p>
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
    const fetchPerformanceData = async () => {
      try {
        setIsLoading(true);
        if (!user) return;

        // Fetch all users first to have them available for role filtering
        const allUsers = await databaseService.getUsers();
        setUsers(allUsers);

        let data: NormalizedPerformance[];
        if (user.role === 'team_member') {
          const userPerf = await databaseService.getPerformanceByUserId(user.id);
          if (userPerf) {
            const allPerf = await databaseService.getPerformanceMetrics();
            const score = calculatePerformanceScore(allPerf, userPerf);
            const { category, color } = getPerformanceCategory(score);
            data = [{
              ...userPerf,
              normalizedScore: score,
              performanceCategory: category,
              performanceColor: color,
              userName: user.name
            }];
          } else {
            data = [];
          }
        } else if (user.role === 'team_lead') {
          const allPerf = await databaseService.getPerformanceMetrics();
          const teamUsers = await databaseService.getUsersByTeamId(user.teamId!);
          data = teamUsers.map(teamUser => {
            const userPerf = allPerf.find(p => p.userId === teamUser.id);
            if (userPerf) {
              const score = calculatePerformanceScore(allPerf, userPerf);
              const { category, color } = getPerformanceCategory(score);
              return {
                ...userPerf,
                normalizedScore: score,
                performanceCategory: category,
                performanceColor: color,
                userName: teamUser.name
              };
            }
            return null;
          }).filter((item): item is NormalizedPerformance => item !== null);
        } else {
          // Admin view - calculate averages for all users
          const allPerf = await databaseService.getPerformanceMetrics();
          
          // Calculate individual performance scores
          const individualData = allPerf.map(perf => {
            const score = calculatePerformanceScore(allPerf, perf);
            const { category, color } = getPerformanceCategory(score);
            const user = allUsers.find(u => u.id === perf.userId);
            return {
              ...perf,
              normalizedScore: score,
              performanceCategory: category,
              performanceColor: color,
              userName: user?.name
            };
          });

          // Calculate average metrics
          if (individualData.length > 0) {
            const avgCompletedTasks = individualData.reduce((sum, p) => sum + (p.completedTasks || 0), 0) / individualData.length;
            const avgOnTimeCompletion = individualData.reduce((sum, p) => sum + (p.onTimeCompletion || 0), 0) / individualData.length;
            const avgTaskDuration = individualData.reduce((sum, p) => sum + (p.averageTaskDuration || 0), 0) / individualData.length;
            const avgScore = individualData.reduce((sum, p) => sum + p.normalizedScore, 0) / individualData.length;
            
            // Create a summary entry with average values
            const avgData: NormalizedPerformance = {
              userId: 'average',
              completedTasks: avgCompletedTasks,
              onTimeCompletion: avgOnTimeCompletion,
              averageTaskDuration: avgTaskDuration,
              period: 'all',
              normalizedScore: avgScore,
              performanceCategory: getPerformanceCategory(avgScore).category,
              performanceColor: getPerformanceCategory(avgScore).color,
              userName: 'Average'
            };
            
            // Store both the average and individual data
            data = [avgData, ...individualData];
          } else {
            data = [];
          }
        }

        setPerformanceData(data);
      } catch (error) {
        console.error('Error fetching performance data:', error);
        toast.error('Failed to fetch performance data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPerformanceData();
  }, [user]);

  const handleBackToDashboard = () => {
    navigate('/');
  };

  // If user is not logged in or is not authorized, redirect to dashboard
  if (!user) {
    navigate('/');
    return null;
  }

  // Add a table for team leads to show their team members' performance
  const renderTeamMembersTable = () => {
    if (user?.role !== 'team_lead') return null;
    
    // Filter data to only include team members from the team lead's team
    const teamMembers = performanceData.filter(perf => {
      const teamUser = users.find(u => u.id === perf.userId);
      return teamUser && teamUser.role === 'team_member' && teamUser.teamId === user.teamId;
    });
    
    if (teamMembers.length === 0) return null;
    
    return (
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Team Members Performance</CardTitle>
          <CardDescription>Performance metrics for your team members</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Tasks Completed</TableHead>
                  <TableHead>On-Time Completion</TableHead>
                  <TableHead>Avg Duration (days)</TableHead>
                  <TableHead>Performance Score</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teamMembers.map((perf) => (
                  <TableRow key={perf.userId} className="cursor-pointer hover:bg-muted/50" onClick={() => handleUserClick(perf.userId)}>
                    <TableCell className="font-medium">
                      <div className="flex items-center">
                        <Avatar className="h-8 w-8 mr-2">
                          <AvatarFallback>{getInitials(perf.userName || perf.userId)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div>{perf.userName || 'Unknown User'}</div>
                          <div className="text-xs text-muted-foreground">ID: {perf.userId}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{formatNumber(perf.completedTasks, 1)}</TableCell>
                    <TableCell>{formatNumber(perf.onTimeCompletion, 1)}%</TableCell>
                    <TableCell>{formatNumber(perf.averageTaskDuration / (1000 * 60 * 60 * 24), 1)}</TableCell>
                    <TableCell>
                      <div className="w-full">
                        <div className="text-sm font-medium">
                          {formatNumber(perf.normalizedScore * 100, 1)}%
                        </div>
                        <Progress value={perf.normalizedScore * 100} className="h-2" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={perf.performanceColor}>
                        {perf.performanceCategory}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" onClick={(e) => {
                        e.stopPropagation();
                        handleUserClick(perf.userId);
                      }}>
                        View Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="container mx-auto p-4">
      <div className="flex items-center mb-6">
        <Button variant="outline" size="sm" onClick={handleBackToDashboard} className="mr-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">
          {user.role === 'team_member' ? 'My Performance Metrics' : 'Team Performance Metrics'}
        </h1>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <p className="text-muted-foreground">Loading performance data...</p>
        </div>
      ) : performanceData.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-muted-foreground">No performance data available.</p>
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
                  {user.role === 'admin' || user.role === 'team_lead' ? formatNumber(performanceData[0].completedTasks, 1) : performanceData[0].completedTasks || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  {user.role === 'admin' || user.role === 'team_lead' ? 'Average completed tasks' : 'Total completed tasks'}
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
                  {formatNumber(performanceData[0].onTimeCompletion, 1)}%
                </div>
                <p className="text-xs text-muted-foreground">
                  {user.role === 'admin' || user.role === 'team_lead' ? 'Average on-time completion' : 'Tasks completed on time'}
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
                  {formatNumber(Math.abs(performanceData[0].averageTaskDuration) / (1000 * 60 * 60), 1)} hours
                </div>
                <p className="text-xs text-muted-foreground">
                  {user.role === 'admin' || user.role === 'team_lead' ? 'Average time spent per task' : 'Average time spent per task'}
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
                  {formatNumber(performanceData[0].normalizedScore * 100, 1)}%
                </div>
                <Progress value={performanceData[0].normalizedScore * 100} className="h-2" />
                <Badge className={performanceData[0].performanceColor}>
                  {performanceData[0].performanceCategory}
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
                        tickFormatter={getUserNameById}
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
                        tickFormatter={getUserNameById}
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
                      data={prepareRadarChartData(performanceData[0])}
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
                        tickFormatter={getUserNameById}
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
                        dataKey="averageDuration" 
                        stroke="#ffc658" 
                        name="Avg Duration (days)"
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

          {/* User List for Admin */}
          {user.role === 'admin' && performanceData.length > 1 && (
            <>
              {/* Team Leads Performance Table */}
              <Card className="mb-8">
                <CardHeader>
                  <CardTitle>Team Leads Performance</CardTitle>
                  <CardDescription>Click on a team lead to view their detailed performance</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>User</TableHead>
                          <TableHead>Tasks Completed</TableHead>
                          <TableHead>On-Time Completion</TableHead>
                          <TableHead>Avg Duration (days)</TableHead>
                          <TableHead>Performance Score</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {performanceData.slice(1)
                          .filter(perf => {
                            const user = users.find(u => u.id === perf.userId);
                            return user && user.role === 'team_lead';
                          })
                          .map((perf) => (
                            <TableRow key={perf.userId} className="cursor-pointer hover:bg-muted/50" onClick={() => handleUserClick(perf.userId)}>
                              <TableCell className="font-medium">
                                <div className="flex items-center">
                                  <Avatar className="h-8 w-8 mr-2">
                                    <AvatarFallback>{getInitials(perf.userName || perf.userId)}</AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <div>{perf.userName || 'Unknown User'}</div>
                                    <div className="text-xs text-muted-foreground">ID: {perf.userId}</div>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>{formatNumber(perf.completedTasks, 1)}</TableCell>
                              <TableCell>{formatNumber(perf.onTimeCompletion, 1)}%</TableCell>
                              <TableCell>{formatNumber(perf.averageTaskDuration / (1000 * 60 * 60 * 24), 1)}</TableCell>
                              <TableCell>
                                <div className="w-full">
                                  <div className="text-sm font-medium">
                                    {formatNumber(perf.normalizedScore * 100, 1)}%
                                  </div>
                                  <Progress value={perf.normalizedScore * 100} className="h-2" />
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge className={perf.performanceColor}>
                                  {perf.performanceCategory}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Button variant="outline" size="sm" onClick={(e) => {
                                  e.stopPropagation();
                                  handleUserClick(perf.userId);
                                }}>
                                  View Details
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* Team Members Performance Table */}
              <Card className="mb-8">
                <CardHeader>
                  <CardTitle>Team Members Performance</CardTitle>
                  <CardDescription>Click on a team member to view their detailed performance</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>User</TableHead>
                          <TableHead>Tasks Completed</TableHead>
                          <TableHead>On-Time Completion</TableHead>
                          <TableHead>Avg Duration (days)</TableHead>
                          <TableHead>Performance Score</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {performanceData.slice(1)
                          .filter(perf => {
                            const user = users.find(u => u.id === perf.userId);
                            return user && user.role === 'team_member';
                          })
                          .map((perf) => (
                            <TableRow key={perf.userId} className="cursor-pointer hover:bg-muted/50" onClick={() => handleUserClick(perf.userId)}>
                              <TableCell className="font-medium">
                                <div className="flex items-center">
                                  <Avatar className="h-8 w-8 mr-2">
                                    <AvatarFallback>{getInitials(perf.userName || perf.userId)}</AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <div>{perf.userName || 'Unknown User'}</div>
                                    <div className="text-xs text-muted-foreground">ID: {perf.userId}</div>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>{formatNumber(perf.completedTasks, 1)}</TableCell>
                              <TableCell>{formatNumber(perf.onTimeCompletion, 1)}%</TableCell>
                              <TableCell>{formatNumber(perf.averageTaskDuration / (1000 * 60 * 60 * 24), 1)}</TableCell>
                              <TableCell>
                                <div className="w-full">
                                  <div className="text-sm font-medium">
                                    {formatNumber(perf.normalizedScore * 100, 1)}%
                                  </div>
                                  <Progress value={perf.normalizedScore * 100} className="h-2" />
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge className={perf.performanceColor}>
                                  {perf.performanceCategory}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Button variant="outline" size="sm" onClick={(e) => {
                                  e.stopPropagation();
                                  handleUserClick(perf.userId);
                                }}>
                                  View Details
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* Team Members Table for Team Leads */}
          {renderTeamMembersTable()}
        </>
      )}
    </div>
  );
};

export default PerformancePage; 