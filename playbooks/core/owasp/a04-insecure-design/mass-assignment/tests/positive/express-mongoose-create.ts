// Fixture: Express + Mongoose binding the whole request body into the model. Should flag.
import { Request, Response } from 'express';
import { User } from '../models/user';

export async function register(req: Request, res: Response) {
  // The body is bound wholesale, so an attacker can add "role": "admin".
  const user = await User.create(req.body);
  return res.status(201).json({ id: user.id });
}

export async function updateProfile(req: Request, res: Response) {
  const updated = await User.findByIdAndUpdate(req.params.id, req.body, { new: true });
  return res.json(updated);
}
