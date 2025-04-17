import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User } from '@/types/index';
import { Performance } from '@/types/performance';
import { useDatabaseService } from '@/services/DatabaseServiceContext';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface PerformanceMetricsProps {
  users: User[];
  currentUser: User;
}

const PerformanceMetrics: React.FC<PerformanceMetricsProps> = ({ users, currentUser }) => {
  const databaseService = useDatabaseService();
  const [performanceData, setPerformanceData] = useState<Performance[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [availablePeriods, setAvailablePeriods] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchPerformanceData = async () => {
      try {
        setLoading(true);
        const data = await databaseService.getPerformanceMetrics();
        setPerformanceData(data);
        
        // Extract unique periods
        const periods = [...new Set(data.map(item => item.period))].sort().reverse();
        setAvailablePeriods(periods);
        
        // Set default selected period to the most recent one
        if (periods.length > 0 && !selectedPeriod) {
          setSelectedPeriod(periods[0]);
        }
      } catch (error) {
        console.error('Error fetching performance data:', error);
        toast.error('Failed to load performance data');
      } finally {
        setLoading(false);
      }
    };
    
    fetchPerformanceData();
  }, [databaseService]);

  // Filter performance data based on selected period
  const filteredData = selectedPeriod
    ? performanceData.filter(item => item.period === selectedPeriod)
    : performanceData;

  // Filter users based on current user's role
  const filteredUsers = currentUser.role === 'admin'
    ? users
    : currentUser.role === 'team_lead' && currentUser.teamId
      ? users.filter(u => u.teamId === currentUser.teamId)
      : [currentUser];

  // Prepare data for charts
  const chartData = filteredData.map(item => {
    const user = filteredUsers.find(u => u.id === item.userId);
    return {
      name: user ? user.name : 'Unknown User',
      completedTasks: item.completedTasks,
      onTimeCompletion: item.onTimeCompletion,
      timeSpent: Math.round(Math.abs(item.averageTaskDuration) / (1000 * 60 * 60)), // Convert to hours and ensure positive value
    };
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Performance Metrics</h2>
        {availablePeriods.length > 0 && (
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              {availablePeriods.map(period => (
                <SelectItem key={period} value={period}>
                  {new Date(period + '-01').toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <p>Loading performance data...</p>
        </div>
      ) : filteredData.length === 0 ? (
        <Card>
          <CardContent className="flex justify-center items-center h-64">
            <p>No performance data available for the selected period.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Completed Tasks</CardTitle>
                <CardDescription>Total number of completed tasks</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="completedTasks" fill="#4f46e5" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>On-Time Completion</CardTitle>
                <CardDescription>Percentage of tasks completed on time</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="onTimeCompletion" fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Average Time Spent</CardTitle>
                <CardDescription>Average time spent on tasks (hours)</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="timeSpent" fill="#f59e0b" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Detailed Performance Data</CardTitle>
              <CardDescription>Performance metrics for {selectedPeriod ? new Date(selectedPeriod + '-01').toLocaleDateString('en-US', { year: 'numeric', month: 'long' }) : 'all periods'}</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Completed Tasks</TableHead>
                    <TableHead>On-Time Completion</TableHead>
                    <TableHead>Time Spent (hours)</TableHead>
                    <TableHead>Period</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.map((item) => {
                    const user = filteredUsers.find(u => u.id === item.userId);
                    return (
                      <TableRow key={`${item.userId}-${item.period}`}>
                        <TableCell>{user ? user.name : 'Unknown User'}</TableCell>
                        <TableCell>{item.completedTasks}</TableCell>
                        <TableCell>{item.onTimeCompletion.toFixed(1)}%</TableCell>
                        <TableCell>{Math.round(Math.abs(item.averageTaskDuration) / (1000 * 60 * 60))} hours</TableCell>
                        <TableCell>{new Date(item.period + '-01').toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default PerformanceMetrics; 