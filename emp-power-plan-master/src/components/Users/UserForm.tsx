import React, { useState, useEffect } from 'react';
import { User, UserRole, Team } from '../../types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { 
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
} from '@/components/ui/form';
import { useDatabaseService } from '@/services/DatabaseServiceContext';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { UserPlus, Users } from 'lucide-react';

// Define schema for form validation
const userFormSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  email: z.string().email({ message: "Please enter a valid email address." }),
  role: z.enum(['admin', 'team_lead', 'team_member']),
  team_id: z.string().nullable().optional(),
  avatar: z.string().nullable().optional()
});

interface UserFormProps {
  onSubmit: (user: Partial<User>) => void;
  teams: Team[];
  currentUser: User;
  initialUser?: User;
}

const UserForm: React.FC<UserFormProps> = ({ 
  onSubmit, 
  teams, 
  currentUser, 
  initialUser 
}) => {
  const databaseService = useDatabaseService();
  const [availableTeams, setAvailableTeams] = useState<Team[]>([]);
  
  // Fetch teams on component mount
  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const fetchedTeams = await databaseService.getTeams();
        setAvailableTeams(fetchedTeams);
        console.log("Available teams:", fetchedTeams);
      } catch (error) {
        console.error('Error fetching teams:', error);
        toast.error("Failed to load teams. Please try again.");
      }
    };
    
    if (teams.length === 0) {
      fetchTeams();
    } else {
      setAvailableTeams(teams);
    }
  }, [databaseService, teams]);
  
  // Generate a unique ID for new users
  const defaultId = initialUser?.id || `user-${Date.now()}`;
  
  // Set up form with zod resolver
  const form = useForm<z.infer<typeof userFormSchema>>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      id: defaultId,
      name: initialUser?.name || '',
      email: initialUser?.email || '',
      role: initialUser?.role || 'team_member',
      team_id: initialUser?.team_id || (currentUser.role === 'team_lead' ? currentUser.team_id : null),
      avatar: initialUser?.avatar || null
    }
  });
  
  const isAdmin = currentUser.role === 'admin';
  const selectedRole = form.watch('role');
  
  const handleFormSubmit = async (values: z.infer<typeof userFormSchema>) => {
    try {
      // Construct the user object that matches the database schema
      const userData: Partial<User> = {
        id: values.id || `user-${Date.now()}`,
        name: values.name,
        email: values.email,
        role: values.role,
        team_id: values.role === 'admin' ? null : values.team_id || null,
        avatar: values.avatar || null
      };
      
      // Validate team selection for non-admin users
      if (values.role !== 'admin' && !values.team_id) {
        toast.error("Please select a team for non-admin users");
        return;
      }
      
      // Log the data being sent to the database
      console.log('Creating/updating user with data:', userData);
      
      // Submit the data to the parent component which will use databaseService
      onSubmit(userData);
      
      // Show success message
      toast.success(initialUser ? "User updated successfully" : "User added successfully");
    } catch (error) {
      console.error('Error submitting form:', error);
      toast.error("Failed to save user. Please try again.");
    }
  };

  const handleResendVerification = async () => {
    try {
      const email = form.getValues('email');
      await databaseService.sendVerificationEmail(email);
      toast.success('Verification email has been sent. Please check your inbox.');
    } catch (error) {
      console.error('Error resending verification email:', error);
      toast.error('Failed to send verification email. Please try again.');
    }
  };
  
  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {initialUser ? (
            <>
              <Users className="h-5 w-5" />
              Edit User
            </>
          ) : (
            <>
              <UserPlus className="h-5 w-5" />
              Add New User
            </>
          )}
        </CardTitle>
      </CardHeader>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleFormSubmit)}>
          <CardContent className="space-y-4">
            {/* ID Field */}
            <FormField
              control={form.control}
              name="id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>User ID</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="User ID"
                      {...field}
                      className="font-mono text-sm"
                    />
                  </FormControl>
                  <FormDescription>
                    Unique identifier for the user (auto-generated if blank)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Name Field */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter full name"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Email Field */}
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="Enter email address"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Avatar Field */}
            <FormField
              control={form.control}
              name="avatar"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Avatar URL (optional)</FormLabel>
                  <FormControl>
                    <Input
                      type="url"
                      placeholder="https://example.com/avatar.jpg"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Leave blank to use a generated avatar based on name
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Role Field */}
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {isAdmin && (
                        <SelectItem value="admin">Admin</SelectItem>
                      )}
                      <SelectItem value="team_lead">Team Lead</SelectItem>
                      <SelectItem value="team_member">Team Member</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Determines user permissions within the system
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Team Field - Only shown if role is not admin */}
            {selectedRole !== 'admin' && (
              <FormField
                control={form.control}
                name="team_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Team</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value || undefined}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select team" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {availableTeams.length > 0 ? (
                          availableTeams.map((team) => (
                            <SelectItem key={team.id} value={team.id}>
                              {team.name}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem key="no-teams" value="no-teams-available" disabled>
                            No teams available
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      The team this user will belong to
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </CardContent>
          
          <CardFooter className="flex justify-end space-x-2">
            {initialUser && (
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleResendVerification}
              >
                Resend Verification Email
              </Button>
            )}
            <Button type="submit" variant="default">
              {initialUser ? 'Update User' : 'Add User'}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
};

export default UserForm;
