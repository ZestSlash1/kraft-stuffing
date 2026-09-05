-- Migration: public `mail-assets` bucket for mail signature images (logos).
--
-- Signature images are embedded in outgoing email as <img src="…public URL…">.
-- Recipients are NOT authenticated and signed URLs expire, so — unlike the private
-- `attachments`/`documents` buckets — this bucket MUST be public-read. Writes stay
-- restricted to authenticated app users. No metadata table: the public URL lives
-- inline in the account's signature_html, which is the only reference we need.

insert into storage.buckets (id, name, public)
  values ('mail-assets', 'mail-assets', true)
  on conflict (id) do update set public = true;

-- Public read (anon + authenticated) so email clients can load the logo.
do $$ begin
  create policy "mail_assets_public_select" on storage.objects
    for select using (bucket_id = 'mail-assets');
exception when duplicate_object then null; end $$;

-- Writes: authenticated app users only.
do $$ begin
  create policy "mail_assets_auth_insert" on storage.objects
    for insert with check (bucket_id = 'mail-assets' and auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "mail_assets_auth_update" on storage.objects
    for update using (bucket_id = 'mail-assets' and auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;
