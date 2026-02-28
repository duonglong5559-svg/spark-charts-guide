import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BINANCE_REST = "https://api.binance.com/api/v3";

async function fetchCandles(symbol: string, interval: string, limit = 30) {
  const res = await fetch(
    `${BINANCE_REST}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
  );
  if (!res.ok) throw new Error(`Binance error: ${res.status}`);
  const data = await res.json();
  return data.map((k: any) => ({
    time: new Date(k[0]).toISOString(),
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5]),
  }));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { symbol } = await req.json();
    const GROK_API_KEY = Deno.env.get("GROK_API_KEY");
    if (!GROK_API_KEY) throw new Error("GROK_API_KEY is not configured");

    // Fetch multiple timeframes in parallel
    const [m5, h1, h4] = await Promise.all([
      fetchCandles(symbol, "5m", 30),
      fetchCandles(symbol, "1h", 30),
      fetchCandles(symbol, "4h", 30),
    ]);

    const formatCandles = (candles: any[], label: string) =>
      `${label} (${candles.length} nến):\n${candles
        .slice(-10)
        .map(
          (c: any, i: number) =>
            `[${i}] O:${c.open} H:${c.high} L:${c.low} C:${c.close} V:${Math.round(c.volume)}`
        )
        .join("\n")}`;

    const systemPrompt = `Bạn là Spider AI - hệ thống Multi-Timeframe Analysis cấp institutional.
Nhiệm vụ: Phân tích đồng thời 3 khung thời gian (M5, H1, H4) để tìm HỢP LƯU đa khung.

PHẢI trả về ĐÚNG format JSON sau, KHÔNG kèm markdown:
{
  "overallBias": "STRONG_LONG" | "LONG" | "NEUTRAL" | "SHORT" | "STRONG_SHORT",
  "confidence": 1-100,
  "timeframes": {
    "M5": {
      "trend": "UPTREND" | "DOWNTREND" | "SIDEWAYS",
      "strength": 1-10,
      "keyLevel": number,
      "signal": "BUY" | "SELL" | "WAIT",
      "note": "string"
    },
    "H1": { ... },
    "H4": { ... }
  },
  "confluence": {
    "aligned": true | false,
    "direction": "LONG" | "SHORT" | "MIXED",
    "factors": ["factor1", "factor2", ...],
    "score": 1-10
  },
  "bestEntry": {
    "type": "LONG" | "SHORT" | "NONE",
    "price": number,
    "tp": number,
    "sl": number,
    "rr": "1:X.X",
    "timeframe": "M5" | "H1" | "H4",
    "reason": "string"
  },
  "summary": "Phân tích tổng hợp 3-4 câu",
  "warning": "Cảnh báo rủi ro"
}`;

    const userContent = `SYMBOL: ${symbol}
CURRENT PRICE: ${m5[m5.length - 1].close}

${formatCandles(m5, "M5")}

${formatCandles(h1, "H1")}

${formatCandles(h4, "H4")}

Phân tích HỢP LƯU đa khung thời gian. Trả về JSON.`;

    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROK_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "grok-3-fast",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit. Thử lại sau." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Hết credit AI." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "AI gateway error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    let parsed;
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
      parsed = JSON.parse(jsonMatch[1]!.trim());
    } catch {
      console.error("Failed to parse MTF response:", content);
      return new Response(
        JSON.stringify({ error: "AI response format error", raw: content }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("multi-timeframe error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
