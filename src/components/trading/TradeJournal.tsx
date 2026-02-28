import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { BookOpen, Plus, X, TrendingUp, TrendingDown, DollarSign, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { AIAnalysis } from './AISignalPanel';

interface Trade {
  id: string;
  symbol: string;
  timeframe: string;
  trade_type: string;
  entry_price: number;
  exit_price: number | null;
  tp1: number | null;
  tp2: number | null;
  tp3: number | null;
  sl: number;
  status: string;
  pnl: number | null;
  pnl_pct: number | null;
  strategy: string | null;
  confluences: string[] | null;
  notes: string | null;
  created_at: string;
  closed_at: string | null;
}

interface Props {
  symbol: string;
  timeframe: string;
  currentPrice: number;
  aiAnalysis: AIAnalysis | null;
}

export default function TradeJournal({ symbol, timeframe, currentPrice, aiAnalysis }: Props) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    trade_type: 'LONG',
    entry_price: '',
    sl: '',
    tp1: '',
    tp2: '',
    strategy: 'SCALP',
    notes: '',
  });

  const fetchTrades = useCallback(async () => {
    const { data, error } = await supabase
      .from('trade_journal')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);
    
    if (error) {
      toast.error('Lỗi tải nhật ký');
    } else {
      setTrades((data as any[]) || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchTrades(); }, [fetchTrades]);

  const addFromAI = useCallback(() => {
    if (!aiAnalysis?.entries?.length) return;
    const entry = aiAnalysis.entries[0];
    setFormData({
      trade_type: entry.type,
      entry_price: entry.entry.toString(),
      sl: entry.sl.toString(),
      tp1: entry.tp1.toString(),
      tp2: entry.tp2.toString(),
      strategy: entry.strategy,
      notes: entry.reason,
    });
    setShowForm(true);
  }, [aiAnalysis]);

  const saveTrade = async () => {
    if (!formData.entry_price || !formData.sl) {
      toast.error('Vui lòng nhập Entry và SL');
      return;
    }

    const { error } = await supabase.from('trade_journal').insert({
      symbol,
      timeframe,
      trade_type: formData.trade_type,
      entry_price: parseFloat(formData.entry_price),
      sl: parseFloat(formData.sl),
      tp1: formData.tp1 ? parseFloat(formData.tp1) : null,
      tp2: formData.tp2 ? parseFloat(formData.tp2) : null,
      strategy: formData.strategy,
      notes: formData.notes || null,
      confluences: aiAnalysis?.entries?.[0]?.confluences || null,
      ai_analysis: aiAnalysis ? { trend: aiAnalysis.trend, trendStrength: aiAnalysis.trendStrength } : null,
    } as any);

    if (error) {
      toast.error('Lỗi lưu trade');
    } else {
      toast.success('✅ Đã lưu trade vào nhật ký');
      setShowForm(false);
      setFormData({ trade_type: 'LONG', entry_price: '', sl: '', tp1: '', tp2: '', strategy: 'SCALP', notes: '' });
      fetchTrades();
    }
  };

  const closeTrade = async (trade: Trade, exitPrice: number) => {
    const pnl = trade.trade_type === 'LONG' 
      ? exitPrice - trade.entry_price 
      : trade.entry_price - exitPrice;
    const pnlPct = (pnl / trade.entry_price) * 100;

    const { error } = await supabase
      .from('trade_journal')
      .update({
        exit_price: exitPrice,
        pnl: parseFloat(pnl.toFixed(2)),
        pnl_pct: parseFloat(pnlPct.toFixed(2)),
        status: 'CLOSED',
        closed_at: new Date().toISOString(),
      } as any)
      .eq('id', trade.id);

    if (error) {
      toast.error('Lỗi đóng trade');
    } else {
      toast.success(`Trade đóng: ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} (${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%)`);
      fetchTrades();
    }
  };

  const deleteTrade = async (id: string) => {
    const { error } = await supabase.from('trade_journal').delete().eq('id', id);
    if (!error) {
      toast.success('Đã xóa trade');
      fetchTrades();
    }
  };

  // Stats
  const closedTrades = trades.filter(t => t.status === 'CLOSED');
  const winTrades = closedTrades.filter(t => (t.pnl ?? 0) > 0);
  const totalPnl = closedTrades.reduce((s, t) => s + (t.pnl ?? 0), 0);
  const winRate = closedTrades.length > 0 ? ((winTrades.length / closedTrades.length) * 100).toFixed(0) : '0';

  return (
    <div className="space-y-3">
      {/* Stats Bar */}
      <div className="grid grid-cols-4 gap-2">
        <div className="bg-card rounded-lg border border-border p-2 text-center">
          <p className="text-[8px] text-muted-foreground">TRADES</p>
          <p className="text-sm font-bold text-foreground">{trades.length}</p>
        </div>
        <div className="bg-card rounded-lg border border-border p-2 text-center">
          <p className="text-[8px] text-muted-foreground">WIN RATE</p>
          <p className={`text-sm font-bold ${parseInt(winRate) >= 50 ? 'text-bull' : 'text-bear'}`}>{winRate}%</p>
        </div>
        <div className="bg-card rounded-lg border border-border p-2 text-center">
          <p className="text-[8px] text-muted-foreground">TỔNG PnL</p>
          <p className={`text-sm font-bold ${totalPnl >= 0 ? 'text-bull' : 'text-bear'}`}>
            {totalPnl >= 0 ? '+' : ''}{totalPnl.toFixed(2)}
          </p>
        </div>
        <div className="bg-card rounded-lg border border-border p-2 text-center">
          <p className="text-[8px] text-muted-foreground">MỞ</p>
          <p className="text-sm font-bold text-pivot">{trades.filter(t => t.status === 'OPEN').length}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:opacity-90">
          {showForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {showForm ? 'Đóng' : 'Thêm Trade'}
        </button>
        {aiAnalysis?.entries?.length ? (
          <button onClick={addFromAI} className="flex items-center gap-1.5 px-3 py-2 bg-secondary text-foreground rounded-lg text-xs font-semibold hover:opacity-90 border border-border">
            <BookOpen className="w-3.5 h-3.5" />
            Import từ AI
          </button>
        ) : null}
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-card rounded-lg border border-border p-4 space-y-3">
          <div className="flex gap-2">
            {['LONG', 'SHORT'].map(t => (
              <button key={t} onClick={() => setFormData(p => ({ ...p, trade_type: t }))}
                className={`flex-1 py-2 rounded text-xs font-bold transition-all ${
                  formData.trade_type === t 
                    ? (t === 'LONG' ? 'bg-bull text-primary-foreground' : 'bg-bear text-primary-foreground')
                    : 'bg-secondary text-muted-foreground'
                }`}>{t}</button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input type="number" placeholder="Entry Price" value={formData.entry_price}
              onChange={e => setFormData(p => ({ ...p, entry_price: e.target.value }))}
              className="bg-secondary border border-border rounded px-3 py-2 text-xs font-mono text-foreground" />
            <input type="number" placeholder="Stop Loss" value={formData.sl}
              onChange={e => setFormData(p => ({ ...p, sl: e.target.value }))}
              className="bg-secondary border border-border rounded px-3 py-2 text-xs font-mono text-foreground" />
            <input type="number" placeholder="TP1" value={formData.tp1}
              onChange={e => setFormData(p => ({ ...p, tp1: e.target.value }))}
              className="bg-secondary border border-border rounded px-3 py-2 text-xs font-mono text-foreground" />
            <input type="number" placeholder="TP2" value={formData.tp2}
              onChange={e => setFormData(p => ({ ...p, tp2: e.target.value }))}
              className="bg-secondary border border-border rounded px-3 py-2 text-xs font-mono text-foreground" />
          </div>
          <textarea placeholder="Ghi chú..." value={formData.notes}
            onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))}
            className="w-full bg-secondary border border-border rounded px-3 py-2 text-xs text-foreground resize-none h-16" />
          <button onClick={saveTrade} className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-xs font-bold hover:opacity-90">
            💾 Lưu Trade
          </button>
        </div>
      )}

      {/* Trade List */}
      {loading ? (
        <div className="text-center py-6">
          <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
        </div>
      ) : trades.length === 0 ? (
        <div className="text-center py-8 bg-card rounded-lg border border-border">
          <BookOpen className="w-10 h-10 text-primary/30 mx-auto mb-3" />
          <p className="text-xs text-muted-foreground">Chưa có trade nào</p>
        </div>
      ) : (
        <div className="space-y-2">
          {trades.map(trade => {
            const isOpen = trade.status === 'OPEN';
            const unrealizedPnl = isOpen
              ? (trade.trade_type === 'LONG' ? currentPrice - trade.entry_price : trade.entry_price - currentPrice)
              : null;
            const pnlDisplay = isOpen ? unrealizedPnl : trade.pnl;
            const isProfit = (pnlDisplay ?? 0) >= 0;

            return (
              <div key={trade.id} className={`bg-card rounded-lg border p-3 ${
                isOpen ? 'border-primary/30' : 'border-border'
              }`}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                      trade.trade_type === 'LONG' ? 'bg-bull text-primary-foreground' : 'bg-bear text-primary-foreground'
                    }`}>{trade.trade_type}</span>
                    <span className="text-[10px] font-mono text-muted-foreground">{trade.symbol}</span>
                    <span className={`px-1 py-0.5 rounded text-[8px] ${isOpen ? 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground'}`}>
                      {trade.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {pnlDisplay !== null && (
                      <span className={`text-[11px] font-mono font-bold ${isProfit ? 'text-bull' : 'text-bear'}`}>
                        {isProfit ? '+' : ''}{pnlDisplay.toFixed(2)}
                        {isOpen && <span className="text-[8px] ml-0.5">(live)</span>}
                      </span>
                    )}
                    {isOpen && (
                      <button onClick={() => closeTrade(trade, currentPrice)}
                        className="px-1.5 py-0.5 rounded bg-pivot/20 text-pivot text-[9px] font-bold hover:bg-pivot/30">
                        Đóng @{currentPrice.toLocaleString()}
                      </button>
                    )}
                    <button onClick={() => deleteTrade(trade.id)}
                      className="p-1 rounded text-muted-foreground hover:text-bear hover:bg-bear/10">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-[9px] font-mono text-muted-foreground">
                  <span>Entry: {trade.entry_price}</span>
                  <span className="text-bear">SL: {trade.sl}</span>
                  {trade.tp1 && <span className="text-bull">TP1: {trade.tp1}</span>}
                  {trade.tp2 && <span className="text-bull">TP2: {trade.tp2}</span>}
                  <span className="ml-auto">{new Date(trade.created_at).toLocaleDateString('vi-VN')}</span>
                </div>
                {trade.notes && <p className="text-[9px] text-muted-foreground mt-1 line-clamp-1">📝 {trade.notes}</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
