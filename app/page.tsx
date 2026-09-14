'use client';

import dynamic from "next/dynamic";

const AshuraOrb = dynamic(() => import("@/components/AshuraOrb"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#03060d",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Orbitron', sans-serif",
        color: "#00f0ff",
        gap: 16,
        zIndex: 9999,
      }}
    >
      <div
        style={{
          width: 50,
          height: 50,
          borderRadius: "50%",
          border: "2px solid rgba(0, 240, 255, 0.2)",
          borderTopColor: "#00f0ff",
          animation: "spin 0.9s linear infinite",
          boxShadow: "0 0 20px rgba(0, 240, 255, 0.4)",
        }}
      />
      <div style={{ fontSize: 12, letterSpacing: "0.2em", fontWeight: 700 }}>
        INITIALIZING ASHURA OS WORKSPACE...
      </div>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  ),
});

export default function Home() {
  return <AshuraOrb />;
}
