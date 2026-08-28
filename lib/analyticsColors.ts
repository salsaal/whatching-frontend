// Colors assigned by job, not by taste — see the dataviz skill.
// Categorical = identity (fixed order, never cycled). Status = state (fixed,
// never reused for a series). Sequential = one hue, light -> dark, for
// ordinal/magnitude progressions like a funnel.

export const categorical = {
  brand: "#0ca300", // ties to the app's own green primary — used for "us" (bot, outbound, WhatsApp)
  blue: "#2a78d6",
  orange: "#eb6834",
  magenta: "#c1367a"
};

export const status = {
  good: "#0ca30c",
  warning: "#fab219",
  serious: "#ec835a",
  critical: "#d03b3b"
};

// Ordinal ramp for the broadcast funnel (light -> dark as the funnel completes).
// Validated: light-end contrast 2.54:1, all adjacent steps >= 0.06 delta-L.
export const sequentialGreen = {
  step1: "#10b981",
  step2: "#059669",
  step3: "#047857",
  step4: "#065f46"
};

export const chartInk = {
  grid: "#e5e7eb",
  axis: "#9ca3af"
};
