// Fixture: Zod password schema with .min(4). Should flag.
import { z } from "zod";
export const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(4),
});
