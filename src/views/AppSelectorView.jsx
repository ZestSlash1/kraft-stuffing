import { Ship, FileText } from "lucide-react";
import { TOKENS } from "../data/statusHelpers";

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
];

export default function AppSelectorView({ onSelect }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: TOKENS.bg,
        backgroundImage:
          "repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(255,255,255,0.012) 1px, rgba(255,255,255,0.012) 2px)",
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
            fontFamily: TOKENS.condensed,
            fontWeight: 800,
            fontSize: 32,
            letterSpacing: "0.02em",
            color: "#e8eef4",
            lineHeight: 1,
          }}
        >
          KRAFT PORTAL
        </div>
        <div
          style={{
            fontFamily: TOKENS.mono,
            fontSize: 10,
            letterSpacing: "0.22em",
            color: TOKENS.steel,
            marginTop: 10,
            textTransform: "uppercase",
          }}
        >
          Choose a section
        </div>

        <div style={{ height: 48 }} />

        <div
          className="app-selector-grid"
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}
        >
          {CARDS.map(({ page, title, sub, Icon }) => (
            <button
              key={page}
              onClick={() => onSelect(page)}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = TOKENS.amber)}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = TOKENS.border)}
              style={{
                background: TOKENS.surface,
                border: `1px solid ${TOKENS.border}`,
                borderRadius: 0,
                padding: "40px 20px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 14,
                cursor: "pointer",
                transition: "border-color 0.15s ease",
              }}
            >
              <Icon size={32} color={TOKENS.amber} />
              <div
                style={{
                  fontFamily: TOKENS.condensed,
                  fontWeight: 800,
                  fontSize: 20,
                  letterSpacing: "0.04em",
                  color: "#e8eef4",
                }}
              >
                {title}
              </div>
              <div style={{ fontFamily: TOKENS.mono, fontSize: 11, color: TOKENS.steel }}>
                {sub}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
