import { DatabaseService } from './types';
import { realDatabaseService } from './realDatabaseService';
import { mockDatabaseService } from './mockDatabaseService';

// Determine which database service to use based on environment or configuration
// We'll use the real database service connected to Supabase by default
const useMockDatabase = false; // Set to false to use real database by default

export const databaseService: DatabaseService = realDatabaseService;
