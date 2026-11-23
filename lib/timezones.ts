import { formatTimezoneOption } from "@/lib/displayFormat";

const curatedTimezones = [
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Asia/Karachi",
  "Asia/Dhaka",
  "Asia/Kathmandu",
  "Asia/Colombo",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Los_Angeles",
  "Australia/Sydney",
  "UTC"
];

/**
 * Every time zone the browser knows (a short list on older browsers), with
 * the given zones kept selectable even when the list doesn't have them, e.g.
 * an older name such as "Asia/Calcutta".
 */
export const timezoneOptions = (...keep: Array<string | null | undefined>) => {
  let zones = curatedTimezones;
  try {
    const supported = Intl.supportedValuesOf("timeZone");
    if (supported.length) zones = supported;
  } catch {
    // Older browsers: the curated list.
  }
  const missing = keep.filter(
    (zone, index): zone is string =>
      Boolean(zone) && !zones.includes(zone!) && keep.indexOf(zone) === index
  );
  return [...missing, ...zones].map((zone) => ({
    value: zone,
    label: formatTimezoneOption(zone)
  }));
};
