import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { User, Team } from '@/types';
import { getInitials } from '@/utils/helpers';

interface UserDetailsModalProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
  teams?: Team[];
  users?: User[];
}

const UserDetailsModal: React.FC<UserDetailsModalProps> = ({ user, isOpen, onClose, teams = [], users = [] }) => {
  if (!user) return null;

  const getTeamLead = () => {
    if (!user.teamId) return null;
    
    // Find the team the user belongs to
    const team = teams.find(t => t.id === user.teamId);
    if (!team) return null;
    
    // For team members, find the team lead with the same role
    if (user.role === 'team_member') {
      // Find all team leads
      const allTeamLeads = users.filter(u => u.role === 'team_lead');
      
      // First try to find a team lead in the same team
      const teamLeadInSameTeam = allTeamLeads.find(lead => lead.teamId === user.teamId);
      
      if (teamLeadInSameTeam) {
        return teamLeadInSameTeam;
      }
      
      // If no team lead in the same team, find a team lead with a matching role
      // Extract the role from the team name
      const teamName = team.name.toLowerCase();
      
      // Determine the role based on the team name
      let teamRole = '';
      if (teamName.includes('developer') || teamName.includes('dev')) {
        teamRole = 'developer';
      } else if (teamName.includes('tester') || teamName.includes('qa')) {
        teamRole = 'tester';
      } else if (teamName.includes('designer') || teamName.includes('ui') || teamName.includes('ux')) {
        teamRole = 'designer';
      } else if (teamName.includes('manager') || teamName.includes('pm')) {
        teamRole = 'manager';
      }
      
      // If we identified a team role, find a team lead with that role
      if (teamRole) {
        const matchingTeamLead = allTeamLeads.find(lead => {
          const leadName = lead.name.toLowerCase();
          return leadName.includes(teamRole);
        });
        
        if (matchingTeamLead) {
          return matchingTeamLead;
        }
      }
      
      // If still no match, use the team's leadId as a fallback
      return users.find(u => u.id === team.leadId);
    }
    
    // For non-team members, just return the team's lead
    return users.find(u => u.id === team.leadId);
  };

  const teamLead = getTeamLead();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>User Details</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center space-y-4 py-4">
          <Avatar className="h-20 w-20">
            <AvatarImage src={user.avatar} alt={user.name} />
            <AvatarFallback className="text-lg">{getInitials(user.name)}</AvatarFallback>
          </Avatar>
          <div className="text-center">
            <h3 className="text-lg font-semibold">{user.name}</h3>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
          <div className="w-full space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Role</span>
              <Badge variant="outline">{user.role.replace('_', ' ')}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">User ID</span>
              <span className="text-sm text-muted-foreground">{user.id}</span>
            </div>
            {user.teamId && (
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Team</span>
                <span className="text-sm text-muted-foreground">
                  {teams.find(t => t.id === user.teamId)?.name || user.teamId}
                </span>
              </div>
            )}
            {user.role === 'team_member' && teamLead && (
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Team Lead</span>
                <div className="flex items-center gap-2">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={teamLead.avatar} alt={teamLead.name} />
                    <AvatarFallback className="text-xs">{getInitials(teamLead.name)}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm">{teamLead.name}</span>
                </div>
              </div>
            )}
            {user.role === 'team_lead' && (
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Team Lead</span>
                <Badge variant="secondary">Yes</Badge>
              </div>
            )}
            {user.role === 'admin' && (
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Administrative Access</span>
                <Badge variant="secondary">Yes</Badge>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UserDetailsModal; 