import { describe, expect, it } from "vitest";

import {
  broadcastListLine,
  broadcastRestrictionText,
  customFieldRows,
  importBroadcastListNote
} from "./contactText";

describe("customFieldRows", () => {
  it("lists saved custom fields as text, skipping empty ones", () => {
    expect(
      customFieldRows({
        city: "Pune",
        orders: 3,
        vip: true,
        note: " ",
        missing: null
      })
    ).toEqual([
      ["city", "Pune"],
      ["orders", "3"],
      ["vip", "Yes"]
    ]);
  });

  it("is empty without custom fields", () => {
    expect(customFieldRows(undefined)).toEqual([]);
    expect(customFieldRows({})).toEqual([]);
  });
});

describe("broadcast list wording", () => {
  it("notes an import that goes past the broadcast list size", () => {
    expect(
      importBroadcastListNote({
        contactsAfterImport: 10250,
        subscriberLimit: 10000
      })
    ).toBe(
      "After this import you'll have 10,250 contacts. Broadcasts and drips go to your 10,000 most recently active contacts."
    );
  });

  it("says nothing when the import fits or there's no limit", () => {
    expect(
      importBroadcastListNote({
        contactsAfterImport: 10000,
        subscriberLimit: 10000
      })
    ).toBeNull();
    expect(
      importBroadcastListNote({
        contactsAfterImport: 50,
        subscriberLimit: null
      })
    ).toBeNull();
    expect(importBroadcastListNote({ subscriberLimit: 10000 })).toBeNull();
    expect(importBroadcastListNote(undefined)).toBeNull();
  });

  it("counts who gets broadcasts", () => {
    expect(
      broadcastListLine({ broadcastEligible: 9800, whatsapp: 12000 })
    ).toBe("9,800 of 12,000 contacts get broadcasts");
    expect(broadcastListLine({ broadcastEligible: 0, whatsapp: 0 })).toBeNull();
    expect(broadcastListLine({ whatsapp: 5 })).toBeNull();
  });

  it("explains a contact left off the list", () => {
    expect(broadcastRestrictionText("awaiting_plan_capacity")).toBe(
      "Waiting for a place on your broadcast list."
    );
    expect(broadcastRestrictionText("less_recent_than_plan_pool")).toBe(
      "Not on your broadcast list. The list is full, and your most recently active contacts come first."
    );
  });
});
