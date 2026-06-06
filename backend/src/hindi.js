// Best-effort Hindi number-word → integer. The LLM router normalizes most numbers
// (e.g. "pachaas" → 50); this is a fallback used only when the LLM leaves amount null.
const UNIT = {
  ek: 1, do: 2, teen: 3, tin: 3, char: 4, char4: 4, chaar: 4, paanch: 5, panch: 5,
  chhe: 6, che: 6, chha: 6, saat: 7, aath: 8, nau: 9, das: 10, dus: 10,
  gyaarah: 11, baarah: 12, bees: 20, biis: 20, pachees: 25, tees: 30, tis: 30,
  chalis: 40, chaalis: 40, pachaas: 50, pachas: 50, saath: 60, sattar: 70,
  assi: 80, assee: 80, nabbe: 90,
};
const SCALE = { sau: 100, so: 100, hazaar: 1000, hajaar: 1000, hazar: 1000, lakh: 100000, lac: 100000 };

// Handles patterns like: "paanch sau" -> 500, "do hazaar" -> 2000, "pachaas" -> 50,
// "do hazaar paanch sau" -> 2500, and bare digits "500".
export function hindiToNumber(text) {
  if (!text) return null;
  const digits = text.match(/\d[\d,]*/);
  if (digits) {
    const n = Number(digits[0].replace(/,/g, ''));
    if (Number.isFinite(n) && n > 0) return n;
  }
  const toks = text.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(Boolean);
  let total = 0, current = 0, seen = false;
  for (const t of toks) {
    if (t in UNIT) { current += UNIT[t]; seen = true; }
    else if (t in SCALE) {
      const s = SCALE[t];
      current = (current || 1) * s;
      if (s >= 1000) { total += current; current = 0; }
      seen = true;
    }
  }
  total += current;
  return seen && total > 0 ? total : null;
}
