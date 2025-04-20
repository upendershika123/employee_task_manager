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
      
      // Try loading from the public directory using relative path
      const publicPath = './reference_texts/sample-task.txt';
      console.log('Attempting to load reference text from:', publicPath);
      
      try {
        const response = await fetch(publicPath);
        
        if (response.ok) {
          const text = await response.text();
          if (text && text.trim()) {
            this.referenceText = text;
            console.log('Successfully loaded reference text from public path');
            return;
          }
        }
        
        console.warn('Could not load from relative path, trying absolute path:', {
          status: response.status,
          statusText: response.statusText,
          publicPath
        });
      } catch (fetchError) {
        console.warn('Error loading from relative path:', fetchError);
      }
      
      // Try with absolute path
      const absolutePath = '/reference_texts/sample-task.txt';
      console.log('Attempting to load from absolute path:', absolutePath);
      
      try {
        const absoluteResponse = await fetch(absolutePath);
        
        if (absoluteResponse.ok) {
          const text = await absoluteResponse.text();
          if (text && text.trim()) {
            this.referenceText = text;
            console.log('Successfully loaded reference text from absolute path');
            return;
          }
        }
        
        console.warn('Could not load from absolute path:', {
          status: absoluteResponse.status,
          statusText: absoluteResponse.statusText,
          absolutePath
        });
      } catch (fetchError) {
        console.warn('Error loading from absolute path:', fetchError);
      }
      
      // Try with BASE_URL as last resort
      const baseUrlPath = `${import.meta.env.BASE_URL || '/'}reference_texts/sample-task.txt`;
      console.log('Attempting to load from BASE_URL path:', baseUrlPath);
      
      try {
        const baseUrlResponse = await fetch(baseUrlPath);
        
        if (baseUrlResponse.ok) {
          const text = await baseUrlResponse.text();
          if (text && text.trim()) {
            this.referenceText = text;
            console.log('Successfully loaded reference text from BASE_URL path');
            return;
          }
        }
        
        console.warn('Failed to load reference text from all paths, using default:', {
          status: baseUrlResponse.status,
          statusText: baseUrlResponse.statusText,
          baseUrlPath
        });
      } catch (fetchError) {
        console.warn('Error loading from BASE_URL path:', fetchError);
      }
    } catch (error) {
      console.warn('Error in loadReferenceText:', error);
      console.log('Using default reference text');
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

  private normalizeText(text: string): string {
    return text.toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\s+/g, ' ')    // Normalize whitespace
      .trim();
  }

  private calculateLengthProgress(text: string): number {
    const minLength = 50;  // Minimum length for any progress
    const maxLength = 500; // Length for maximum progress
    
    if (text.length < minLength) return 0;
    return Math.min((text.length / maxLength) * 100, 100);
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