CREATE TABLE IF NOT EXISTS mall_maintenance_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES mall_shops(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  requested_by TEXT,
  requested_by_name TEXT,
  assigned_to TEXT,
  assigned_to_name TEXT,
  resolution_notes TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mall_rent_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES mall_shops(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  rent_amount NUMERIC NOT NULL,
  late_fee NUMERIC DEFAULT 0,
  total_amount NUMERIC NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
  paid_at TIMESTAMPTZ,
  paid_by UUID REFERENCES profiles(id),
  paid_by_name TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
