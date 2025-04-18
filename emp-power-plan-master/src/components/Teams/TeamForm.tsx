import React from 'react';
import { Team, User } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

// Define schema for form validation
const teamFormSchema = z.object({
  name: z.string().min(2, { message: "Team name must be at least 2 characters." }),
  leadId: z.string().optional(),
});

interface TeamFormProps {
  onSubmit: (team: Partial<Team>) => void;
  availableLeads: User[];
}

const TeamForm: React.FC<TeamFormProps> = ({ onSubmit, availableLeads }) => {
  // Set up form with zod resolver
  const form = useForm<z.infer<typeof teamFormSchema>>({
    resolver: zodResolver(teamFormSchema),
    defaultValues: {
      name: '',
      leadId: '',
    }
  });

  const handleFormSubmit = async (values: z.infer<typeof teamFormSchema>) => {
    try {
      // Submit the data to the parent component
      const teamData: Partial<Team> = {
        name: values.name,
        ...(values.leadId ? { leadId: values.leadId } : {})
      };
      
      onSubmit(teamData);
      
      // Reset form
      form.reset();
      
      // Show success message
      toast.success("Team created successfully");
    } catch (error) {
      console.error('Error submitting form:', error);
      toast.error("Failed to create team. Please try again.");
    }
  };

  return (
    <Card>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleFormSubmit)}>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Team Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter team name"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="leadId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Team Lead (Optional)</FormLabel>
                  <FormControl>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a team lead (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableLeads.map((lead) => (
                          <SelectItem key={lead.id} value={lead.id}>
                            {lead.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                  <p className="text-sm text-muted-foreground mt-1">
                    You can also assign a team lead later when creating a new user with team lead role.
                  </p>
                </FormItem>
              )}
            />
          </CardContent>
          
          <CardFooter className="flex justify-end space-x-2">
            <Button type="submit">
              Create Team
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
};

export default TeamForm; 