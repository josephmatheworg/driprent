import { createClient } from "npm:@supabase/supabase-js@2";

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
    const rentalId = String(body.rental_id || "");
    if (!rentalId) {
      return new Response(JSON.stringify({ error: "rental_id required" }), { status: 400, headers: corsHeaders });
    }

    // Resolve renter profile id
    const { data: profile } = await admin.from("profiles").select("id, full_name, username, phone").eq("user_id", authId).maybeSingle();
    if (!profile) {
      return new Response(JSON.stringify({ error: "Profile not found" }), { status: 403, headers: corsHeaders });
    }

    // Load rental
    const { data: rental } = await admin.from("rentals").select("*").eq("id", rentalId).maybeSingle();
    if (!rental) {
      return new Response(JSON.stringify({ error: "Rental not found" }), { status: 404, headers: corsHeaders });
    }
    if (rental.renter_id !== profile.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
    }
    if (rental.status !== "awaiting_payment") {
      return new Response(JSON.stringify({ error: "Rental not awaiting payment" }), { status: 400, headers: corsHeaders });
    }
    if (!rental.advance_amount || rental.advance_amount <= 0) {
      return new Response(JSON.stringify({ error: "No advance amount set" }), { status: 400, headers: corsHeaders });
    }
    if (rental.payment_deadline && new Date(rental.payment_deadline).getTime() < Date.now()) {
      return new Response(JSON.stringify({ error: "Payment window expired" }), { status: 400, headers: corsHeaders });
    }

    const keyId = Deno.env.get("RAZORPAY_KEY_ID")!;
    const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET")!;
    if (!keyId || !keySecret) {
      return new Response(JSON.stringify({ error: "Razorpay not configured" }), { status: 500, headers: corsHeaders });
    }

    // If we already created an order for this rental and it's still valid, reuse it
    let orderId = rental.razorpay_order_id as string | null;
    const amountPaise = Math.round(Number(rental.advance_amount) * 100);

    if (!orderId) {
      const auth = btoa(`${keyId}:${keySecret}`);
      const orderRes = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amountPaise,
          currency: "INR",
          receipt: `rental_${rentalId.slice(0, 30)}`,
          notes: { rental_id: rentalId, renter_id: profile.id },
        }),
      });
      const orderJson = await orderRes.json();
      if (!orderRes.ok) {
        console.error("Razorpay order create failed", orderJson);
        return new Response(JSON.stringify({ error: "Order creation failed", details: orderJson }), { status: 502, headers: corsHeaders });
      }
      orderId = orderJson.id;
      await admin.from("rentals").update({ razorpay_order_id: orderId }).eq("id", rentalId);
    }

    return new Response(
      JSON.stringify({
        orderId,
        keyId,
        amount: amountPaise,
        currency: "INR",
        renterName: profile.full_name || profile.username,
        renterPhone: profile.phone,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("create-order error", e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
