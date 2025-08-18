import { Request, Response } from 'express';
import csv from 'csv-parser';
import fs from 'fs';
import prisma from '../database';

export const processCSV = async (req: Request, res: Response) => {
  const jwtUserId = (req as any).user?.userId as string | undefined;
  if (!jwtUserId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const uploaded = req.file;
  if (!uploaded) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const results: any[] = [];

  const sep = detectDelimiter(uploaded.path)
  fs.createReadStream(uploaded.path)
    .pipe(csv({ separator: sep }))
    .on('data', (data) => results.push(data))
    .on('end', async () => {
      try {
        // Remove the temporary file
        fs.unlinkSync(uploaded.path);

        // Normalize headers for robust detection
        const normalized = results.map(normalizeRowKeys);
        const originalName = uploaded.originalname.toLowerCase();
        const looksOverview =
          originalName.includes('overview') ||
          hasAny(normalized[0], ['nuevos_seguidores', 'dejar_de_seguir', 'new_followers', 'unfollows', 'create_post']) ||
          (hasAny(normalized[0], ['impresiones', 'impressions']) && !hasAny(normalized[0], ['texto_post', 'texto_del_post', 'text', 'content']));

        let csvType: 'overview' | 'content' = looksOverview ? 'overview' : 'content';
        let imported = 0;
        if (csvType === 'overview') {
          imported = await processAccountOverviewData(normalized, jwtUserId);
        } else {
          imported = await processPostsData(normalized, jwtUserId);
        }

        // Record upload
        await prisma.csvUpload.create({
          data: {
            userId: parseInt(jwtUserId, 10),
            csvType,
            fileName: uploaded.originalname,
            rowsImported: imported,
          },
        });

        res.json({ message: 'CSV processed successfully', count: imported, type: csvType });
      } catch (error) {
        console.error('Error processing CSV:', error);
        res.status(500).json({ error: 'Error processing CSV file' });
      }
    });
};

function detectDelimiter(path: string): string {
  try {
    const buf = fs.readFileSync(path, { encoding: 'utf8' });
    const firstLine = buf.split(/\r?\n/)[0] || '';
    const commas = (firstLine.match(/,/g) || []).length;
    const semis = (firstLine.match(/;/g) || []).length;
    return semis > commas ? ';' : ',';
  } catch {
    return ',';
  }
}

export const getUploadPreview = async (req: Request, res: Response) => {
  try {
    const jwtUserId = (req as any).user?.userId as string | undefined;
    if (!jwtUserId) return res.status(401).json({ error: 'Unauthorized' });
    const userId = parseInt(jwtUserId, 10);
    const uploadId = BigInt(String(req.params.id));
    const type = (req.query.type as string) === 'overview' ? 'overview' : 'content';
    const limit = Math.min(parseInt(String(req.query.limit ?? '50'), 10) || 50, 200);

    const upload = await prisma.csvUpload.findFirst({ where: { uploadId, userId } });
    if (!upload) return res.status(404).json({ error: 'Upload not found' });

    const next = await prisma.csvUpload.findFirst({
      where: { userId, uploadedAt: { gt: upload.uploadedAt } },
      orderBy: { uploadedAt: 'asc' },
    });

    const start = upload.uploadedAt;
    const end = next?.uploadedAt;
    const createdAt: any = end ? { gte: start, lt: end } : { gte: start };

    if (type === 'overview') {
      const rows = await prisma.accountOverview.findMany({
        where: { userId, createdAt },
        orderBy: { createdAt: 'asc' },
        take: limit,
      });
      const out = rows.map((r) => ({
        overviewId: String(r.overviewId as any),
        date: r.date,
        impresiones: r.impresiones ?? 0,
        meGusta: r.meGusta ?? 0,
        interacciones: r.interacciones ?? 0,
        guardados: r.guardados ?? 0,
        compartidos: r.compartidos ?? 0,
        nuevosSeguidores: r.nuevosSeguidores ?? 0,
        respuestas: r.respuestas ?? 0,
        reposts: r.reposts ?? 0,
        visitasPerfil: r.visitasPerfil ?? 0,
        createdAt: r.createdAt,
      }));
      return res.json(out);
    } else {
      const rows = await prisma.post.findMany({
        where: { userId, createdAt },
        orderBy: { createdAt: 'asc' },
        take: limit,
      });
      const out = rows.map((p) => ({
        postId: String(p.postId as any),
        fecha: p.fecha,
        textoPost: p.textoPost,
        urlPost: p.urlPost,
        impresiones: p.impresiones ?? 0,
        meGusta: p.meGusta ?? 0,
        interacciones: p.interacciones ?? 0,
        guardados: p.guardados ?? 0,
        compartidos: p.compartidos ?? 0,
        respuestas: p.respuestas ?? 0,
        reposts: p.reposts ?? 0,
        visitasPerfil: p.visitasPerfil ?? 0,
        createdAt: p.createdAt,
      }));
      return res.json(out);
    }
  } catch (e) {
    console.error('Error getting upload preview:', e);
    res.status(500).json({ error: 'Error getting upload preview' });
  }
};

export const resetUserData = async (req: Request, res: Response) => {
  try {
    const jwtUserId = (req as any).user?.userId as string | undefined;
    if (!jwtUserId) return res.status(401).json({ error: 'Unauthorized' });

    const uid = parseInt(jwtUserId, 10);
    await prisma.aiAnalysis.deleteMany({ where: { userId: uid } as any });
    await prisma.post.deleteMany({ where: { userId: uid } });
    await prisma.accountOverview.deleteMany({ where: { userId: uid } });

    res.json({ ok: true });
  } catch (error) {
    console.error('Error resetting user data:', error);
    res.status(500).json({ error: 'Error resetting data' });
  }
};

async function processAccountOverviewData(data: any[], userId: string) {
  if (!userId) throw new Error('Missing userId');

  let count = 0;
  for (const row of data) {
    const dateVal = val(row, 'date', 'fecha');
    await prisma.accountOverview.create({
      data: {
        userId: parseInt(String(userId), 10),
        date: dateVal ? new Date(dateVal) : new Date(),
        impresiones: safeInt(val(row, 'impresiones', 'impressions')),
        meGusta: safeInt(val(row, 'me_gusta', 'likes')),
        interacciones: safeInt(val(row, 'interacciones', 'interactions', 'engagement', 'engagement_rate')),
        guardados: safeInt(val(row, 'guardados', 'saves')),
        compartidos: safeInt(val(row, 'compartidos', 'shares')),
        nuevosSeguidores: safeInt(val(row, 'nuevos_seguidores', 'new_followers')),
        dejarDeSeguir: safeInt(val(row, 'dejar_de_seguir', 'unfollows')),
        respuestas: safeInt(val(row, 'respuestas', 'replies')),
        reposts: safeInt(val(row, 'reposts', 'reposts')),
        visitasPerfil: safeInt(val(row, 'visitas_del_perfil', 'visitas_perfil', 'profile_visits')),
        createPost: safeInt(val(row, 'create_post', 'create_post')),
        reproduccionesVideo: safeInt(val(row, 'reproducciones_de_video', 'reproducciones_video', 'video_plays', 'video_views')),
        visualizacionesMultimedia: safeInt(val(row, 'visualizaciones_de_contenido_multimedia', 'visualizaciones_multimedia', 'media_views')),
      },
    });
    count++;
  }
  return count;
}

async function processPostsData(data: any[], userId: string) {
  if (!userId) throw new Error('Missing userId');

  let count = 0;
  for (const row of data) {
    const postId = safeBigInt(val(row, 'post_id', 'id_del_post', 'id', 'tweet_id', 'postid'));
    const dateVal = val(row, 'fecha', 'date', 'published_at', 'publishedat');
    await prisma.post.create({
      data: {
        postId,
        userId: parseInt(String(userId), 10),
        fecha: dateVal ? new Date(dateVal) : null,
        textoPost: val(row, 'texto_del_post', 'texto_post', 'text', 'content') ?? null,
        urlPost: val(row, 'postear_enlace', 'url_post', 'url', 'permalink') ?? null,
        impresiones: safeInt(val(row, 'impresiones', 'impressions')),
        meGusta: safeInt(val(row, 'me_gusta', 'likes')),
        interacciones: safeInt(val(row, 'interacciones', 'interactions', 'engagement', 'engagement_rate')),
        guardados: safeInt(val(row, 'guardados', 'saves')),
        compartidos: safeInt(val(row, 'compartidos', 'shares', 'retweets')),
        nuevosSeguidores: safeInt(val(row, 'nuevos_seguidores', 'new_followers')),
        respuestas: safeInt(val(row, 'respuestas', 'replies', 'comments')),
        reposts: safeInt(val(row, 'reposts', 'reposts')),
        visitasPerfil: safeInt(val(row, 'visitas_del_perfil', 'visitas_perfil', 'profile_visits')),
        detailExpands: safeInt(val(row, 'detail_expands', 'detail_expansions')),
        urlClicks: safeInt(val(row, 'url_clicks', 'link_clicks')),
        hashtagClicks: safeInt(val(row, 'hashtag_clicks', 'hashtag_clicks')),
        permalinkClicks: safeInt(val(row, 'permalink_clicks', 'permalink_clicks')),
      },
    });
    count++;
  }
  return count;
}

function safeInt(v: any): number | null {
  if (v === undefined || v === null || v === '') return null;
  const cleaned = String(v).trim()
    // remove thousands separators like 1.234 or 1 234
    .replace(/\u00A0/g, ' ')
    .replace(/[.\s]/g, '')
    // convert decimal comma to dot (for ints it will be truncated below)
    .replace(/,(\d+)/, '.$1');
  const n = parseFloat(cleaned);
  return Number.isNaN(n) ? null : Math.trunc(n);
}

function safeBigInt(v: any): bigint {
  try {
    if (typeof v === 'bigint') return v;
    if (v === undefined || v === null || v === '') throw new Error('missing post_id');
    return BigInt(String(v));
  } catch {
    // fallback to time-based unique id for missing/invalid values
    return BigInt(Date.now());
  }
}

// Helpers
function normalizeRowKeys(row: Record<string, any>) {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(row)) {
    const nk = normalizeKey(k);
    out[nk] = typeof v === 'string' ? v.trim() : v;
  }
  return out;
}

function normalizeKey(k: string) {
  return k
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[áàä]/g, 'a')
    .replace(/[éèë]/g, 'e')
    .replace(/[íìï]/g, 'i')
    .replace(/[óòö]/g, 'o')
    .replace(/[úùü]/g, 'u');
}

function hasAny(obj: Record<string, any>, keys: string[]) {
  return keys.some((k) => k in obj);
}

// Return the first non-empty value from normalized keys
function val(row: Record<string, any>, ...keys: string[]) {
  for (const k of keys) {
    const nk = normalizeKey(k);
    if (nk in row && row[nk] !== undefined && row[nk] !== null && row[nk] !== '') {
      return row[nk];
    }
  }
  return undefined;
}

export const listUploads = async (req: Request, res: Response) => {
  try {
    const jwtUserId = (req as any).user?.userId as string | undefined;
    if (!jwtUserId) return res.status(401).json({ error: 'Unauthorized' });
    const uploads = await prisma.csvUpload.findMany({
      where: { userId: parseInt(jwtUserId, 10) },
      orderBy: { uploadedAt: 'desc' },
      select: { uploadId: true, csvType: true, fileName: true, rowsImported: true, uploadedAt: true },
    });
    // ensure JSON-safe
    const rows = uploads.map((u) => ({
      uploadId: String(u.uploadId as any),
      csvType: u.csvType,
      fileName: u.fileName,
      rowsImported: u.rowsImported ?? 0,
      uploadedAt: u.uploadedAt,
    }));
    res.json(rows);
  } catch (e) {
    console.error('Error listing uploads:', e);
    res.status(500).json({ error: 'Error listing uploads' });
  }
};

export const deleteUpload = async (req: Request, res: Response) => {
  try {
    const jwtUserId = (req as any).user?.userId as string | undefined;
    if (!jwtUserId) return res.status(401).json({ error: 'Unauthorized' });
    const userId = parseInt(jwtUserId, 10);
    const uploadId = BigInt(String(req.params.id));

    const upload = await prisma.csvUpload.findFirst({ where: { uploadId, userId } });
    if (!upload) return res.status(404).json({ error: 'Upload not found' });

    // Determine time window [current.uploadedAt, next.upload.uploadedAt)
    const next = await prisma.csvUpload.findFirst({
      where: { userId, uploadedAt: { gt: upload.uploadedAt } },
      orderBy: { uploadedAt: 'asc' },
    });

    const start = upload.uploadedAt;
    const end = next?.uploadedAt;

    // Delete data created in that window
    const dateFilter: any = end ? { gte: start, lt: end } : { gte: start };
    await prisma.aiAnalysis.deleteMany({ where: { userId, createdAt: dateFilter } as any });
    await prisma.post.deleteMany({ where: { userId, createdAt: dateFilter } });
    await prisma.accountOverview.deleteMany({ where: { userId, createdAt: dateFilter } });

    // Delete upload record
    await prisma.csvUpload.delete({ where: { uploadId } });

    res.json({ ok: true });
  } catch (e) {
    console.error('Error deleting upload:', e);
    res.status(500).json({ error: 'Error deleting upload' });
  }
};
