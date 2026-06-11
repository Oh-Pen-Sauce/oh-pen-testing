// Fixture: spreads and saves that use safe sources, not the raw body. Must NOT flag.
import { Request, Response } from 'express';
import { getRepository } from 'typeorm';
import { pick } from 'lodash';
import { Account } from './entities/account';

const defaults = { plan: 'free', timezone: 'UTC' };

export async function patchAccount(req: Request, res: Response) {
  const repo = getRepository(Account);
  const account = await repo.findOneByOrFail({ id: req.params.id });

  // A picked, allow-listed object is spread, never the whole body.
  const editable = pick(req.body, ['displayName', 'timezone']);
  Object.assign(account, { ...editable });
  await repo.save({ ...account });

  return res.json(account);
}

export async function seedAccount() {
  const repo = getRepository(Account);
  // Spreading a hard-coded literal with no untrusted source.
  return repo.save({ ...defaults, ownerId: 0, balance: 0 });
}
