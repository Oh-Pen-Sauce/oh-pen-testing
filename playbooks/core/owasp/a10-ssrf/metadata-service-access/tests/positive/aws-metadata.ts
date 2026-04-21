// Fixture: calling AWS metadata directly. Should flag.
export async function getRegion() {
  const res = await fetch("http://169.254.169.254/latest/meta-data/placement/region");
  return res.text();
}
