import { createClient } from "npm:@supabase/supabase-js@2";

// Cron-invoked: marks awaiting_payment rentals past their deadline as expired.
Deno.serve(async () => {
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data, error } = await admin
    .from("rentals")
    .update({ status: "expired", payment_status: "unpaid" })
    .eq("status", "awaiting_payment")
    .lt("payment_deadline", new Date().toISOString())
    .select("id");

  if (error) {
    console.error("expire-bookings error", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ expired: data?.length ?? 0 }), { status: 200 });
});
