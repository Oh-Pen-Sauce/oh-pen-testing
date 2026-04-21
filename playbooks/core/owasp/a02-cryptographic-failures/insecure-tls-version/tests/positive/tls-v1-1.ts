// Fixture: TLSv1.1 minVersion. Should flag.
import https from "node:https";

export const agent = new https.Agent({
  minVersion: "TLSv1.1_method",
});
