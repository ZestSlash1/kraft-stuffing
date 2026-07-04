import { useState } from "react";
import { Ship, FileText, Receipt, Mail, LogOut } from "lucide-react";
import { theme } from "../theme";
import { WASH, glass } from "../ui/theme";
import { supabase } from "../lib/supabase";

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
  {
    page: "mail",
    title: "MAIL",
    sub: "Company inbox — read, reply & send",
    Icon: Mail,
  },
];

export default function AppSelectorView({ onSelect, user, profile }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const name = profile?.displayName || (user?.email || "").split("@")[0] || "user";
  const role = profile?.role === "admin" ? "Admin" : "Staff";

  const signOut = async () => {
    setMenuOpen(false);
    await supabase.auth.signOut();
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: WASH,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      {/* Stagger-fade keyframes (CSS-driven, no JS orchestration). */}
      <style>{`
        @keyframes tileIn { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        .selector-tile { opacity: 0; animation: tileIn .5s cubic-bezier(.2,.7,.2,1) forwards; }
        .selector-tile:hover { transform: translateY(-3px); box-shadow: ${theme.shadow.raised}, 0 0 22px rgba(232,147,10,0.18); border-color: rgba(232,147,10,0.35) !important; }
        .selector-tile:hover .tile-rule { transform: scaleX(1); }
      `}</style>

      {/* Top-right: user + role badge + sign-out menu */}
      <div style={{ position: "fixed", top: 18, right: 20 }}>
        <button
          onClick={() => setMenuOpen((o) => !o)}
          onBlur={() => setTimeout(() => setMenuOpen(false), 150)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            ...glass(theme.radius.pill),
            boxShadow: theme.shadow.pill,
            padding: "7px 12px 7px 14px",
            cursor: "pointer",
          }}
        >
          <span style={{ fontFamily: theme.font.mono, fontSize: 12, color: theme.color.ink }}>{name}</span>
          <span
            style={{
              fontFamily: theme.font.mono,
              fontSize: 9,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: role === "Admin" ? theme.color.green : theme.color.slate,
              background: role === "Admin" ? theme.color.greenSoft : theme.color.surfaceMuted,
              borderRadius: theme.radius.pill,
              padding: "3px 8px",
            }}
          >
            {role}
          </span>
        </button>
        {menuOpen && (
          <button
            onMouseDown={signOut}
            style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              right: 0,
              display: "flex",
              alignItems: "center",
              gap: 8,
              ...glass(theme.radius.sm),
              boxShadow: theme.shadow.card,
              color: theme.color.inkSoft,
              fontFamily: theme.font.condensed,
              fontWeight: 700,
              fontSize: 14,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              padding: "10px 16px",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            <LogOut size={15} /> Sign out
          </button>
        )}
      </div>

      <div style={{ width: "100%", maxWidth: 680, textAlign: "center" }}>
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
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 16,
          }}
        >
          {CARDS.map(({ page, title, sub, Icon }, i) => (
            <button
              key={page}
              className="selector-tile"
              onClick={() => onSelect(page)}
              style={{
                position: "relative",
                ...glass(theme.radius.card),
                padding: "40px 20px 44px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 14,
                cursor: "pointer",
                overflow: "hidden",
                transition: "transform .2s ease, box-shadow .2s ease",
                animationDelay: `${i * 90}ms`,
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
              {/* Faint bottom rule that animates to a solid accent on hover. */}
              <span
                className="tile-rule"
                style={{
                  position: "absolute",
                  left: 0,
                  bottom: 0,
                  width: "100%",
                  height: 3,
                  background: theme.color.amber,
                  transform: "scaleX(0)",
                  transformOrigin: "left",
                  transition: "transform .3s cubic-bezier(.2,.7,.2,1)",
                }}
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
