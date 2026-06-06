import NumberFlow from '@number-flow/react';

// Tactile, odometer-style rupee amount. Built on @number-flow/react — the same primitive
// Skiper UI's skiper37 ("Animated number") wraps (src/components/ui/skiper-ui/skiper37.jsx).
export default function MoneyFlow({ value = 0, className, willChange = true }) {
  return (
    <NumberFlow
      value={Number(value) || 0}
      locales="en-IN"
      format={{ style: 'currency', currency: 'INR', maximumFractionDigits: 0 }}
      willChange={willChange}
      className={className}
    />
  );
}
