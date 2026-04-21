// Fixture: Express error handler returning err.stack. Should flag.
import express from "express";
const app = express();

app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  res.status(500).json({
    error: "failed",
    stack: err.stack,
  });
});
