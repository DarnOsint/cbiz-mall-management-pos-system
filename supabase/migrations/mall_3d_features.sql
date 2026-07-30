-- Mall 3D Features — Doors, Windows & Architectural Elements
CREATE TABLE IF NOT EXISTS mall_shop_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES mall_shops(id) ON DELETE CASCADE,
  feature_type text NOT NULL CHECK (feature_type IN ('door', 'window')),
  face text NOT NULL CHECK (face IN ('front', 'back', 'left', 'right')),
  offset_x numeric(5,2) NOT NULL DEFAULT 0.5,
  offset_y numeric(5,2) NOT NULL DEFAULT 0.5,
  width numeric(5,2) NOT NULL DEFAULT 0.6,
  height numeric(5,2) NOT NULL DEFAULT 1.8,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE mall_shop_features ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "mall_features_read_all"
  ON mall_shop_features FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY IF NOT EXISTS "mall_features_write_admin"
  ON mall_shop_features FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('owner','manager'))
  );
