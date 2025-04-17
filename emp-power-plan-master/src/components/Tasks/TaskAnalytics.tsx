
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { Task } from '../../types';

interface TaskAnalyticsProps {
  tasks: Task[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];
const STATUS_COLORS = {
  pending: '#f87171',
  in_progress: '#facc15',
  completed: '#4ade80'
};

const TaskAnalytics: React.FC<TaskAnalyticsProps> = ({ tasks }) => {
  // Calculate task by status distribution
  const tasksByStatus = [
    { name: 'Pending', value: tasks.filter(task => task.status === 'pending').length },
    { name: 'In Progress', value: tasks.filter(task => task.status === 'in_progress').length },
    { name: 'Completed', value: tasks.filter(task => task.status === 'completed').length }
  ];

  // Calculate task by priority distribution
  const tasksByPriority = [
    { name: 'High', value: tasks.filter(task => task.priority === 'high').length },
    { name: 'Medium', value: tasks.filter(task => task.priority === 'medium').length },
    { name: 'Low', value: tasks.filter(task => task.priority === 'low').length }
  ];

  // Generate weekly task data (simulated)
  const weeklyTaskData = [
    { name: 'Week 1', completed: 5, created: 8 },
    { name: 'Week 2', completed: 7, created: 6 },
    { name: 'Week 3', completed: 4, created: 9 },
    { name: 'Week 4', completed: 8, created: 5 }
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Tasks by Status</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={tasksByStatus}
                  cx="50%"
                  cy="50%"
                  labelLine={true}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {tasksByStatus.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tasks by Priority</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={tasksByPriority}
                  cx="50%"
                  cy="50%"
                  labelLine={true}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {tasksByPriority.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Weekly Task Progress</CardTitle>
        </CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={weeklyTaskData}
              margin={{
                top: 5,
                right: 30,
                left: 20,
                bottom: 5,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="created" stroke="#8884d8" activeDot={{ r: 8 }} />
              <Line type="monotone" dataKey="completed" stroke="#4ade80" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};

export default TaskAnalytics;
