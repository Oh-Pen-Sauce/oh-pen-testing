// Fixture: literal wildcard in cors() options. Should flag.
import cors from "cors";
import express from "express";
const app = express();

app.use(cors({ origin: "*", credentials: true }));
