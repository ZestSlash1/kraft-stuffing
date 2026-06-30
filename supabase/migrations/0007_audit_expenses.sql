-- E-4: expenses was added in the ce54330 commit without a migration file, so
-- it never got the generic audit trigger from 0004_audit_log_triggers.sql.
-- log_audit_event() already exists — just attach it here.

create trigger audit_expenses after insert or update or delete on expenses
  for each row execute function log_audit_event();
