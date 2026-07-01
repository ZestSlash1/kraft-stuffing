-- Link a voided document to the one that replaced it. Render-only for now:
-- set manually or by a future reissue flow.
alter table documents add column superseded_by uuid references documents(id);
