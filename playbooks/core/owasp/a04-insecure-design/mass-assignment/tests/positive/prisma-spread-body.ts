// Fixture: Prisma create with the whole body spread into the data object. Should flag.
import { Request, Response } from 'express';
import { prisma } from './db';

export async function createPost(req: Request, res: Response) {
  const post = await prisma.post.create({
    data: { ...req.body, createdAt: new Date() },
  });
  return res.status(201).json(post);
}
