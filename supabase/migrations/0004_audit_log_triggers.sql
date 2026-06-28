-- Phase D: generic audit trigger, attached to all tracked tables including
-- the manifest additions (bookings, vessel_movements). audit_log existed in
-- the schema from day one but nothing ever wrote to it — ContainerInfoOverlay's
-- Audit tab and fetchRecentActivity() were reading a table no trigger fed.

create or replace function log_audit_event()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into audit_log (table_name, row_id, action, changed_by, old_data, new_data)
  values (
    TG_TABLE_NAME,
    coalesce((case when TG_OP = 'DELETE' then old.id else new.id end), null),
    TG_OP,
    auth.uid(),
    case when TG_OP in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when TG_OP in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
  );
  return case when TG_OP = 'DELETE' then old else new end;
end;
$$;

create trigger audit_voyages        after insert or update or delete on voyages        for each row execute function log_audit_event();
create trigger audit_containers     after insert or update or delete on containers     for each row execute function log_audit_event();
create trigger audit_stuffing_lines after insert or update or delete on stuffing_lines for each row execute function log_audit_event();
create trigger audit_shippers       after insert or update or delete on shippers       for each row execute function log_audit_event();
create trigger audit_consignees     after insert or update or delete on consignees     for each row execute function log_audit_event();
create trigger audit_bookings           after insert or update or delete on bookings           for each row execute function log_audit_event();
create trigger audit_vessel_movements   after insert or update or delete on vessel_movements   for each row execute function log_audit_event();
