// Fixture: whole body spread into Object.assign and into a repository save. Should flag.
import { Request, Response } from 'express';
import { getRepository } from 'typeorm';
import { Account } from './entities/account';

export async function patchAccount(req: Request, res: Response) {
  const repo = getRepository(Account);
  const account = await repo.findOneByOrFail({ id: req.params.id });

  // Spreading the body is the same flaw as assigning it: ownerId and balance ride along.
  Object.assign(account, { ...req.body });
  await repo.save(account);

  return res.json(account);
}

export async function replaceAccount(req: Request, res: Response) {
  const repo = getRepository(Account);
  // The raw body is spread straight into the persisted object.
  const saved = await repo.save({ ...req.body });
  return res.status(201).json(saved);
}
