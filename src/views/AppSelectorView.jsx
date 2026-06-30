import { Ship, FileText, Receipt } from "lucide-react";
import { theme } from "../theme";

const CARDS = [
  {
    page: "dashboard",
    title: "STUFFING LOG",
    sub: "Container stuffing & voyage tracking",
    Icon: Ship,
  },
  {
    page: "manifest",
    title: "MANIFEST",
    sub: "Bookings, vessel movements & documents",
    Icon: FileText,
  },
  {
    page: "expenses",
    title: "EXPENSES",
    sub: "Kraft Shipping & Logistics",
    Icon: Receipt,
  },
];

export default function AppSelectorView({ onSelect }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: theme.color.canvas,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div style={{ width: "100%", maxWidth: 640, textAlign: "center" }}>
        <img
          src="/kraft-logo.png"
          height="64"
          alt="Kraft"
          style={{ display: "block", margin: "0 auto 20px" }}
        />
        <div
          style={{
            fontFamily: theme.font.condensed,
            fontWeight: 800,
            fontSize: 32,
            letterSpacing: "0.02em",
            color: theme.color.ink,
            lineHeight: 1,
          }}
        >
          KRAFT PORTAL
        </div>
        <div
          style={{
            fontFamily: theme.font.mono,
            fontSize: 10,
            letterSpacing: "0.22em",
            color: theme.color.slate,
            marginTop: 10,
            textTransform: "uppercase",
          }}
        >
          Choose a section
        </div>

        <div style={{ height: 48 }} />

        <div
          className="app-selector-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 16,
          }}
        >
          {CARDS.map(({ page, title, sub, Icon }) => (
            <button
              key={page}
              onClick={() => onSelect(page)}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = theme.color.amber)}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = theme.color.border)}
              style={{
                background: theme.color.surface,
                border: `1px solid ${theme.color.border}`,
                borderRadius: theme.radius.card,
                boxShadow: theme.shadow.card,
                padding: "40px 20px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 14,
                cursor: "pointer",
                transition: "border-color 0.15s ease",
              }}
            >
              <Icon size={32} color={theme.color.amber} />
              <div
                style={{
                  fontFamily: theme.font.condensed,
                  fontWeight: 800,
                  fontSize: 20,
                  letterSpacing: "0.04em",
                  color: theme.color.ink,
                }}
              >
                {title}
              </div>
              <div style={{ fontFamily: theme.font.mono, fontSize: 11, color: theme.color.slate }}>
                {sub}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
