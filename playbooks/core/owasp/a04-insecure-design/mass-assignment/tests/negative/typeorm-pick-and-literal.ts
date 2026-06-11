// Fixture: explicit pick before assign, plus a create from a literal object. Must NOT flag.
import { Request, Response } from 'express';
import { getRepository } from 'typeorm';
import { pick } from 'lodash';
import { Account } from './entities/account';

export async function patchAccount(req: Request, res: Response) {
  const repo = getRepository(Account);
  const account = await repo.findOneByOrFail({ id: req.params.id });

  // Only the editable fields are copied; ownerId and balance stay server-controlled.
  Object.assign(account, pick(req.body, ['displayName', 'timezone']));
  await repo.save(account);

  return res.json(account);
}

export async function seedSystemAccount() {
  const repo = getRepository(Account);
  return repo.save({ displayName: 'system', ownerId: 0, balance: 0 });
}
