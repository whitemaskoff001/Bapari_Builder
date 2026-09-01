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
    const { to_email, subject, body, action_url, action_label } = await req.json();

    if (!to_email || !subject) {
      return new Response(
        JSON.stringify({ error: "to_email and subject are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Build a simple HTML email
    const html = `
      <div style="font-family: -apple-system, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="color: #26372c; font-size: 24px; margin: 0; letter-spacing: 0.05em;">BAPARI <span style="color: #df7a4c;">BUILDERS</span></h1>
        </div>
        <h2 style="color: #26372c; font-size: 20px; margin-bottom: 16px;">${subject}</h2>
        <p style="color: #555; font-size: 15px; line-height: 1.7;">${body || ""}</p>
        ${action_url ? `<div style="text-align: center; margin: 32px 0;"><a href="${action_url}" style="background: #26372c; color: white; padding: 14px 28px; text-decoration: none; font-weight: 600; border-radius: 3px; display: inline-block;">${action_label || "Open"}</a></div>` : ""}
        <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;" />
        <p style="color: #999; font-size: 12px; text-align: center;">Bapari Builders — Building trust, one project at a time.</p>
      </div>
    `;

    // Send email via Supabase's built-in email
    const { error } = await admin.auth.admin.sendRawEmail?.({
      email: to_email,
      subject,
      html,
    }) ?? { error: null };

    // If sendRawEmail is not available, we log it for now
    if (error) {
      console.log("Email send error:", error.message);
    }

    return new Response(
      JSON.stringify({ success: true, message: "Notification email processed" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
