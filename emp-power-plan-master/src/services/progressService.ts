import { TaskProgress } from '@/types';

export class ProgressService {
  private referenceText: string = '';

  constructor() {
    this.loadReferenceText();
  }

  private async loadReferenceText() {
    try {
      const response = await fetch('/reference_texts/sample-task.txt');
      this.referenceText = await response.text();
    } catch (error) {
      console.error('Error loading reference text:', error);
      this.referenceText = '';
    }
  }

  public compareText(userText: string): number {
    if (!this.referenceText || !userText) return 0;

    const normalizedReference = this.normalizeText(this.referenceText);
    const normalizedUser = this.normalizeText(userText);

    // Always recalculate progress, regardless of previous state
    const referenceWords = normalizedReference.split(/\s+/);
    const userWords = normalizedUser.split(/\s+/);

    let maxMatchLength = 0;
    
    // Use sliding window approach to find best matching sequence
    for (let i = 0; i <= referenceWords.length - userWords.length; i++) {
      let currentMatches = 0;
      for (let j = 0; j < userWords.length; j++) {
        if (this.compareWords(referenceWords[i + j], userWords[j])) {
          currentMatches++;
        }
      }
      maxMatchLength = Math.max(maxMatchLength, currentMatches);
    }

    // Calculate and return progress percentage
    const progress = (maxMatchLength / referenceWords.length) * 100;
    return Math.min(100, Math.max(0, progress));
  }

  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[.,!?;:'"()\n\r]/g, ' ')  // Replace punctuation with spaces
      .replace(/\s+/g, ' ')               // Normalize spaces
      .trim();
  }

  private compareWords(word1: string, word2: string): boolean {
    // Allow for minor differences in words
    if (word1 === word2) return true;
    
    // Optional: Implement fuzzy matching for similar words
    // For example, using Levenshtein distance or other similarity metrics
    return false;
  }

  public async saveProgress(progress: TaskProgress): Promise<void> {
    try {
      // Save to database using your database service
      // This is a placeholder - implement actual database save
      console.log('Saving progress:', progress);
    } catch (error) {
      console.error('Error saving progress:', error);
      throw error;
    }
  }
}

export const progressService = new ProgressService(); 