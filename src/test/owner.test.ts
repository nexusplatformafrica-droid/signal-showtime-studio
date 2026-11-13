import { describe, expect, it } from "vitest";
import { isOwnerIdentity, OWNER_EMAIL } from "@/lib/firebase-config";

describe("Super Admin is only mainplatform.nexus@gmail.com", () => {
  it("is the fixed owner email", () => expect(OWNER_EMAIL).toBe("mainplatform.nexus@gmail.com"));
  it("accepts the owner once the email is confirmed (any letter case)", () => expect(isOwnerIdentity("MainPlatform.Nexus@gmail.com", true)).toBe(true));
  it("refuses the owner email while unconfirmed", () => expect(isOwnerIdentity("mainplatform.nexus@gmail.com", false)).toBe(false));
  it("refuses every other email", () => expect(isOwnerIdentity("someone@gmail.com", true)).toBe(false));
});
