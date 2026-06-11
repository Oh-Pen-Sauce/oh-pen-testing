import Koa from "koa";
import session from "koa-session";

const app = new Koa();
app.keys = [process.env.SESSION_SECRET ?? "dev"];

// Vulnerable: sameSite is turned off entirely on the session cookie,
// leaving every authenticated mutation open to cross-site forgery.
app.use(
  session(
    {
      key: "sid",
      httpOnly: true,
      sameSite: false,
    },
    app,
  ),
);

app.use(async (ctx) => {
  if (ctx.method === "POST" && ctx.path === "/settings") {
    saveSettings(ctx.session?.userId, ctx.request.body);
    ctx.body = { ok: true };
  }
});

function saveSettings(_userId: unknown, _body: unknown) {
  // ...
}

export default app;
