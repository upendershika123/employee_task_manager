
import React, { useState } from 'react';
import { User, Team } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Mail, Building, Calendar } from 'lucide-react';
import { getInitials } from '@/utils/helpers';

interface UserListProps {
  users: User[];
  teams: Team[];
  onViewProfile?: (userId: string) => void;
}

const UserList: React.FC<UserListProps> = ({ users, teams, onViewProfile }) => {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  
  const getTeamName = (teamId?: string) => {
    if (!teamId) return 'N/A';
    const team = teams.find(team => team.id === teamId);
    return team ? team.name : 'Unknown Team';
  };

  const getRoleBadgeVariant = (role: User['role']) => {
    switch (role) {
      case 'admin':
        return 'default';
      case 'team_lead':
        return 'outline';
      default:
        return 'secondary';
    }
  };
  
  const openUserProfile = (user: User) => {
    if (onViewProfile) {
      onViewProfile(user.id);
    } else {
      setSelectedUser(user);
    }
  };
  
  const closeUserProfile = () => {
    setSelectedUser(null);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Team</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-4 text-muted-foreground">
                    No team members available
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div 
                        className="flex items-center gap-3 cursor-pointer hover:underline"
                        onClick={() => openUserProfile(user)}
                      >
                        <Avatar>
                          <AvatarImage src={user.avatar} alt={user.name} />
                          <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{user.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge variant={getRoleBadgeVariant(user.role)}>
                        {user.role.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>{getTeamName(user.teamId)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      {!onViewProfile && (
        <Dialog open={!!selectedUser} onOpenChange={(open) => !open && closeUserProfile()}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>User Profile</DialogTitle>
              <DialogDescription>
                Detailed information about the team member
              </DialogDescription>
            </DialogHeader>
            
            {selectedUser && (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={selectedUser.avatar} alt={selectedUser.name} />
                    <AvatarFallback className="text-lg">{getInitials(selectedUser.name)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="text-lg font-medium">{selectedUser.name}</h3>
                    <Badge variant={getRoleBadgeVariant(selectedUser.role)} className="mt-1">
                      {selectedUser.role.replace('_', ' ')}
                    </Badge>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedUser.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Building className="h-4 w-4 text-muted-foreground" />
                    <span>Team: {getTeamName(selectedUser.teamId)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>Joined: {new Date().toLocaleDateString()}</span>
                  </div>
                </div>
                
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-2">Recent Activity</h4>
                  <p className="text-sm text-muted-foreground">No recent activity to display.</p>
                </div>
                
                <div className="flex justify-end">
                  <Button variant="outline" onClick={closeUserProfile}>Close</Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

export default UserList;
