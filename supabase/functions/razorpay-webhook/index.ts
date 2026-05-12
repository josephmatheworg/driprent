import { createClient } from "npm:@supabase/supabase-js@2";
import { createHmac } from "node:crypto";

// Public webhook — no JWT. Verified via X-Razorpay-Signature.
Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  try {
    const raw = await req.text();
    const signature = req.headers.get("x-razorpay-signature") || "";
    const secret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET")!;

    const expected = createHmac("sha256", secret).update(raw).digest("hex");
    if (expected !== signature) {
      console.error("Webhook signature mismatch");
      return new Response("Invalid signature", { status: 400 });
    }

    const event = JSON.parse(raw);
    const eventType = event.event as string;
    const payment = event.payload?.payment?.entity;
    const orderId = payment?.order_id;
    if (!orderId) return new Response("ok", { status: 200 });

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: rental } = await admin
      .from("rentals")
      .select("*")
      .eq("razorpay_order_id", orderId)
      .maybeSingle();
    if (!rental) {
      console.warn("No rental for order", orderId);
      return new Response("ok", { status: 200 });
    }

    if (eventType === "payment.captured" || eventType === "order.paid") {
      if (rental.payment_status !== "paid") {
        await admin
          .from("rentals")
          .update({
            status: "confirmed",
            payment_status: "paid",
            razorpay_payment_id: payment.id,
            payment_timestamp: new Date().toISOString(),
          })
          .eq("id", rental.id);
      }
    } else if (eventType === "payment.failed") {
      if (rental.payment_status !== "paid" && rental.status === "awaiting_payment") {
        await admin
          .from("rentals")
          .update({ payment_status: "failed" })
          .eq("id", rental.id);
      }
    }

    return new Response("ok", { status: 200 });
  } catch (e) {
    console.error("webhook error", e);
    return new Response("error", { status: 500 });
  }
});
