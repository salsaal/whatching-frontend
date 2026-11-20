import { describe, expect, it } from "vitest";

import {
  NO_PHONE_SKIP_EXPLANATION,
  describeRecipientOutcome,
  isNoPhoneSkipReason
} from "./recipientOutcome";

describe("describeRecipientOutcome", () => {
  it("rewords the no-phone skip for customers with only a username", () => {
    const outcome = describeRecipientOutcome({
      status: "skipped",
      errorMessage: "Subscriber does not have a WhatsApp phone number."
    });
    expect(outcome.label).toBe("Skipped");
    expect(outcome.explanation).toBe(NO_PHONE_SKIP_EXPLANATION);
    expect(
      isNoPhoneSkipReason("Subscriber does not have a WhatsApp phone number.")
    ).toBe(true);
  });

  it("keeps other skip reasons as they are", () => {
    expect(
      describeRecipientOutcome({
        status: "skipped",
        errorMessage: "Contact opted out"
      }).explanation
    ).toBe("Contact opted out");
    expect(isNoPhoneSkipReason(undefined)).toBe(false);
  });
});
