import { describe, expect, it } from "vitest";

import { customFieldRows } from "./contactText";

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
