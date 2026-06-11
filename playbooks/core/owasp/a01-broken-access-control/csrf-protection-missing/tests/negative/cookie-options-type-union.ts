import express from "express";
import session from "express-session";

// Safe near-miss: a typings file / interface where the sameSite field is
// declared as a union of the ALLOWED string-literal values. The values
// appear here only as type members (each followed by a pipe), not as an
// applied misconfiguration, so the rules must skip the declaration.
export interface CookieOptions {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "none" | "lax" | "strict";
}

export interface LegacyCookieOptions {
  // boolean false is also a valid member of the union, again just a type
  sameSite: false | "lax" | "strict";
}

const app = express();

// And the runtime config is the safe form: SameSite=lax.
app.use(
  session({
    secret: process.env.SESSION_SECRET ?? "dev",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
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
