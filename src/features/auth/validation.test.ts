import { describe, expect, it, vi, afterEach } from "vitest";
import { complianceSchema, fileError, signupSchema } from "./validation";

const signup = { role: "parent", name: "Naledi Molefe", email: "naledi@example.co.za", phone: "082 123 4567", password: "Passw0rdA", consent: true };
const compliance = { pdp: "GP940218", pdpExpiry: "2027-03-14", suburbs: ["Sandton"], registration: "ca 123-456", model: "Toyota Quantum", seats: 15, roadworthyExpiry: "2027-03-14" };

afterEach(() => vi.useRealTimers());

describe("sign-up validation", () => {
  it("AC-1.8 rejects a short password", () => {
    expect(signupSchema.safeParse({ ...signup, password: "abc123" }).success).toBe(false);
  });
  it("AC-1.9 accepts a South African mobile and rejects invalid numbers", () => {
    expect(signupSchema.safeParse(signup).success).toBe(true);
    expect(signupSchema.safeParse({ ...signup, phone: "+27 82 123 4567" }).success).toBe(true);
    expect(signupSchema.safeParse({ ...signup, phone: "12345" }).success).toBe(false);
  });
  it("AC-1.10 requires consent", () => {
    expect(signupSchema.safeParse({ ...signup, consent: false }).success).toBe(false);
  });
});

describe("driver compliance validation", () => {
  it("AC-1.11 rejects expired permits and accepts today's date in South Africa", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-24T10:00:00Z"));
    expect(complianceSchema.safeParse({ ...compliance, pdpExpiry: "2026-11-23" }).success).toBe(false);
    expect(complianceSchema.safeParse({ ...compliance, pdpExpiry: "2026-11-24" }).success).toBe(true);
  });
  it("AC-1.13 normalises registrations and rejects invalid formats", () => {
    const result = complianceSchema.safeParse(compliance);
    expect(result.success && result.data.registration).toBe("CA123456");
    expect(complianceSchema.safeParse({ ...compliance, registration: "!!" }).success).toBe(false);
  });
  it("AC-1.20 rejects unsupported and oversized files", () => {
    expect(fileError(new File(["x"], "file.exe", { type: "application/octet-stream" }))).toBeDefined();
    expect(fileError(new File([new Uint8Array(5 * 1024 * 1024 + 1)], "file.pdf", { type: "application/pdf" }))).toBeDefined();
    expect(fileError(new File(["x"], "file.pdf", { type: "application/pdf" }))).toBeUndefined();
  });
});
