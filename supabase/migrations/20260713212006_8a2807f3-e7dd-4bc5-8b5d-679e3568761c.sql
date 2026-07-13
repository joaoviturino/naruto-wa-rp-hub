
ALTER TYPE public.item_type ADD VALUE IF NOT EXISTS 'weapon';
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS primary_weapon_durability integer;
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS secondary_weapon_durability integer;
