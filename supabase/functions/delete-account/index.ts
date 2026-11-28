import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: Record<string, string>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function removeUserDocuments(
  client: ReturnType<typeof createClient>,
  userId: string,
) {
  const bucket = client.storage.from("compliance-docs");
  const paths: string[] = [];

  async function collect(prefix: string) {
    let offset = 0;
    while (true) {
      const { data, error } = await bucket.list(prefix, {
        limit: 100,
        offset,
        sortBy: { column: "name", order: "asc" },
      });
      if (error) throw error;
      for (const entry of data) {
        const path = `${prefix}/${entry.name}`;
        if (entry.id === null) await collect(path);
        else paths.push(path);
      }
      if (data.length < 100) break;
      offset += data.length;
    }
  }

  await collect(userId);
  for (let index = 0; index < paths.length; index += 100) {
    const { error } = await bucket.remove(paths.slice(index, index + 100));
    if (error) throw error;
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST")
    return jsonResponse({ error: "Method not allowed" }, 405);

  const authorization = request.headers.get("Authorization");
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return jsonResponse({ error: "Unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey)
    return jsonResponse({ error: "Deletion service is not configured" }, 500);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: userData, error: authError } = await admin.auth.getUser(token);
  if (authError || !userData.user)
    return jsonResponse({ error: "Unauthorized" }, 401);

  try {
    await removeUserDocuments(admin, userData.user.id);
  } catch (error) {
    console.error("Account document cleanup failed", error);
    return jsonResponse({ error: "Could not remove account documents" }, 500);
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(
    userData.user.id,
  );
  if (deleteError) {
    console.error("Auth user deletion failed", deleteError);
    return jsonResponse({ error: "Could not delete account" }, 500);
  }

  return jsonResponse({ status: "deleted" }, 200);
});
