const API_URL = 'http://localhost:3001/api';

export async function fetchWithError(url: string, options: RequestInit = {}) {
  const response = await fetch(`${API_URL}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Something went wrong');
  }

  return data;
}

export const api = {
  // Auth
  login: (email: string, password: string) =>
    fetchWithError('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  // Metrics
  getMetrics: (userId: string, startDate: string, endDate: string) =>
    fetchWithError(`/analytics/metrics/${userId}?startDate=${startDate}&endDate=${endDate}`),

  // Posts
  getPosts: (userId: string) =>
    fetchWithError(`/analytics/posts/${userId}`),

  // AI Analysis
  analyzePost: (content: string, userId: string, modelName: string) =>
    fetchWithError('/ai/analyze-post', {
      method: 'POST',
      body: JSON.stringify({ content, userId, modelName }),
    }),

  getRecommendations: (userId: string) =>
    fetchWithError(`/ai/recommendations/${userId}`),
};
