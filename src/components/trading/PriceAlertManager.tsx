import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Bell, Plus, X, Trash2, Loader2, Volume2 } from 'lucide-react';
import { toast } from 'sonner';

interface Alert {
  id: string;
  symbol: string;
  target_price: number;
  condition: string;
  alert_type: string;
  message: string | null;
  is_active: boolean;
  triggered_at: string | null;
  created_at: string;
}

interface Props {
  symbol: string;
  currentPrice: number;
}

export default function PriceAlertManager({ symbol, currentPrice }: Props) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ target_price: '', condition: 'ABOVE', message: '' });
  const lastCheckRef = useRef<Record<string, boolean>>({});

  const fetchAlerts = useCallback(async () => {
    const { data, error } = await supabase
      .from('price_alerts')
      .select('*')
      .eq('symbol', symbol)
      .order('created_at', { ascending: false });
    
    if (!error) setAlerts((data as any[]) || []);
    setLoading(false);
  }, [symbol]);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  // Check alerts against current price
  useEffect(() => {
    if (!currentPrice || alerts.length === 0) return;

    alerts.filter(a => a.is_active && !a.triggered_at).forEach(async (alert) => {
      const key = alert.id;
      let triggered = false;

      if (alert.condition === 'ABOVE' && currentPrice >= alert.target_price) triggered = true;
      if (alert.condition === 'BELOW' && currentPrice <= alert.target_price) triggered = true;
      if (alert.condition === 'CROSS') {
        const wasAbove = lastCheckRef.current[key];
        const isAbove = currentPrice >= alert.target_price;
        if (wasAbove !== undefined && wasAbove !== isAbove) triggered = true;
        lastCheckRef.current[key] = isAbove;
      }

      if (triggered && !lastCheckRef.current[`triggered_${key}`]) {
        lastCheckRef.current[`triggered_${key}`] = true;
        
        // Play sound
        try {
          const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH+Jj4yDe3F0goyVl5GMgHN0g5GdoJiShHh0hZeqsa2ejHx2i6G0ub20n4t6e5Wuv8jDtaSNfoCetcXQzMCsl4R7l7bJ1dHEsJ6Jf5u3ydXRw6+eiH6atcfT0cSwnop/m7bI09HEsZ+KgJy3ydXRxLKginqVsMPO0cW2p5CGhKS9zNTTxbapkIWDo7zM09LFtqmQhYOjvMzT0sW2qZCFg6O8zNPSxbapkIWDo7zM09K/');
          audio.volume = 0.5;
          audio.play().catch(() => {});
        } catch {}

        toast.warning(
          `🔔 ${alert.symbol}: Giá ${currentPrice.toLocaleString()} đã ${
            alert.condition === 'ABOVE' ? 'vượt' : alert.condition === 'BELOW' ? 'xuống dưới' : 'cắt qua'
          } ${alert.target_price.toLocaleString()}${alert.message ? ` - ${alert.message}` : ''}`,
          { duration: 10000 }
        );

        await supabase
          .from('price_alerts')
          .update({ triggered_at: new Date().toISOString(), is_active: false } as any)
          .eq('id', alert.id);
        
        fetchAlerts();
      }
    });
  }, [currentPrice, alerts]);

  const saveAlert = async () => {
    if (!formData.target_price) { toast.error('Nhập giá mục tiêu'); return; }

    const { error } = await supabase.from('price_alerts').insert({
      symbol,
      target_price: parseFloat(formData.target_price),
      condition: formData.condition,
      message: formData.message || null,
    } as any);

    if (error) {
      toast.error('Lỗi tạo cảnh báo');
    } else {
      toast.success('🔔 Đã tạo cảnh báo giá');
      setShowForm(false);
      setFormData({ target_price: '', condition: 'ABOVE', message: '' });
      fetchAlerts();
    }
  };

  const deleteAlert = async (id: string) => {
    await supabase.from('price_alerts').delete().eq('id', id);
    fetchAlerts();
  };

  const quickAlert = (price: number, condition: string, label: string) => {
    setFormData({ target_price: price.toString(), condition, message: label });
    setShowForm(true);
  };

  return (
    <div className="space-y-3">
      {/* Quick Alert Buttons */}
      <div className="flex flex-wrap gap-1.5">
        <button onClick={() => quickAlert(currentPrice * 1.01, 'ABOVE', '+1%')}
          className="px-2 py-1 rounded bg-bull/10 text-bull text-[9px] font-bold hover:bg-bull/20 border border-bull/20">
          🔔 +1%: {(currentPrice * 1.01).toLocaleString()}
        </button>
        <button onClick={() => quickAlert(currentPrice * 1.02, 'ABOVE', '+2%')}
          className="px-2 py-1 rounded bg-bull/10 text-bull text-[9px] font-bold hover:bg-bull/20 border border-bull/20">
          🔔 +2%
        </button>
        <button onClick={() => quickAlert(currentPrice * 0.99, 'BELOW', '-1%')}
          className="px-2 py-1 rounded bg-bear/10 text-bear text-[9px] font-bold hover:bg-bear/20 border border-bear/20">
          🔔 -1%: {(currentPrice * 0.99).toLocaleString()}
        </button>
        <button onClick={() => quickAlert(currentPrice * 0.98, 'BELOW', '-2%')}
          className="px-2 py-1 rounded bg-bear/10 text-bear text-[9px] font-bold hover:bg-bear/20 border border-bear/20">
          🔔 -2%
        </button>
      </div>

      {/* Add Button */}
      <button onClick={() => setShowForm(!showForm)}
        className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:opacity-90">
        {showForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
        {showForm ? 'Đóng' : 'Tạo Cảnh báo'}
      </button>

      {/* Form */}
      {showForm && (
        <div className="bg-card rounded-lg border border-border p-4 space-y-3">
          <div className="flex gap-2">
            {[
              { v: 'ABOVE', l: '≥ Trên', c: 'text-bull' },
              { v: 'BELOW', l: '≤ Dưới', c: 'text-bear' },
              { v: 'CROSS', l: '↔ Cắt', c: 'text-pivot' },
            ].map(opt => (
              <button key={opt.v} onClick={() => setFormData(p => ({ ...p, condition: opt.v }))}
                className={`flex-1 py-2 rounded text-xs font-bold transition-all ${
                  formData.condition === opt.v ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
                }`}>{opt.l}</button>
            ))}
          </div>
          <input type="number" placeholder={`Giá mục tiêu (hiện tại: ${currentPrice.toLocaleString()})`}
            value={formData.target_price}
            onChange={e => setFormData(p => ({ ...p, target_price: e.target.value }))}
            className="w-full bg-secondary border border-border rounded px-3 py-2 text-xs font-mono text-foreground" />
          <input type="text" placeholder="Ghi chú (tùy chọn)" value={formData.message}
            onChange={e => setFormData(p => ({ ...p, message: e.target.value }))}
            className="w-full bg-secondary border border-border rounded px-3 py-2 text-xs text-foreground" />
          <button onClick={saveAlert} className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-xs font-bold hover:opacity-90">
            🔔 Tạo Cảnh báo
          </button>
        </div>
      )}

      {/* Alert List */}
      {loading ? (
        <div className="text-center py-6"><Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" /></div>
      ) : alerts.length === 0 ? (
        <div className="text-center py-8 bg-card rounded-lg border border-border">
          <Bell className="w-10 h-10 text-primary/30 mx-auto mb-3" />
          <p className="text-xs text-muted-foreground">Chưa có cảnh báo nào</p>
          <p className="text-[10px] text-muted-foreground mt-1">Tạo cảnh báo để nhận thông báo khi giá chạm mục tiêu</p>
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map(alert => (
            <div key={alert.id} className={`bg-card rounded-lg border p-3 ${
              alert.is_active ? 'border-primary/30' : alert.triggered_at ? 'border-pivot/30 opacity-60' : 'border-border opacity-40'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {alert.is_active ? (
                    <Volume2 className="w-3.5 h-3.5 text-primary animate-pulse" />
                  ) : (
                    <Bell className="w-3.5 h-3.5 text-muted-foreground" />
                  )}
                  <span className={`text-xs font-mono font-bold ${
                    alert.condition === 'ABOVE' ? 'text-bull' : alert.condition === 'BELOW' ? 'text-bear' : 'text-pivot'
                  }`}>
                    {alert.condition === 'ABOVE' ? '≥' : alert.condition === 'BELOW' ? '≤' : '↔'} {alert.target_price.toLocaleString()}
                  </span>
                  <span className="text-[9px] text-muted-foreground font-mono">{alert.symbol}</span>
                  {alert.triggered_at && (
                    <span className="px-1.5 py-0.5 rounded bg-pivot/20 text-pivot text-[8px] font-bold">TRIGGERED</span>
                  )}
                </div>
                <button onClick={() => deleteAlert(alert.id)}
                  className="p-1 rounded text-muted-foreground hover:text-bear hover:bg-bear/10">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
              {alert.message && <p className="text-[9px] text-muted-foreground mt-1">📝 {alert.message}</p>}
              <div className="flex justify-between mt-1">
                <span className="text-[8px] text-muted-foreground">
                  {new Date(alert.created_at).toLocaleString('vi-VN')}
                </span>
                {alert.is_active && (
                  <span className="text-[8px] text-muted-foreground font-mono">
                    Cách {Math.abs(((currentPrice - alert.target_price) / currentPrice) * 100).toFixed(2)}%
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
