-- Resize ALL existing shops to 50x50, fix names (remove "Shop " prefix)
UPDATE mall_shops SET
  width = 50, height = 50, shop_name = shop_number,
  pos_x = ((row_number - 1) % 10) * 55,
  pos_y = floor((row_number - 1) / 10) * 55
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY floor_id ORDER BY shop_number) AS row_number
  FROM mall_shops
) AS sub
WHERE mall_shops.id = sub.id;
