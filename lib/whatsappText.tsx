import { Fragment, ReactNode } from "react";

// Renders WhatsApp message text the way the app shows it: *bold*, _italic_,
// ~strike~ and ```mono```, with {{n}} placeholders swapped for values.
// A placeholder with no value renders as a highlighted chip.

const CHIP_OPEN = "";
const CHIP_CLOSE = "";

const FORMAT_RULES: Array<{
  pattern: RegExp;
  wrap: (children: ReactNode, key: string) => ReactNode;
}> = [
  {
    pattern: /```([\s\S]+?)```/,
    wrap: (children, key) => (
      <code
        key={key}
        className="rounded-sm bg-black/5 px-1 font-mono text-[0.92em]"
      >
        {children}
      </code>
    )
  },
  {
    pattern: /\*([^*\n]+)\*/,
    wrap: (children, key) => <strong key={key}>{children}</strong>
  },
  {
    pattern: /_([^_\n]+)_/,
    wrap: (children, key) => <em key={key}>{children}</em>
  },
  {
    pattern: /~([^~\n]+)~/,
    wrap: (children, key) => <s key={key}>{children}</s>
  }
];

const renderChips = (text: string, keyPrefix: string): ReactNode[] => {
  const parts = text.split(
    new RegExp(`(${CHIP_OPEN}[^${CHIP_CLOSE}]*${CHIP_CLOSE})`)
  );
  return parts
    .filter((part) => part !== "")
    .map((part, index) =>
      part.startsWith(CHIP_OPEN) ? (
        <span
          key={`${keyPrefix}-chip-${index}`}
          className="rounded-sm bg-amber-100 px-1 font-mono text-[0.92em] text-amber-900"
        >
          {`{{${part.slice(1, -1)}}}`}
        </span>
      ) : (
        <Fragment key={`${keyPrefix}-t-${index}`}>{part}</Fragment>
      )
    );
};

const renderFormatted = (text: string, keyPrefix: string): ReactNode[] => {
  let earliest: {
    index: number;
    rule: (typeof FORMAT_RULES)[number];
    match: RegExpExecArray;
  } | null = null;
  for (const rule of FORMAT_RULES) {
    const match = rule.pattern.exec(text);
    if (match && (!earliest || match.index < earliest.index)) {
      earliest = { index: match.index, rule, match };
    }
  }
  if (!earliest) return renderChips(text, keyPrefix);

  const { match, rule, index } = earliest;
  const before = text.slice(0, index);
  const after = text.slice(index + match[0].length);
  // Mono content isn't formatted further, the same as WhatsApp.
  const inner =
    rule === FORMAT_RULES[0]
      ? renderChips(match[1], `${keyPrefix}-m`)
      : renderFormatted(match[1], `${keyPrefix}-i`);
  return [
    ...renderChips(before, `${keyPrefix}-b`),
    rule.wrap(inner, `${keyPrefix}-f${index}`),
    ...renderFormatted(after, `${keyPrefix}-a`)
  ];
};

/**
 * @param resolve returns the text for a placeholder key, or undefined to
 * show it as a chip.
 */
export const renderWhatsAppText = (
  text: string,
  resolve: (key: string) => string | undefined = () => undefined
): ReactNode[] => {
  const substituted = String(text || "").replace(
    /{{\s*([\w.]+)\s*}}/g,
    (_match, key: string) => {
      const value = resolve(key);
      return value !== undefined && value !== ""
        ? value
        : `${CHIP_OPEN}${key}${CHIP_CLOSE}`;
    }
  );
  return renderFormatted(substituted, "w");
};
