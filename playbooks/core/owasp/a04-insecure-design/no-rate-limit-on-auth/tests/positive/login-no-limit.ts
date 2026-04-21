// Fixture: Express login handler with no rate-limit middleware. Should flag.
import express from "express";
const app = express();

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await db.users.findByEmail(email);
  if (user && (await bcrypt.compare(password, user.hash))) {
    return res.json({ token: sign(user.id) });
  }
  res.status(401).json({ error: "invalid" });
});
