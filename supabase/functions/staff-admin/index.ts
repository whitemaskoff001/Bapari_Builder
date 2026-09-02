import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") || "";

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Not signed in" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .maybeSingle();
    if (profile?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Not authorized" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const action = body.action as string;

    if (action === "create") {
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      const role = body.role === "admin" ? "admin" : "seller";
      const displayName = String(body.display_name || "");
      const phone = String(body.phone || "");
      if (!email || password.length < 6) {
        return new Response(JSON.stringify({ error: "Email and a password of at least 6 characters are required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { display_name: displayName, phone },
      });
      if (error) throw error;
      await admin.from("profiles").upsert({
        id: data.user.id,
        email,
        role,
        display_name: displayName,
        phone,
      });
      return new Response(JSON.stringify({ success: true, id: data.user.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update") {
      const userId = String(body.user_id || "");
      if (!userId) throw new Error("user_id is required");
      const patch: Record<string, unknown> = {};
      if (body.email) patch.email = String(body.email).trim().toLowerCase();
      if (body.password && String(body.password).length >= 6) patch.password = String(body.password);
      if (body.display_name != null || body.phone != null) {
        patch.user_metadata = {
          display_name: body.display_name,
          phone: body.phone,
        };
      }
      if (Object.keys(patch).length) {
        const { error } = await admin.auth.admin.updateUserById(userId, patch);
        if (error) throw error;
      }
      const profilePatch: Record<string, unknown> = {};
      if (body.email) profilePatch.email = String(body.email).trim().toLowerCase();
      if (body.role === "admin" || body.role === "seller") profilePatch.role = body.role;
      if (body.display_name != null) profilePatch.display_name = body.display_name;
      if (body.phone != null) profilePatch.phone = body.phone;
      if (Object.keys(profilePatch).length) {
        const { error } = await admin.from("profiles").update(profilePatch).eq("id", userId);
        if (error) throw error;
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete") {
      const userId = String(body.user_id || "");
      if (!userId) throw new Error("user_id is required");
      if (userId === userData.user.id) throw new Error("Cannot delete your own account");
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
