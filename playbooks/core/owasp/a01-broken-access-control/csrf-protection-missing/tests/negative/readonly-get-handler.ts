import express from "express";
import session from "express-session";

const app = express();

// Safe: SameSite=strict session cookie, and the only route is a read-only
// GET. There is no state-changing surface for CSRF to target here.
app.use(
  session({
    secret: process.env.SESSION_SECRET ?? "dev",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
    },
  }),
);

app.get("/profile", (req, res) => {
  res.json(loadProfile(req.session.userId));
});

function loadProfile(_userId: string) {
  return { name: "example" };
}

export default app;
