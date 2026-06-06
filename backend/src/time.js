// Parse a normalized `when` phrase (produced by the router) into a fire time.
// The router normalizes Hindi time talk to one of these English shapes:
//   "in N minutes" | "in N hours" | "in N days" | "today HH:MM" | "tomorrow HH:MM"
// Falls back to parsing a bare "HH:MM" / "H baje".
export function parseWhen(phrase) {
  if (!phrase || typeof phrase !== 'string') return null;
  const p = phrase.trim().toLowerCase();
  const now = new Date();

  let m;
  if ((m = p.match(/in\s+(\d+)\s*min/))) return iso(addMs(now, +m[1] * 60000));
  if ((m = p.match(/in\s+(\d+)\s*hour/))) return iso(addMs(now, +m[1] * 3600000));
  if ((m = p.match(/in\s+(\d+)\s*day/))) return iso(addMs(now, +m[1] * 86400000));

  if ((m = p.match(/tomorrow\s+(\d{1,2}):(\d{2})/))) return iso(at(now, +m[1], +m[2], 1));
  // explicit "today" is honored as-is (fires on next tick if already past) — never silently rolled to tomorrow
  if ((m = p.match(/today\s+(\d{1,2}):(\d{2})/))) return iso(at(now, +m[1], +m[2], 0));
  // bare time / "H baje" is ambiguous → roll to tomorrow if already past
  if ((m = p.match(/(\d{1,2}):(\d{2})/))) return iso(rollIfPast(at(now, +m[1], +m[2], 0)));
  if ((m = p.match(/(\d{1,2})\s*baje/))) return iso(rollIfPast(at(now, +m[1], 0, 0)));
  return null;
}

const addMs = (d, ms) => new Date(d.getTime() + ms);
function at(base, h, min, dayOffset) {
  const d = new Date(base);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(h, min, 0, 0);
  return d;
}
// if the computed time is already in the past today, push to tomorrow
function rollIfPast(d) {
  return d.getTime() < Date.now() - 60000 ? new Date(d.getTime() + 86400000) : d;
}
const iso = (d) => d.toISOString();
