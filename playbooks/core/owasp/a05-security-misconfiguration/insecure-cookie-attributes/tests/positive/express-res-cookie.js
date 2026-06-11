// Express route issuing a session cookie with insecure attributes.
const express = require('express');
const router = express.Router();

router.post('/login', async (req, res) => {
  const user = await authenticate(req.body.email, req.body.password);
  const token = signSession(user.id);

  // httpOnly is disabled here, so any XSS on the site can read the session.
  res.cookie('sid', token, {
    httpOnly: false,
    secure: false,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60,
  });

  res.json({ ok: true });
});

module.exports = router;
