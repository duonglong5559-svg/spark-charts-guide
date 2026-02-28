
-- Trade journal table (no auth required - local device usage)
CREATE TABLE public.trade_journal (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  trade_type TEXT NOT NULL CHECK (trade_type IN ('LONG', 'SHORT')),
  entry_price NUMERIC NOT NULL,
  exit_price NUMERIC,
  tp1 NUMERIC,
  tp2 NUMERIC,
  tp3 NUMERIC,
  sl NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'TP1', 'TP2', 'TP3', 'SL', 'CLOSED')),
  pnl NUMERIC,
  pnl_pct NUMERIC,
  strategy TEXT,
  confluences TEXT[],
  notes TEXT,
  ai_analysis JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  closed_at TIMESTAMP WITH TIME ZONE
);

-- Price alerts table
CREATE TABLE public.price_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol TEXT NOT NULL,
  target_price NUMERIC NOT NULL,
  condition TEXT NOT NULL CHECK (condition IN ('ABOVE', 'BELOW', 'CROSS')),
  alert_type TEXT NOT NULL DEFAULT 'PRICE' CHECK (alert_type IN ('PRICE', 'RSI', 'PIVOT', 'AI_SIGNAL')),
  message TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  triggered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Disable RLS for public access (no auth)
ALTER TABLE public.trade_journal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_alerts ENABLE ROW LEVEL SECURITY;

-- Allow all operations without auth (single user app)
CREATE POLICY "Allow all access to trade_journal" ON public.trade_journal FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to price_alerts" ON public.price_alerts FOR ALL USING (true) WITH CHECK (true);
