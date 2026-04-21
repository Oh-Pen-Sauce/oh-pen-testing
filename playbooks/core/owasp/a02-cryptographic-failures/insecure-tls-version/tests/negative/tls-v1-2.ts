// Fixture: TLSv1.2 minVersion. Must NOT flag.
import https from "node:https";

export const agent = new https.Agent({
  minVersion: "TLSv1.2",
});
