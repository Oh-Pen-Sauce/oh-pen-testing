// Should flag: Express app with no helmet / frame options.
import express from "express";
const app = express();
app.get("/", (_, res) => res.send("<h1>Hello</h1>"));
app.listen(3000);
