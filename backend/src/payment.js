// Payment links. MOCKED for the demo (no Paytm keys). `upiLink` is a real upi:// deep link;
// `paytmMockLink` is a Paytm-styled https URL that is cosmetic only. Swap for a real
// Paytm payment-links call when keys arrive — only this file changes.
import { config } from './config.js';

export function upiLink(amount, note, ref) {
  const p = new URLSearchParams({
    pa: config.merchant.vpa,
    pn: config.merchant.name,
    am: Number(amount).toFixed(2),
    cu: 'INR',
    tn: note,
    tr: ref,
  });
  return `upi://pay?${p.toString()}`;
}

export function paytmMockLink(amount, ref) {
  return `https://paytm.me/pay/${ref}?am=${Number(amount).toFixed(2)}&pa=${encodeURIComponent(config.merchant.vpa)}`;
}
