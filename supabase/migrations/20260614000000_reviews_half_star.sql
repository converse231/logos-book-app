-- ─────────────────────────────────────────────────────────────────────────────
-- Half-star ratings. reviews.rating was smallint(1–5), which silently rounded
-- every half-star to a whole one. Widen it to numeric(2,1) and allow 0.5 steps
-- from 0.5 to 5.0 so the half-star UI actually persists.
--
-- Run: paste into the Supabase SQL Editor (or `supabase db push`). Idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.reviews drop constraint if exists reviews_rating_check;

alter table public.reviews
  alter column rating type numeric(2,1) using rating::numeric(2,1);

alter table public.reviews
  add constraint reviews_rating_check
  check (rating >= 0.5 and rating <= 5 and (rating * 2) = floor(rating * 2));
