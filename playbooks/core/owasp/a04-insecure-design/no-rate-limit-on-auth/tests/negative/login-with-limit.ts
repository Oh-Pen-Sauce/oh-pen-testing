// Fixture: Express login with express-rate-limit. Must NOT flag.
import express from "express";
import rateLimit from "express-rate-limit";
const app = express();

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5 });

app.post("/api/login", authLimiter, async (req, res) => {
  const { email, password } = req.body;
  const user = await db.users.findByEmail(email);
  if (user && (await bcrypt.compare(password, user.hash))) {
    return res.json({ token: sign(user.id) });
  }
  res.status(401).json({ error: "invalid" });
});
