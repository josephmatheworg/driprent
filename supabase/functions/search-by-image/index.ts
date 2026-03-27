import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    // Analyze image with AI to extract features
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
            content: `You are a fashion analysis assistant. Analyze clothing images and extract key features for search matching.`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this clothing/outfit image and extract the following features for matching similar items in a rental marketplace. Return a JSON object with these fields:
- colors: array of dominant colors (e.g., ["black", "white", "red"])
- category: one of: dresses, suits, streetwear, formal, casual, accessories, shoes, outerwear, vintage, designer
- style_keywords: array of 3-5 descriptive keywords (e.g., ["elegant", "floral", "summer", "midi-length"])
- description: brief 10-20 word description of the outfit

Return ONLY valid JSON, no markdown or explanation.`
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${imageBase64}`
                }
              }
            ]
          }
        ],
        max_tokens: 500,
      }),
    });

    if (!analysisResponse.ok) {
      if (analysisResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (analysisResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Service quota exceeded." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await analysisResponse.text();
      console.error("AI analysis error:", analysisResponse.status, errorText);
      throw new Error("Failed to analyze image");
    }

    const analysisData = await analysisResponse.json();
    const content = analysisData.choices?.[0]?.message?.content || "";
    
    // Parse the JSON response
    let features;
    try {
      // Clean up potential markdown formatting
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      features = JSON.parse(cleanContent);
    } catch (e) {
      console.error("Failed to parse AI response:", content);
      features = {
        colors: [],
        category: null,
        style_keywords: [],
        description: "clothing item"
      };
    }

    // Search database for matching fits
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Build search query - relaxed: try category + colors first, fallback to broader
    let query = supabase
      .from('fits')
      .select(`
        *,
        owner:profiles!fits_owner_id_fkey(id, username, avatar_url, rating, latitude, longitude)
      `)
      .eq('is_available', true);

    // First try: category match
    if (features.category) {
      query = query.eq('category', features.category);
    }

    const { data: categoryFits, error: catError } = await query.limit(20);

    let resultFits = categoryFits || [];

    // If too few results from category, broaden search
    if (resultFits.length < 3) {
      const broadQuery = supabase
        .from('fits')
        .select(`
          *,
          owner:profiles!fits_owner_id_fkey(id, username, avatar_url, rating, latitude, longitude)
        `)
        .eq('is_available', true)
        .limit(20);

      const { data: broadFits } = await broadQuery;
      if (broadFits && broadFits.length > resultFits.length) {
        resultFits = broadFits;
      }
    }

    return new Response(
      JSON.stringify({ 
        features,
        fits: resultFits
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
