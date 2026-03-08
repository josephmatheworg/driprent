import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Get tomorrow's date in YYYY-MM-DD
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];

  // Rentals starting tomorrow
  const { data: starting } = await supabase
    .from("rentals")
    .select("id, fit_id, owner_id, renter_id, start_date, end_date, fits(title)")
    .eq("start_date", tomorrowStr)
    .in("status", ["confirmed", "active"]);

  // Rentals ending tomorrow
  const { data: ending } = await supabase
    .from("rentals")
    .select("id, fit_id, owner_id, renter_id, start_date, end_date, fits(title)")
    .eq("end_date", tomorrowStr)
    .in("status", ["confirmed", "active"]);

  const notifications: {
    user_id: string;
    title: string;
    message: string;
    type: string;
    metadata: Record<string, string>;
  }[] = [];

  for (const r of starting ?? []) {
    const fitTitle = (r as any).fits?.title ?? "your outfit";
    const meta = { rental_id: r.id, fit_id: r.fit_id };

    notifications.push({
      user_id: r.renter_id,
      title: "Rental Starts Tomorrow",
      message: `Your DripRent rental for "${fitTitle}" starts tomorrow.`,
      type: "rental_reminder",
      metadata: meta,
    });
    notifications.push({
      user_id: r.owner_id,
      title: "Rental Starts Tomorrow",
      message: `The rental for "${fitTitle}" starts tomorrow. Make sure it's ready!`,
      type: "rental_reminder",
      metadata: meta,
    });
  }

  for (const r of ending ?? []) {
    const fitTitle = (r as any).fits?.title ?? "your outfit";
    const meta = { rental_id: r.id, fit_id: r.fit_id };

    notifications.push({
      user_id: r.renter_id,
      title: "Return Due Tomorrow",
      message: `Your rental for "${fitTitle}" is due back tomorrow.`,
      type: "rental_reminder",
      metadata: meta,
    });
    notifications.push({
      user_id: r.owner_id,
      title: "Return Due Tomorrow",
      message: `The rental for "${fitTitle}" is due back tomorrow.`,
      type: "rental_reminder",
      metadata: meta,
    });
  }

  if (notifications.length > 0) {
    const { error } = await supabase.from("notifications").insert(notifications);
    if (error) {
      console.error("Failed to insert reminders:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  return new Response(
    JSON.stringify({ sent: notifications.length }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
