export interface AIAnalysis {
  recommendations: string;
  viralityScore: number;
}

export interface AIModelConfig {
  name: string;
  endpoint: string;
  headers?: Record<string, string>;
  analyzeText: (text: string) => Promise<AIAnalysis>;
}

export interface AIResponse {
  recommendations: string;
  virality_score: number;
  [key: string]: any;
}
