-- Migration: public tracking links (TRACKING_AND_NOTIFICATIONS §A.2)
-- Adds a per-booking opaque tracking token. Null = no public link.
-- The token is a ≥128-bit URL-safe random string minted by the authed write
-- path (never sequential, never derived from booking id/number). Public read
-- access exists ONLY through the api/track/[token] endpoint's field whitelist —
-- no RLS policy below is weakened, no public policy is added.

alter table bookings add column if not exists tracking_token      text unique; -- null = no public link
alter table bookings add column if not exists tracking_enabled_at timestamptz;  -- audit convenience

-- Partial index for the public lookup (token-only, no enumeration path).
create index if not exists idx_bookings_tracking_token
  on bookings (tracking_token)
  where tracking_token is not null;
