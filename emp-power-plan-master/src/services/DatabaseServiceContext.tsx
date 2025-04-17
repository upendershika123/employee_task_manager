
import { createContext, useContext, ReactNode } from 'react';
import { DatabaseService } from './types';
import { databaseService } from './databaseServiceProvider';

// Create a context with the selected database service
export const DatabaseServiceContext = createContext<DatabaseService>(databaseService);

// Provider component
export const DatabaseServiceProvider = ({ children }: { children: ReactNode }) => {
  return (
    <DatabaseServiceContext.Provider value={databaseService}>
      {children}
    </DatabaseServiceContext.Provider>
  );
};

// Custom hook to use the database service
export const useDatabaseService = () => useContext(DatabaseServiceContext);
