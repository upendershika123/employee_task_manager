import React, { useState } from 'react';
import { User, Team } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface DeleteUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (userId: string, adminPassword: string) => Promise<void>;
  users: User[];
  teams: Team[];
  currentUser: User;
}

const DeleteUserModal: React.FC<DeleteUserModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  users,
  teams,
  currentUser,
}) => {
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [adminPassword, setAdminPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleClose = () => {
    setSelectedUserId('');
    setAdminPassword('');
    setIsLoading(false);
    onClose();
  };

  const handleConfirm = async () => {
    if (!selectedUserId || !adminPassword) return;

    setIsLoading(true);
    try {
      await onConfirm(selectedUserId, adminPassword);
      handleClose();
    } catch (error) {
      setIsLoading(false);
    }
  };

  const selectedUser = users.find(user => user.id === selectedUserId);
  const userTeam = selectedUser ? teams.find(team => team.id === selectedUser.team_id) : null;

  // Filter out the current admin from the list
  const availableUsers = users.filter(user => user.id !== currentUser.id);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Delete User</DialogTitle>
          <DialogDescription>
            This action cannot be undone. Please be certain.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="user-select">Select User to Delete</Label>
            <Select
              value={selectedUserId}
              onValueChange={setSelectedUserId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a user" />
              </SelectTrigger>
              <SelectContent>
                {availableUsers.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name} ({user.role.replace('_', ' ')})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedUser && selectedUser.role === 'team_lead' && (
            <Alert variant="warning">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Warning</AlertTitle>
              <AlertDescription>
                This user is a Team Lead. Deleting them will require reassigning their team members to a new Team Lead.
              </AlertDescription>
            </Alert>
          )}

          {selectedUser && selectedUser.role === 'team_member' && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Note</AlertTitle>
              <AlertDescription>
                Any tasks assigned to this user will be redistributed among other team members.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="admin-password">Confirm Your Password</Label>
            <Input
              id="admin-password"
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              placeholder="Enter your admin password"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!selectedUserId || !adminPassword || isLoading}
          >
            {isLoading ? 'Deleting...' : 'Delete User'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DeleteUserModal; 