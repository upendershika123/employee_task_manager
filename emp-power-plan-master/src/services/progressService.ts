import { TaskProgress } from '@/types';

const DEFAULT_REFERENCE_TEXT = `Software Development Task Guidelines

1. Requirements Analysis
- Understand and document user requirements
- Identify system constraints and dependencies
- Define acceptance criteria

2. Design and Implementation
- Create system architecture
- Write clean, maintainable code
- Follow best practices
- Implement error handling

3. Testing and Deployment
- Perform thorough testing
- Deploy to production
- Monitor system performance
- Document changes`;

export class ProgressService {
  private referenceText: string = DEFAULT_REFERENCE_TEXT;
  private isLoading: boolean = false;

  constructor() {
    this.loadReferenceText();
  }

  private async loadReferenceText() {
    if (this.isLoading) return;
    
    try {
      this.isLoading = true;
      const response = await fetch('/reference_texts/sample-task.txt');
      
      if (!response.ok) {
        console.warn('Using default reference text - could not load sample task file');
        return;
      }
      
      const text = await response.text();
      if (text && text.trim()) {
        this.referenceText = text;
        console.log('Successfully loaded reference text');
      }
    } catch (error) {
      console.warn('Using default reference text due to error:', error);
    } finally {
      this.isLoading = false;
    }
  }

  public compareText(userText: string): number {
    if (!userText) return 0;

    const normalizedReference = this.normalizeText(this.referenceText);
    const normalizedUser = this.normalizeText(userText);

    // Calculate progress based on content length and quality
    const lengthProgress = this.calculateLengthProgress(normalizedUser);
    const qualityProgress = this.calculateQualityProgress(normalizedUser, normalizedReference);
    
    // Combine both metrics with weights
    const totalProgress = (lengthProgress * 0.6) + (qualityProgress * 0.4);
    return Math.min(100, Math.max(0, Math.round(totalProgress)));
  }

  private calculateLengthProgress(text: string): number {
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const minWords = 50;  // Minimum words for partial progress
    const targetWords = 200;  // Target words for full progress
    
    return Math.min(100, (words.length / targetWords) * 100);
  }

  private calculateQualityProgress(userText: string, referenceText: string): number {
    const userWords = new Set(userText.split(/\s+/));
    const referenceWords = new Set(referenceText.split(/\s+/));
    
    let matches = 0;
    for (const word of userWords) {
      if (referenceWords.has(word)) matches++;
    }
    
    return (matches / referenceWords.size) * 100;
  }

  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[.,!?;:'"()\n\r]/g, ' ')  // Replace punctuation with spaces
      .replace(/\s+/g, ' ')               // Normalize spaces
      .trim();
  }

  public async saveProgress(progress: TaskProgress): Promise<void> {
    try {
      // Save to database using your database service
      console.log('Saving progress:', progress);
    } catch (error) {
      console.error('Error saving progress:', error);
      throw error;
    }
  }
}

export const progressService = new ProgressService(); 