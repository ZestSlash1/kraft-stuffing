import { Component } from "react";
import { theme } from "../theme";

// Catches render-time crashes anywhere below it so a bad screen can't take down
// the whole app (and shows a way out instead of a blank/frozen page).
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary]", error, info);
  }

  reload = () => {
    this.setState({ error: null });
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: theme.color.canvas,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          fontFamily: theme.font.mono,
          color: theme.color.slate,
          padding: 24,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 11, letterSpacing: "0.2em", color: theme.color.red }}>
          SOMETHING WENT WRONG
        </div>
        <div style={{ fontSize: 11, maxWidth: 320, opacity: 0.7 }}>
          {this.state.error.message || "Unexpected error"}
        </div>
        <div
          onClick={this.reload}
          role="button"
          style={{
            marginTop: 8,
            padding: "10px 20px",
            border: `1px solid ${theme.color.borderStrong}`,
            borderRadius: theme.radius.input,
            color: theme.color.amberText,
            fontSize: 11,
            letterSpacing: "0.1em",
            cursor: "pointer",
            minHeight: 44,
            display: "flex",
            alignItems: "center",
          }}
        >
          RELOAD
        </div>
      </div>
    );
  }
}
