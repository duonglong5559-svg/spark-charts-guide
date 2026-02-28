import { useState, useCallback } from 'react';
import { Brain, Loader2, TrendingUp, TrendingDown, Minus, Layers, Target, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface TimeframeData {
  trend: 'UPTREND' | 'DOWNTREND' | 'SIDEWAYS';
  strength: number;
  keyLevel: number;
  signal: 'BUY' | 'SELL' | 'WAIT';
  note: string;
}

interface MTFAnalysis {
  overallBias: string;
  confidence: number;
  timeframes: {
    M5: TimeframeData;
    H1: TimeframeData;
    H4: TimeframeData;
  };
  confluence: {
    aligned: boolean;
    direction: string;
    factors: string[];
    score: number;
  };
  bestEntry: {
    type: 'LONG' | 'SHORT' | 'NONE';
    price: number;
    tp: number;
    sl: number;
    rr: string;
    timeframe: string;
    reason: string;
  };
  summary: string;
  warning: string;
}

interface Props {
  symbol: string;
}

const MTF_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/multi-timeframe`;

export default function MultiTimeframePanel({ symbol }: Props) {
  const [analysis, setAnalysis] = useState<MTFAnalysis | null>(null);
  const [loading, setLoading] = useState(false);

  const analyze = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch(MTF_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ symbol }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
        throw new Error(err.error || `HTTP ${resp.status}`);
      }

      const data: MTFAnalysis = await resp.json();
      setAnalysis(data);
      toast.success(`🔍 MTF: ${data.overallBias} (${data.confidence}%)`, { duration: 4000 });
    } catch (e: any) {
      toast.error(e.message || 'Lỗi phân tích MTF');
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  const getBiasColor = (bias: string) => {
    if (bias.includes('LONG')) return 'text-bull';
    if (bias.includes('SHORT')) return 'text-bear';
    return 'text-pivot';
  };

  const getBiasBg = (bias: string) => {
    if (bias.includes('LONG')) return 'bg-bull/20 border-bull/40';
    if (bias.includes('SHORT')) return 'bg-bear/20 border-bear/40';
    return 'bg-pivot/20 border-pivot/40';
  };

  const TrendIcon = ({ trend }: { trend: string }) => {
    if (trend === 'UPTREND') return <TrendingUp className="w-3.5 h-3.5 text-bull" />;
    if (trend === 'DOWNTREND') return <TrendingDown className="w-3.5 h-3.5 text-bear" />;
    return <Minus className="w-3.5 h-3.5 text-pivot" />;
  };

  const SignalBadge = ({ signal }: { signal: string }) => {
    const color = signal === 'BUY' ? 'bg-bull text-primary-foreground' : signal === 'SELL' ? 'bg-bear text-primary-foreground' : 'bg-secondary text-muted-foreground';
    return <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${color}`}>{signal}</span>;
  };

  return (
    <div className="space-y-3">
      <button
        onClick={analyze}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-xs font-semibold disabled:opacity-40 hover:opacity-90 transition-all"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
        {loading ? 'Đang phân tích đa khung...' : 'Phân tích Multi-Timeframe (M5+H1+H4)'}
      </button>

      {!analysis && !loading && (
        <div className="text-center py-8 bg-card rounded-lg border border-border">
          <Layers className="w-10 h-10 text-primary/30 mx-auto mb-3" />
          <p className="text-xs text-muted-foreground">Nhấn nút để phân tích đồng thời M5, H1, H4</p>
          <p className="text-[10px] text-muted-foreground mt-1">AI sẽ tìm hợp lưu đa khung thời gian</p>
        </div>
      )}

      {loading && !analysis && (
        <div className="text-center py-8 bg-card rounded-lg border border-border">
          <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-3" />
          <p className="text-xs text-muted-foreground">Đang tải dữ liệu M5 + H1 + H4 từ Binance...</p>
          <p className="text-[10px] text-muted-foreground mt-1">Grok AI đang phân tích hợp lưu đa khung</p>
        </div>
      )}

      {analysis && (
        <>
          {/* Overall Bias */}
          <div className={`rounded-lg border-2 p-4 ${getBiasBg(analysis.overallBias)}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-primary" />
                <span className={`text-lg font-black ${getBiasColor(analysis.overallBias)}`}>
                  {analysis.overallBias.replace('_', ' ')}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-muted-foreground">Confidence</span>
                <span className={`text-sm font-bold ${getBiasColor(analysis.overallBias)}`}>{analysis.confidence}%</span>
              </div>
            </div>
            <p className="text-xs text-foreground leading-relaxed">{analysis.summary}</p>
          </div>

          {/* Timeframe Cards */}
          <div className="grid grid-cols-3 gap-2">
            {(['M5', 'H1', 'H4'] as const).map(tf => {
              const data = analysis.timeframes[tf];
              if (!data) return null;
              return (
                <div key={tf} className="bg-card rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-primary">{tf}</span>
                    <SignalBadge signal={data.signal} />
                  </div>
                  <div className="flex items-center gap-1 mb-1">
                    <TrendIcon trend={data.trend} />
                    <span className={`text-[10px] font-bold ${
                      data.trend === 'UPTREND' ? 'text-bull' : data.trend === 'DOWNTREND' ? 'text-bear' : 'text-pivot'
                    }`}>{data.trend}</span>
                  </div>
                  <div className="flex gap-0.5 mb-1.5">
                    {Array.from({ length: 10 }).map((_, i) => (
                      <div key={i} className={`flex-1 h-1 rounded-sm ${i < data.strength ? (data.trend === 'UPTREND' ? 'bg-bull' : data.trend === 'DOWNTREND' ? 'bg-bear' : 'bg-pivot') : 'bg-secondary'}`} />
                    ))}
                  </div>
                  <p className="text-[9px] text-muted-foreground font-mono">Key: {data.keyLevel?.toLocaleString()}</p>
                  <p className="text-[9px] text-muted-foreground mt-1 line-clamp-2">{data.note}</p>
                </div>
              );
            })}
          </div>

          {/* Confluence */}
          <div className="bg-card rounded-lg border border-border p-4">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-bold text-primary">HỢP LƯU ĐA KHUNG</span>
              <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                analysis.confluence.aligned ? 'bg-bull/20 text-bull' : 'bg-bear/20 text-bear'
              }`}>
                {analysis.confluence.aligned ? '✓ ĐỒNG THUẬN' : '✗ PHÂN KỲ'}
              </span>
              <span className="text-[10px] font-mono text-muted-foreground ml-auto">
                Score: {analysis.confluence.score}/10
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {analysis.confluence.factors.map((f, i) => (
                <span key={i} className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[9px]">
                  {f}
                </span>
              ))}
            </div>
          </div>

          {/* Best Entry */}
          {analysis.bestEntry && analysis.bestEntry.type !== 'NONE' && (
            <div className={`rounded-lg border-2 p-4 ${
              analysis.bestEntry.type === 'LONG' ? 'border-bull/50 bg-bull-muted/20' : 'border-bear/50 bg-bear-muted/20'
            }`}>
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="w-4 h-4 text-bull" />
                <span className="text-xs font-bold text-foreground">BEST ENTRY (MTF)</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  analysis.bestEntry.type === 'LONG' ? 'bg-bull text-primary-foreground' : 'bg-bear text-primary-foreground'
                }`}>{analysis.bestEntry.type}</span>
                <span className="text-[9px] text-pivot font-mono ml-auto">TF: {analysis.bestEntry.timeframe}</span>
              </div>
              <div className="grid grid-cols-4 gap-1.5 mb-2">
                <div className="bg-card/50 rounded p-2 text-center">
                  <p className="text-[8px] text-muted-foreground">ENTRY</p>
                  <p className="text-[11px] font-mono font-bold">{analysis.bestEntry.price?.toLocaleString()}</p>
                </div>
                <div className="bg-card/50 rounded p-2 text-center">
                  <p className="text-[8px] text-bull">TP</p>
                  <p className="text-[11px] font-mono font-bold text-bull">{analysis.bestEntry.tp?.toLocaleString()}</p>
                </div>
                <div className="bg-card/50 rounded p-2 text-center">
                  <p className="text-[8px] text-bear">SL</p>
                  <p className="text-[11px] font-mono font-bold text-bear">{analysis.bestEntry.sl?.toLocaleString()}</p>
                </div>
                <div className="bg-card/50 rounded p-2 text-center">
                  <p className="text-[8px] text-pivot">RR</p>
                  <p className="text-[11px] font-mono font-bold text-pivot">{analysis.bestEntry.rr}</p>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground">{analysis.bestEntry.reason}</p>
            </div>
          )}

          {/* Warning */}
          {analysis.warning && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-bear-muted/30 border border-bear/20">
              <AlertTriangle className="w-4 h-4 text-bear shrink-0 mt-0.5" />
              <p className="text-[10px] text-muted-foreground">{analysis.warning}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
