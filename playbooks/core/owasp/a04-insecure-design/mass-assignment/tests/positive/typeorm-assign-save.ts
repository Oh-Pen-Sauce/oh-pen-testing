// Fixture: TypeORM-style handler copying the whole body onto a loaded entity, then saving. Should flag.
import { Request, Response } from 'express';
import { getRepository } from 'typeorm';
import { Account } from './entities/account';

export async function patchAccount(req: Request, res: Response) {
  const repo = getRepository(Account);
  const account = await repo.findOneByOrFail({ id: req.params.id });

  // Every key on the body lands on the entity, including ownerId and balance.
  Object.assign(account, req.body);
  await repo.save(account);

  return res.json(account);
}
