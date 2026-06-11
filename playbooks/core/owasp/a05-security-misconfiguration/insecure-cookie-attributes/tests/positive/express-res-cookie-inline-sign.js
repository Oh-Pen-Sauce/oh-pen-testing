// Express route issuing a session cookie whose value is produced by an inline
// function call. The options still disable httpOnly and secure, so this is the
// same vuln; the function call in the value argument must not hide it.
const express = require('express');
const router = express.Router();

router.post('/login', async (req, res) => {
  const user = await authenticate(req.body.email, req.body.password);

  // signSession(user.id) sits in the value argument, with the insecure
  // options right after it.
  res.cookie('sid', signSession(user.id), {
    httpOnly: false,
    secure: false,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60,
  });

  res.json({ ok: true });
});

module.exports = router;
