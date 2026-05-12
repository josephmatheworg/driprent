import { createClient } from "npm:@supabase/supabase-js@2";
import { createHmac } from "node:crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claims } = await supabase.auth.getClaims(token);
    if (!claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const authId = claims.claims.sub;

    const body = await req.json();
    const { rental_id, razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;
    if (!rental_id || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400, headers: corsHeaders });
    }

    const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET")!;
    const expectedSig = createHmac("sha256", keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expectedSig !== razorpay_signature) {
      console.error("Signature mismatch");
      return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 400, headers: corsHeaders });
    }

    // Fetch rental & verify caller is renter and order matches
    const { data: profile } = await admin.from("profiles").select("id").eq("user_id", authId).maybeSingle();
    if (!profile) {
      return new Response(JSON.stringify({ error: "Profile not found" }), { status: 403, headers: corsHeaders });
    }

    const { data: rental } = await admin.from("rentals").select("*").eq("id", rental_id).maybeSingle();
    if (!rental || rental.renter_id !== profile.id || rental.razorpay_order_id !== razorpay_order_id) {
      return new Response(JSON.stringify({ error: "Rental mismatch" }), { status: 403, headers: corsHeaders });
    }

    if (rental.payment_status === "paid") {
      // Already processed (e.g. by webhook)
      return new Response(JSON.stringify({ ok: true, alreadyConfirmed: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: updErr } = await admin
      .from("rentals")
      .update({
        status: "confirmed",
        payment_status: "paid",
        razorpay_payment_id,
        payment_timestamp: new Date().toISOString(),
      })
      .eq("id", rental_id);

    if (updErr) {
      console.error("Rental update failed", updErr);
      return new Response(JSON.stringify({ error: updErr.message }), { status: 500, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("verify-payment error", e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
