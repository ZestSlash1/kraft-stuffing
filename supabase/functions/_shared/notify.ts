// Shared notification-emission helper for the notify-* edge functions.
// (TRACKING_AND_NOTIFICATIONS §B.1) Inserts one notification_events row and the
// pending email notification_deliveries for the resolved recipients. Recipient
// RESOLUTION stays with each caller (it differs per event); this helper only
// writes the ledger. Sending is the Vercel cron worker's job — never here, so a
// send failure can never block the operational action that emitted the event.

// Team recipients configured per event type in org_settings
// ('notify_team_recipients' -> JSON { event_type: [email, ...] }).
export async function teamRecipients(supabase: any, eventType: string): Promise<string[]> {
  const { data } = await supabase
    .from("org_settings")
    .select("value")
    .eq("key", "notify_team_recipients")
    .maybeSingle();
  if (!data?.value) return [];
  try {
    const map = JSON.parse(data.value);
    return Array.isArray(map?.[eventType]) ? map[eventType] : [];
  } catch {
    return [];
  }
}

export async function emitNotification(
  supabase: any,
  args: {
    orgId: string;
    eventType: string;
    entityType: string;
    entityId: string;
    payload: Record<string, unknown>;
    recipients: (string | null | undefined)[];
  }
) {
  const { data: event, error } = await supabase
    .from("notification_events")
    .insert({
      org_id: args.orgId,
      event_type: args.eventType,
      entity_type: args.entityType,
      entity_id: args.entityId,
      payload: args.payload,
    })
    .select("id")
    .single();
  if (error) throw error;

  const unique = [
    ...new Set(
      (args.recipients || [])
        .map((e) => (e || "").trim().toLowerCase())
        .filter((e) => e.includes("@"))
    ),
  ];
  if (unique.length) {
    await supabase.from("notification_deliveries").insert(
      unique.map((r) => ({ event_id: event.id, channel: "email", recipient: r }))
    );
  }
  return { eventId: event.id, recipientCount: unique.length };
}
