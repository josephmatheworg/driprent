import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Category affinity groups: items within the same group are visually/contextually related.
// Cross-group matches are penalized heavily to avoid showing unrelated outfits.
const CATEGORY_GROUPS: Record<string, string[]> = {
  ethnic: ["dresses", "vintage", "designer"],
  formal: ["suits", "formal", "outerwear", "designer"],
  casual: ["casual", "streetwear", "dresses"],
  accessories: ["accessories"],
  shoes: ["shoes"],
};

function getCategoryGroup(category: string | null): string {
  if (!category) return "casual";
  for (const [group, cats] of Object.entries(CATEGORY_GROUPS)) {
    if (cats.includes(category)) return group;
  }
  return "casual";
}

function scoreFit(fit: any, features: any): number {
  let score = 0;
  const fitText = `${fit.title || ""} ${fit.description || ""} ${fit.brand || ""} ${fit.color || ""}`.toLowerCase();

  // 1. Category match — HIGHEST priority (weight 50)
  if (features.category && fit.category === features.category) {
    score += 50;
  } else if (features.category) {
    // Same affinity group still acceptable but lower
    const refGroup = getCategoryGroup(features.category);
    const fitGroup = getCategoryGroup(fit.category);
    if (refGroup === fitGroup) score += 20;
    else score -= 30; // penalize cross-group (e.g., blazer vs saree)
  }

  // 2. Color match — MEDIUM priority (weight up to 20)
  if (Array.isArray(features.colors)) {
    for (const c of features.colors) {
      if (c && fitText.includes(String(c).toLowerCase())) score += 7;
    }
  }

  // 3. Style/vibe keywords — MEDIUM (weight up to 15)
  if (Array.isArray(features.style_keywords)) {
    for (const k of features.style_keywords) {
      if (k && fitText.includes(String(k).toLowerCase())) score += 3;
    }
  }

  // 4. Sleeve / pattern — LOW priority (weight up to 6)
  if (features.sleeve_type && fitText.includes(String(features.sleeve_type).toLowerCase())) score += 3;
  if (features.pattern && fitText.includes(String(features.pattern).toLowerCase())) score += 3;

  // Small boost for highly rated items so good matches surface
  if (typeof fit.rating === "number") score += Math.min(fit.rating, 5) * 0.5;

  return score;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64 } = await req.json();

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: "No image provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const analysisResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a fashion stylist helping a rental marketplace recommend visually SIMILAR outfits — not exact duplicates. Focus on overall vibe, category, color family and silhouette rather than precise design details.`,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this outfit image and extract features for finding visually SIMILAR (not identical) rentals. Be generous and descriptive — we want alternatives that share the same vibe.

Return ONLY valid JSON with these fields:
- category: ONE of: dresses, suits, streetwear, formal, casual, accessories, shoes, outerwear, vintage, designer (pick the closest)
- colors: array of 1-3 dominant color names (e.g., ["black", "gold"])
- pattern: short string (e.g., "solid", "floral", "embroidered", "striped", "printed")
- sleeve_type: short string (e.g., "sleeveless", "short", "full", "n/a")
- style_keywords: array of 3-6 broad descriptive words (e.g., ["ethnic", "festive", "elegant", "flowy"])
- vibe: ONE of: ethnic, formal, casual, streetwear, party, festive, bridal, business, vintage
- description: 10-20 word description

No markdown, just JSON.`,
              },
              {
                type: "image_url",
                image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
              },
            ],
          },
        ],
        max_tokens: 500,
      }),
    });

    if (!analysisResponse.ok) {
      if (analysisResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (analysisResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Service quota exceeded." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const errorText = await analysisResponse.text();
      console.error("AI analysis error:", analysisResponse.status, errorText);
      throw new Error("Failed to analyze image");
    }

    const analysisData = await analysisResponse.json();
    const content = analysisData.choices?.[0]?.message?.content || "";

    let features: any;
    try {
      const cleanContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      features = JSON.parse(cleanContent);
    } catch {
      console.error("Failed to parse AI response:", content);
      features = { colors: [], category: null, style_keywords: [], description: "clothing item" };
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Pull a broad candidate pool from the same affinity group (not just exact category)
    const refGroup = getCategoryGroup(features.category);
    const allowedCategories = CATEGORY_GROUPS[refGroup] || [];

    let candidates: any[] = [];

    if (allowedCategories.length > 0) {
      const { data } = await supabase
        .from("fits")
        .select(`*, owner:profiles!fits_owner_id_fkey(id, username, avatar_url, rating, latitude, longitude)`)
        .eq("is_available", true)
        .in("category", allowedCategories)
        .limit(80);
      candidates = data || [];
    }

    // Fallback: if too few in-group matches, broaden to all available
    let approximate = false;
    if (candidates.length < 6) {
      approximate = true;
      const { data } = await supabase
        .from("fits")
        .select(`*, owner:profiles!fits_owner_id_fkey(id, username, avatar_url, rating, latitude, longitude)`)
        .eq("is_available", true)
        .limit(80);
      candidates = data || [];
    }

    // Score and rank
    const scored = candidates
      .map((f) => ({ fit: f, score: scoreFit(f, features) }))
      .filter((s) => s.score > 0) // drop obvious mismatches (negative scores)
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);

    const topScore = scored[0]?.score ?? 0;
    const message = topScore < 25
      ? "Similar styles available"
      : `Found ${scored.length} visually similar outfits`;

    return new Response(
      JSON.stringify({
        features,
        fits: scored.map((s) => s.fit),
        message,
        approximate,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("search-by-image error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
