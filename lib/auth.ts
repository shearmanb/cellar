// Write endpoints (e.g. Beacon posting to the pending queue) must send
// Authorization: Bearer <CELLAR_API_TOKEN>. Reads are open.
export function isAuthorized(req: Request): boolean {
  const token = process.env.CELLAR_API_TOKEN;
  if (!token) return false;
  const header = req.headers.get("authorization") ?? "";
  return header === `Bearer ${token}`;
}
