
# Employee Task Management System

A comprehensive task management system for teams with role-based permissions and task tracking functionality.

## Features

- User authentication with role-based access control
- Task creation, assignment, and tracking
- Team management
- Performance metrics
- Dashboard with task statistics
- Task filtering and prioritization
- Admin can add team leads and team members
- Team leads can add team members to their team
- Task completion progress tracking for teams
- User profiles with detailed information
- Task analytics with visual charts
- Task prioritization system
- Team performance metrics

## Unique Features

- **Task Analytics Dashboard**: Visualize task distribution, priority, and status with interactive charts
- **User Profiles**: Click on any user to view detailed profile information
- **Smart Task Prioritization**: Automatically categorize tasks as urgent, upcoming, or overdue
- **Team Performance Tracking**: Monitor how effectively teams are completing tasks
- **Visual Task Completion Statistics**: Track progress with intuitive charts and graphs
- **Deadline Management**: Get visual indicators for approaching and overdue tasks

## Login Credentials

Use these credentials to test the application with different user roles:

### Admin User
- Email: admin@example.com
- Password: any password will work in this demo

### Team Lead
- Email: john@example.com (Product Development)
- Email: sarah@example.com (Marketing)
- Email: chris@example.com (Customer Support)
- Password: any password will work in this demo

### Team Member
- Email: alice@example.com, bob@example.com (Product Development)
- Email: mike@example.com, emily@example.com (Marketing)
- Email: david@example.com (Customer Support)
- Password: any password will work in this demo

## User Permissions

- **Admin**: Can add team leads and team members, view all tasks, and access all data
- **Team Lead**: Can add team members to their team, create tasks, and view all team tasks
- **Team Member**: Can view and update their own tasks

## Getting Started

1. Clone the repository
2. Install dependencies with `npm install`
3. Start the development server with `npm run dev`
4. Open your browser and navigate to the local URL shown in your terminal

## Technologies Used

- React
- TypeScript
- Tailwind CSS
- Shadcn UI Components
- Recharts for data visualization
- React Query for data management
- Vite for fast development

## Project Structure

- `/src/components/Tasks`: Task-related components
- `/src/components/Users`: User management components
- `/src/components/Dashboard`: Dashboard components
- `/src/components/Auth`: Authentication components
- `/src/types`: TypeScript type definitions
- `/src/utils`: Utility functions and mock data
