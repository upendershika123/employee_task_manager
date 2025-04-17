export interface Performance {
  userId: string;
  completedTasks: number;
  onTimeCompletion: number;
  averageTaskDuration: number;
  period: string;
}

export interface NormalizedPerformance extends Performance {
  normalizedScore: number;
  performanceCategory: string;
  performanceColor: string;
  userName?: string;
}
