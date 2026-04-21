// Fixture: CORS with explicit allowlist from env. Must NOT flag.
import cors from "cors";
import express from "express";
const app = express();

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? "").split(",");

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      cb(new Error("origin not allowed"));
    },
    credentials: true,
  }),
);
