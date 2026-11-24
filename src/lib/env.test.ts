import { afterEach, describe, expect, it, vi } from "vitest";
import { getRequiredEnv } from "./env";

afterEach(() => vi.unstubAllEnvs());

describe("environment configuration", () => {
  it("returns a configured Supabase URL", () => {
    vi.stubEnv("VITE_SUPABASE_URL", "http://127.0.0.1:54321");
    expect(getRequiredEnv("VITE_SUPABASE_URL")).toBe("http://127.0.0.1:54321");
  });

  it("rejects a missing placeholder anon key", () => {
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "your-local-or-hosted-anon-key");
    expect(() => getRequiredEnv("VITE_SUPABASE_ANON_KEY")).toThrow("VITE_SUPABASE_ANON_KEY is not configured.");
  });
});
