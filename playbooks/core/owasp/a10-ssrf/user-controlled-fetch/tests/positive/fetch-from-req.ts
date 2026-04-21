// Fixture: fetch with template literal from req.body. Should flag.
export async function proxyFetch(req: any) {
  const res = await fetch(`${req.body.url}/data`);
  return res.json();
}
