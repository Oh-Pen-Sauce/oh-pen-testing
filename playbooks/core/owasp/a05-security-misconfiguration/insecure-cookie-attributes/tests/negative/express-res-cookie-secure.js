// Safe near-miss: the same res.cookie API, but with all protections enabled.
const express = require('express');
const router = express.Router();

router.post('/login', async (req, res) => {
  const user = await authenticate(req.body.email, req.body.password);
  const token = signSession(user.id);

  res.cookie('sid', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 1000 * 60 * 60,
  });

  res.json({ ok: true });
});

module.exports = router;
