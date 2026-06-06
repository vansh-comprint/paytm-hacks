import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// shadcn/registry class-merge helper (used by skiper-ui / 21st.dev components).
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
