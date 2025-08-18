import { Request, Response } from 'express';
import { analyzeWithAI } from '../services/ai.service';
import prisma from '../database';

export const analyzePost = async (req: Request, res: Response) => {
  try {
    const { content, modelName } = req.body;
    const jwtUserId = (req as any).user?.userId as string | undefined;
    if (!jwtUserId) return res.status(401).json({ error: 'Unauthorized' });
    if (!content || typeof content !== 'string') return res.status(400).json({ error: 'content is required' });
    const uid = parseInt(jwtUserId, 10);
    
    // Get AI analysis
    const analysis = await analyzeWithAI(content, modelName);
    
    // Store analysis in database
    await prisma.aiAnalysis.create({
      data: {
        userId: uid,
        modelUsed: String(modelName ?? 'deepseek'),
        recommendations: String(analysis.recommendations ?? ''),
        viralidadScore: (analysis.viralityScore ?? null) as any,
      },
    });

    res.json({
      recommendations: analysis.recommendations,
      viralityScore: analysis.viralityScore
    });
  } catch (error) {
    console.error('Error analyzing post:', error);
    res.status(500).json({ error: 'Error analyzing post' });
  }
};

export const getRecommendations = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    
    const rows = await prisma.aiAnalysis.findMany({
      where: { userId: parseInt(String(userId), 10) },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { recommendations: true, viralidadScore: true, createdAt: true },
    });

    res.json(rows.map(r => ({
      recommendations: r.recommendations,
      viralityScore: (r as any).viralidadScore,
      createdAt: r.createdAt,
    })));
  } catch (error) {
    console.error('Error getting recommendations:', error);
    res.status(500).json({ error: 'Error retrieving recommendations' });
  }
};
