// Fixture: generic error response, no stack. Must NOT flag.
import express from "express";
const app = express();

app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error({ err, path: req.path }, "unhandled");
  res.status(500).json({
    error: "internal_error",
    message: "Something went wrong.",
  });
});
