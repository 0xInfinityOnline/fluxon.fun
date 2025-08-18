export interface User {
  id: string;
  email: string;
  preferredAiModel?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Metric {
  id: string;
  userId: string;
  date: Date;
  engagement?: number;
  impressions?: number;
  likes?: number;
  followers?: number;
  ctr?: number;
  createdAt: Date;
}

export interface Post {
  id: string;
  userId: string;
  content: string;
  hashtags?: string;
  publishedAt?: Date;
  engagementRate?: number;
  impressions?: number;
  likes?: number;
  createdAt: Date;
}

export interface AIAnalysis {
  id: string;
  userId: string;
  postId?: string;
  modelName: string;
  analysisType: string;
  recommendations: string;
  viralityScore?: number;
  createdAt: Date;
}
