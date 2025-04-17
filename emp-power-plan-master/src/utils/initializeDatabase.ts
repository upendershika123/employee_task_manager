
import { checkAndSeedDatabase } from './seedDatabase';

export const initializeDatabase = async () => {
  try {
    await checkAndSeedDatabase();
    return true;
  } catch (error) {
    console.error('Failed to initialize database:', error);
    return false;
  }
};
