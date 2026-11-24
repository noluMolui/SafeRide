export function getRequiredEnv(name: "VITE_SUPABASE_URL" | "VITE_SUPABASE_ANON_KEY") {
  const value = import.meta.env[name]?.trim();
  if (!value || value.includes("your-local-or-hosted-anon-key")) {
    throw new Error(`${name} is not configured.`);
  }
  return value;
}
