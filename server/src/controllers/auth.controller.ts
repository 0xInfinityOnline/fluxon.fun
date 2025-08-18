import { Request, Response } from 'express';
import prisma from '../database';
import bcrypt from 'bcryptjs';
import { generateToken } from '../utils/auth';

export const register = async (req: Request, res: Response) => {
  try {
    const { username, email, password } = req.body as { username: string; email: string; password: string };
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'username, email and password are required' });
    }

    const existing = await prisma.user.findFirst({ where: { OR: [{ email }, { username }] } });
    if (existing) return res.status(409).json({ error: 'User already exists' });

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: { username, email, passwordHash },
      select: { userId: true, username: true, email: true, selectedAiModel: true, createdAt: true },
    });

    const token = generateToken({ userId: String(user.userId), email: user.email });
    res.status(201).json({ token, user });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as { email: string; password: string };
    if (!email || !password) return res.status(400).json({ error: 'email and password are required' });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    const token = generateToken({ userId: String(user.userId), email: user.email });
    res.json({ token, user: { userId: user.userId, username: user.username, email: user.email, selectedAiModel: user.selectedAiModel, createdAt: user.createdAt } });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
};
