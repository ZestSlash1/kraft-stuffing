import { useState } from "react";
import { ChevronDown, ChevronRight, Copy } from "lucide-react";
import { theme } from "../../theme";
import { C } from "../../ui/theme";
import {
  orderedParties,
  partyLabel,
  validateEmail,
  validatePan,
  validatePin,
} from "../../data/igmHelpers";
import { Field, SectionDot, TextInput, mono, secondaryBtn } from "./igmChrome";

// Party cards — one collapsible card per BL role. Every role is always present
// (rows are created with the BL) so there is no "add a party" step and no
// party-type selector to get wrong; a role you don't use simply stays blank and
// is dropped from the export.
export default function PartyCards({ parties = [], onPatch, isMobile }) {
  const ordered = orderedParties(parties);
  // Shipper + consignee open by default — those two get filled on every BL.
  const [open, setOpen] = useState(() => ({ shipper: true, consignee: true }));

  const copyFrom = (target, source) => {
    if (!source) return;
    const { name, address1, address2, city, pin, state, country, email, pan } = source;
    onPatch(target.id, { name, address1, address2, city, pin, state, country, email, pan });
    setOpen((o) => ({ ...o, [target.partyType]: true }));
  };

  const consignee = ordered.find((p) => p.partyType === "consignee");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {ordered.map((party) => {
        const isOpen = !!open[party.partyType];
        const filled = String(party.name || "").trim() !== "";
        return (
          <div
            key={party.id}
            style={{
              border: `1px solid ${C.hair}`,
              borderRadius: theme.radius.sm,
              background: "rgba(255,255,255,0.02)",
              overflow: "hidden",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px" }}>
              <button
                onClick={() => setOpen((o) => ({ ...o, [party.partyType]: !isOpen }))}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  flex: 1,
                  minWidth: 0,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                  textAlign: "left",
                }}
              >
                {isOpen ? <ChevronDown size={14} color={C.inkDim} /> : <ChevronRight size={14} color={C.inkDim} />}
                <SectionDot state={filled ? "ok" : "empty"} />
                <span style={{ ...mono(12.5, theme.color.ink), whiteSpace: "nowrap" }}>
                  {partyLabel(party.partyType)}
                </span>
                <span
                  style={{
                    ...mono(11, theme.color.slate),
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {filled ? party.name : "not entered"}
                </span>
              </button>
              {/* Notify parties are usually the consignee — one click instead of retyping. */}
              {(party.partyType === "notifier1" || party.partyType === "notifier2") &&
                consignee?.name && (
                  <button
                    onClick={() => copyFrom(party, consignee)}
                    style={{ ...secondaryBtn, padding: "5px 9px", fontSize: 11 }}
                    title="Copy the consignee's details into this party"
                  >
                    <Copy size={12} /> Same as consignee
                  </button>
                )}
            </div>

            {isOpen && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0, 1fr))",
                  gap: 12,
                  padding: "4px 12px 14px",
                }}
              >
                <PartyField party={party} field="name" label="Name" onPatch={onPatch} span={isMobile ? undefined : "1 / -1"} />
                <PartyField party={party} field="address1" label="Address line 1" onPatch={onPatch} span={isMobile ? undefined : "span 2"} />
                <PartyField party={party} field="address2" label="Address line 2" onPatch={onPatch} />
                <PartyField party={party} field="city" label="City" onPatch={onPatch} />
                <PartyField party={party} field="pin" label="PIN" onPatch={onPatch} check={validatePin(party.pin)} />
                <PartyField party={party} field="state" label="State" onPatch={onPatch} />
                <PartyField party={party} field="country" label="Country" onPatch={onPatch} />
                <PartyField party={party} field="email" label="Email" onPatch={onPatch} check={validateEmail(party.email)} />
                <PartyField
                  party={party}
                  field="pan"
                  label="PAN / code no."
                  onPatch={onPatch}
                  check={validatePan(party.pan)}
                  upper
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Commit on blur: party fields are free text, so writing per keystroke would be
// a write per character for no benefit.
function PartyField({ party, field, label, onPatch, check, span, upper }) {
  return (
    <Field label={label} check={check} span={span}>
      <TextInput
        key={`${party.id}-${field}`}
        defaultValue={party[field] ?? ""}
        invalid={check?.ok === false}
        style={upper ? { textTransform: "uppercase" } : undefined}
        onBlur={(e) => {
          const next = upper ? e.target.value.toUpperCase() : e.target.value;
          if (String(party[field] ?? "") !== next) onPatch(party.id, { [field]: next });
        }}
      />
    </Field>
  );
}
