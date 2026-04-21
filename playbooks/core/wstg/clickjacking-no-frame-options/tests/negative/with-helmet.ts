// Must NOT flag: Express app with helmet().
import express from "express";
import helmet from "helmet";
const app = express();
app.use(helmet());
app.get("/", (_, res) => res.send("<h1>Hello</h1>"));
app.listen(3000);
