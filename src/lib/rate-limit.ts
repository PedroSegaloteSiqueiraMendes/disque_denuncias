const bucket = new Map<string, { count: number; reset: number }>();
let calls = 0;
export function rateLimited(request: Request, scope: string, max: number, windowMs: number) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim();
  const address = request.headers.get("x-real-ip") ?? forwarded ?? "unknown";
  const key = `${scope}:${address}`; const now = Date.now(); const entry = bucket.get(key);
  if (++calls % 500 === 0) for (const [storedKey, value] of bucket) if (value.reset <= now) bucket.delete(storedKey);
  if (!entry || entry.reset <= now) { bucket.set(key, { count: 1, reset: now + windowMs }); return false; }
  entry.count += 1; return entry.count > max;
}
