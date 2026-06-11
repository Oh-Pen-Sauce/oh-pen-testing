// Fixture: same Mongoose APIs, but fields are picked explicitly. Safe near-miss, must NOT flag.
import { Request, Response } from 'express';
import { pick } from 'lodash';
import { User } from '../models/user';

export async function register(req: Request, res: Response) {
  // Only the form fields are bound; role and isAdmin are never copied from the wire.
  const user = await User.create({
    name: req.body.name,
    email: req.body.email,
    passwordHash: hash(req.body.password),
  });
  return res.status(201).json({ id: user.id });
}

export async function updateProfile(req: Request, res: Response) {
  const data = pick(req.body, ['name', 'email']);
  const updated = await User.findByIdAndUpdate(req.params.id, data, { new: true });
  return res.json(updated);
}

declare function hash(input: unknown): string;
