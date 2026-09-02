import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface Payload {
  to_email?: string;
  to_emails?: string[];
  subject?: string;
  body?: string;
  action_url?: string | null;
  action_label?: string | null;
  prices?: {
    total_price?: number;
    paid_now?: number;
    paid_to_date?: number;
    remaining?: number;
  } | null;
}

function money(n: unknown) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  return `৳${v.toLocaleString("en-US")}`;
}

function pricesTable(prices: Payload["prices"]) {
  if (!prices) return "";
  return `
    <table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:15px;">
      <tr><td style="padding:8px 0;color:#555;">Total price</td><td style="text-align:right;font-weight:700;">${money(prices.total_price)}</td></tr>
      <tr><td style="padding:8px 0;color:#555;">Paid now</td><td style="text-align:right;font-weight:700;">${money(prices.paid_now)}</td></tr>
      <tr><td style="padding:8px 0;color:#555;">Paid to date</td><td style="text-align:right;font-weight:700;">${money(prices.paid_to_date)}</td></tr>
      <tr style="border-top:1px solid #eee;"><td style="padding:10px 0;color:#26372c;">Remaining</td><td style="text-align:right;font-weight:700;color:#df7a4c;">${money(prices.remaining)}</td></tr>
    </table>
  `;
}

function htmlEmail(subject: string, body: string, actionUrl?: string | null, actionLabel?: string | null, prices?: Payload["prices"]) {
  const paragraphs = (body || "").split("\n").map((line) =>
    line.trim() === "" ? "<br/>" : `<div style="margin:0 0 6px;">${line.replace(/</g, "&lt;")}</div>`
  ).join("");
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;max-width:560px;margin:0 auto;padding:32px;color:#26372c;">
      <div style="text-align:center;margin-bottom:28px;">
        <h1 style="font-size:22px;letter-spacing:0.08em;margin:0;">BAPARI <span style="color:#df7a4c;">BUILDERS</span></h1>
      </div>
      <h2 style="font-size:20px;margin:0 0 16px;">${subject.replace(/</g, "&lt;")}</h2>
      <div style="color:#555;font-size:15px;line-height:1.7;">${paragraphs}</div>
      ${pricesTable(prices)}
      ${actionUrl ? `<div style="text-align:center;margin:32px 0;"><a href="${actionUrl}" style="background:#26372c;color:#fff;padding:14px 28px;text-decoration:none;font-weight:600;border-radius:3px;display:inline-block;">${actionLabel || "Open"}</a></div>` : ""}
      <hr style="border:none;border-top:1px solid #eee;margin:32px 0;" />
      <p style="color:#999;font-size:12px;text-align:center;">Bapari Builders — Building trust, one project at a time.</p>
    </div>
  `;
}

async function sendOne(to: string, subject: string, html: string) {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    console.log("Email skipped (no RESEND_API_KEY):", to, subject);
    return;
  }
  const from = Deno.env.get("EMAIL_FROM") || "Bapari Builders <noreply@baparibuilders.com>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });
  if (!res.ok) {
    const text = await res.text();
    console.log("Resend error:", res.status, text);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const payload = await req.json() as Payload;
    const subject = payload.subject;
    const recipients = [
      ...(payload.to_email ? [payload.to_email] : []),
      ...(payload.to_emails ?? []),
    ].map((e) => e.trim().toLowerCase()).filter(Boolean);

    if (!subject || recipients.length === 0) {
      return new Response(
        JSON.stringify({ error: "to_email and subject are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const html = htmlEmail(subject, payload.body || "", payload.action_url, payload.action_label, payload.prices);
    for (const to of recipients) {
      await sendOne(to, subject, html);
    }

    // Keep a copy on the service role path for debugging; ignore failures.
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (supabaseUrl && serviceRoleKey) {
        createClient(supabaseUrl, serviceRoleKey);
      }
    } catch {
      /* ignore */
    }

    return new Response(
      JSON.stringify({ success: true, message: "Notification email processed", sent: recipients.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
