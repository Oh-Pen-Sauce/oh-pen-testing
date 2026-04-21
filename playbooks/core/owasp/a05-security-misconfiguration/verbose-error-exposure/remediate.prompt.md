## Playbook: verbose-error-exposure (remediate)

Log the detail server-side; return a generic message to the client.

```js
app.use((err, req, res, next) => {
  logger.error({ err, path: req.path }, "unhandled");
  const isDev = process.env.NODE_ENV === "development";
  res.status(500).json({
    error: "internal_error",
    message: isDev ? err.message : "Something went wrong.",
  });
});
```

Same idea for FastAPI: log full exception, return `{ "detail": "internal error" }` in prod.
