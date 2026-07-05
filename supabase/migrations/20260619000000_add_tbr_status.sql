-- ─────────────────────────────────────────────────────────────────────────────
-- Split "want" into two distinct shelves:
--   want — wishlist: don't own it yet (want to buy/borrow)
--   tbr  — own it, haven't started reading yet
-- Previously both were conflated under 'want' (the Library "Want" tab and the
-- Home/Library "To be read" surfaces both read status='want'), so a wishlist
-- item incorrectly showed up as "up next"/TBR. Purely additive: existing rows
-- keep their 'want' status (no backfill — the split only applies going forward
-- via the add-book shelf picker and the book-detail status pills).
--
-- NOTE: run this file ALONE (its own transaction/connection) and let it commit
-- before running anything that references the new 'tbr' label — Postgres does
-- not allow a freshly-added enum value to be used within the same transaction
-- that added it.
--
-- Run: paste into Supabase SQL Editor, or `supabase db push`. Idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

alter type public.reading_status add value if not exists 'tbr' after 'want';
