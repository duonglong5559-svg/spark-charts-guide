import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { candles, symbol, timeframe, pivots, rsi, macd, patterns, sentiment } = await req.json();
    const GROK_API_KEY = Deno.env.get("GROK_API_KEY");
    if (!GROK_API_KEY) throw new Error("GROK_API_KEY is not configured");

    const systemPrompt = `Bạn là Spider AI - hệ thống phân tích kỹ thuật CHUYÊN NGHIỆP cấp institutional.
Nhiệm vụ: Phân tích kỹ thuật chuyên sâu, CHỈ đưa ra tín hiệu khi hợp lưu đủ mạnh (win rate ≥ 90%).

PHẢI trả về ĐÚNG format JSON sau, KHÔNG kèm markdown hay text nào khác:
{
  "trend": "UPTREND" | "DOWNTREND" | "SIDEWAYS",
  "trendStrength": 1-10,
  "summary": "Nhận định chuyên sâu 2-3 câu",
  "entries": [
    {
      "type": "LONG" | "SHORT",
      "entry": number,
      "tp1": number,
      "tp2": number,
      "tp3": number,
      "sl": number,
      "rr": "1:X.X",
      "winRate": 90-99,
      "confidence": 90-99,
      "reason": "Lý do chi tiết với các confluence",
      "strategy": "SCALP" | "SWING",
      "confluences": ["RSI oversold", "Pivot S1 bounce", "Hammer pattern", ...]
    }
  ],
  "validatedLevels": [
    {
      "price": number,
      "type": "resistance" | "support",
      "strength": "Rất mạnh" | "Mạnh",
      "testCount": number,
      "note": "Lý do level này quan trọng",
      "validated": true
    }
  ],
  "aiTrendLines": [
    {
      "startPrice": number,
      "endPrice": number,
      "startIndex": number,
      "endIndex": number,
      "type": "support" | "resistance" | "channel",
      "label": "Tên đường trend"
    }
  ],
  "marketStructure": {
    "phase": "ACCUMULATION" | "MARKUP" | "DISTRIBUTION" | "MARKDOWN",
    "keyZone": "Vùng giá quan trọng nhất hiện tại",
    "bias": "LONG" | "SHORT" | "NEUTRAL"
  },
  "riskWarning": "Cảnh báo rủi ro chi tiết"
}

QUY TẮC PHÂN TÍCH NGHIÊM NGẶT:
1. CHỈ đưa entry khi có ≥ 3 confluence đồng thuận (RSI + MACD + Pivot + Pattern + Volume + Trend)
2. Win rate PHẢI ≥ 90% - nếu không đủ confluence thì entries = [] (mảng rỗng)
3. Validated levels: CHỈ cho vào những S/R đã được test ≥ 2 lần hoặc trùng pivot quan trọng
4. Trend lines: Vẽ dựa trên swing highs/lows THỰC TẾ, phải có ít nhất 2 điểm chạm
5. SL phải chặt (0.3-0.5 ATR), RR tối thiểu 1:2
6. Nếu thị trường sideways/unclear → KHÔNG đưa entry, chỉ phân tích
7. Entry LONG: RSI < 40 + giá tại/gần hỗ trợ + MACD divergence hoặc crossover
8. Entry SHORT: RSI > 60 + giá tại/gần kháng cự + MACD bearish
9. startIndex và endIndex dựa trên dữ liệu nến được cung cấp (0 = nến đầu tiên)
10. Số lượng nến được cung cấp là CANDLE_COUNT, endIndex tối đa = CANDLE_COUNT - 1`;

    const candleData = candles.slice(-30);
    const userContent = `SYMBOL: ${symbol} | TIMEFRAME: ${timeframe} | CANDLE_COUNT: ${candleData.length}

LAST ${candleData.length} CANDLES (index 0 = oldest):
${candleData.map((c: any, i: number) => 
  `[${i}] ${c.time} | O:${c.open} H:${c.high} L:${c.low} C:${c.close} V:${Math.round(c.volume)}`
).join('\n')}

PIVOT POINTS:
PP=${pivots.pp} | R1=${pivots.r1} R2=${pivots.r2} R3=${pivots.r3} | S1=${pivots.s1} S2=${pivots.s2} S3=${pivots.s3}

CURRENT PRICE: ${candles[candles.length - 1].close}
RSI(14): ${rsi}
MACD Histogram: ${macd}
SENTIMENT: Bull ${sentiment.bullPct}% / Bear ${sentiment.bearPct}%
PATTERNS: ${patterns.length > 0 ? patterns.map((p: any) => `${p.nameVi}(${p.type}) tại index ${p.index}`).join(', ') : 'Không có'}

Phân tích CHUYÊN SÂU và CHỈ đưa tín hiệu win rate ≥ 90%. Nếu không đủ hợp lưu thì entries = [].
Trả về JSON.`;

    const response = await fetch(
      "https://api.x.ai/v1/chat/completions",
      {
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
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit. Thử lại sau." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Hết credit AI." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    
    let parsed;
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
      parsed = JSON.parse(jsonMatch[1]!.trim());
    } catch {
      console.error("Failed to parse AI response:", content);
      return new Response(JSON.stringify({ error: "AI response format error", raw: content }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Filter: only entries with winRate >= 90
    if (parsed.entries) {
      parsed.entries = parsed.entries.filter((e: any) => (e.winRate || e.confidence || 0) >= 90);
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-market error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
