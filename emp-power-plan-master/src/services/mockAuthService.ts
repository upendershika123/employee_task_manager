
import { AuthService } from './types';
import { User } from '../types';
import { mockDatabaseService } from './mockDatabaseService';
import { toast } from 'sonner';

class MockAuthService implements AuthService {
  private currentUser: User | null = null;

  async login(email: string, password: string): Promise<User | null> {
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Find user with matching email
      const user = await mockDatabaseService.getUserByEmail(email);
      
      if (user) {
        this.currentUser = user;
        // Store user in localStorage to persist session
        localStorage.setItem('empTaskUser', JSON.stringify(user));
        toast.success(`Welcome back, ${user.name}!`);
        return user;
      } else {
        throw new Error('Invalid credentials');
      }
    } catch (error) {
      console.error('Login error:', error);
      toast.error('Login failed. Please check your credentials.');
      throw error;
    }
  }

  async logout(): Promise<void> {
    this.currentUser = null;
    localStorage.removeItem('empTaskUser');
    toast.info('You have been logged out.');
  }

  async getCurrentUser(): Promise<User | null> {
    if (this.currentUser) {
      return { ...this.currentUser };
    }
    
    // Check if user is stored in localStorage
    const storedUser = localStorage.getItem('empTaskUser');
    if (storedUser) {
      this.currentUser = JSON.parse(storedUser);
      return { ...this.currentUser };
    }
    
    return null;
  }
}

export const mockAuthService = new MockAuthService();
