import { Request, Response } from 'express';
import prisma from '../database';

export const getMetrics = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate } = req.query;

    const rows = await prisma.accountOverview.findMany({
      where: {
        userId: parseInt(String(userId), 10),
        date: {
          gte: startDate ? new Date(String(startDate)) : undefined,
          lte: endDate ? new Date(String(endDate)) : undefined,
        },
      },
      orderBy: { date: 'asc' },
      select: {
        date: true,
        impresiones: true,
        meGusta: true,
        interacciones: true,
        guardados: true,
        compartidos: true,
        nuevosSeguidores: true,
      },
    });

    res.json(rows);
  } catch (error) {
    console.error('Error fetching metrics:', error);
    res.status(500).json({ error: 'Error retrieving metrics' });
  }
};

export const getPostAnalytics = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit as string) || 10;

    const posts = await prisma.post.findMany({
      where: { userId: parseInt(String(userId), 10) },
      orderBy: { impresiones: 'desc' },
      take: limit,
      select: {
        postId: true,
        fecha: true,
        textoPost: true,
        urlPost: true,
        impresiones: true,
        meGusta: true,
        interacciones: true,
        guardados: true,
        compartidos: true,
        respuestas: true,
        reposts: true,
        visitasPerfil: true,
        analyses: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { recommendations: true, viralidadScore: true },
        },
      },
    });

    // Flatten the latest analysis fields to match previous response shape
    const rows = posts.map((p) => {
      const latest = (p as any).analyses?.[0] ?? {};
      let viralityScore: number | null = null;
      try {
        const v = latest.viralidadScore;
        viralityScore = v == null ? null : Number(v);
      } catch {
        viralityScore = null;
      }
      return {
        postId: p.postId != null ? String(p.postId as any) : null,
        fecha: p.fecha ?? null,
        textoPost: p.textoPost ?? null,
        urlPost: p.urlPost ?? null,
        impresiones: p.impresiones != null ? Number(p.impresiones as any) : 0,
        meGusta: p.meGusta != null ? Number(p.meGusta as any) : 0,
        interacciones: p.interacciones != null ? Number(p.interacciones as any) : 0,
        guardados: p.guardados != null ? Number(p.guardados as any) : 0,
        compartidos: p.compartidos != null ? Number(p.compartidos as any) : 0,
        respuestas: p.respuestas != null ? Number(p.respuestas as any) : 0,
        reposts: p.reposts != null ? Number(p.reposts as any) : 0,
        visitasPerfil: p.visitasPerfil != null ? Number(p.visitasPerfil as any) : 0,
        recommendations: latest.recommendations ?? null,
        virality_score: viralityScore,
      };
    });

    res.json(rows);
  } catch (error) {
    console.error('Error fetching post analytics:', error);
    res.status(500).json({ error: 'Error retrieving post analytics' });
  }
};
