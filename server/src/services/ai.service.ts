import { AIAnalysis, AIModelConfig, AIResponse } from '../types/ai.types';
import fetch from 'node-fetch';

// Different AI model implementations
const deepseekModel: AIModelConfig = {
  name: 'deepseek',
  endpoint: 'https://api.deepseek.com/v1/chat/completions',
  async analyzeText(text: string): Promise<AIAnalysis> {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'user',
            content: `Analiza el siguiente texto para redes sociales y proporciona recomendaciones para mejorarlo. El texto es: ${text}`
          }
        ],
        temperature: 0.7,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      throw new Error(`DeepSeek API error: ${response.statusText}`);
    }

    const data = await response.json() as any;
    const analysis = data.choices?.[0]?.message?.content || 'No se pudo generar el análisis';
    
    // Extraer puntuación de viralidad del análisis (ejemplo básico)
    const viralityScore = Math.floor(Math.random() * 10) + 1; // Valor temporal
    
    return {
      recommendations: analysis,
      viralityScore
    };
  }
};

const mistralModel: AIModelConfig = {
  name: 'mistral',
  endpoint: process.env.MISTRAL_API_ENDPOINT || '',
  async analyzeText(text: string): Promise<AIAnalysis> {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        analysis_type: 'social_media'
      })
    });

    if (!response.ok) {
      throw new Error(`Mistral API error: ${response.statusText}`);
    }

    const data = await response.json() as any;
    const analysis = data.choices?.[0]?.message?.content || 'No se pudo generar el análisis';
    
    // Extraer puntuación de viralidad del análisis (ejemplo básico)
    const viralityScore = Math.floor(Math.random() * 10) + 1; // Valor temporal
    
    return {
      recommendations: analysis,
      viralityScore
    };
  }
};

// Map to store AI models
const aiModels = new Map<string, AIModelConfig>([
  ['deepseek', deepseekModel],
  ['mistral', mistralModel],
]);

export async function analyzeWithAI(content: string, modelName: string): Promise<AIAnalysis> {
  const model = aiModels.get(modelName.toLowerCase());
  
  if (!model) {
    throw new Error(`AI model ${modelName} not supported`);
  }

  try {
    return await model.analyzeText(content);
  } catch (error) {
    console.error(`Error analyzing with ${modelName}:`, error);
    throw new Error('AI analysis failed');
  }
}

export function getSupportedModels(): string[] {
  return Array.from(aiModels.keys());
}
