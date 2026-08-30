"use client";

import React from "react";

export function SketchUnderline({
  className = "",
  stroke = "var(--coral)",
}: {
  className?: string;
  stroke?: string;
}) {
  return (
    <svg
      className={`w-full ${className}`}
      viewBox="0 0 240 12"
      fill="none"
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      <path
        d="M3 8 C 50 3, 100 11, 150 5 C 185 2, 215 9, 237 4"
        stroke={stroke}
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function HandDrawnArrow({
  className = "",
  stroke = "var(--coral)",
}: {
  className?: string;
  stroke?: string;
}) {
  return (
    <svg
      className={className}
      width="48"
      height="24"
      viewBox="0 0 48 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4 12 C 16 10, 28 14, 40 11 M 34 5 L 42 12 L 35 19"
        stroke={stroke}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CurvedArrow({
  className = "",
  stroke = "var(--turquoise)",
}: {
  className?: string;
  stroke?: string;
}) {
  return (
    <svg
      className={className}
      width="64"
      height="48"
      viewBox="0 0 64 48"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M6 8 C 24 2, 54 10, 48 36 C 45 42, 38 46, 30 42 C 24 38, 28 28, 38 28 M 46 22 L 56 34 L 40 38"
        stroke={stroke}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CircleHighlight({
  className = "",
  stroke = "var(--coral)",
}: {
  className?: string;
  stroke?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 120 50"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M 10 25 C 8 8, 55 3, 105 10 C 117 22, 108 42, 60 46 C 15 48, 5 35, 14 20 C 20 12, 50 6, 85 8"
        stroke={stroke}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function PaperTape({
  className = "",
}: {
  className?: string;
}) {
  return (
    <div
      className={`h-6 w-20 bg-amber-100/80 border border-amber-300/60 shadow-sm opacity-90 backdrop-blur-xs ${className}`}
      aria-hidden="true"
    />
  );
}

export function HanddrawnBox({
  children,
  className = "",
  borderColor = "var(--ink)",
}: {
  children: React.ReactNode;
  className?: string;
  borderColor?: string;
}) {
  return (
    <div className={`relative p-4 ${className}`}>
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        preserveAspectRatio="none"
        viewBox="0 0 100 100"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M 2 3 Q 50 1, 98 4 Q 99 50, 97 97 Q 50 99, 3 96 Q 1 50, 2 3 Z"
          stroke={borderColor}
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
          strokeDasharray="1000"
        />
      </svg>
      <div className="relative z-10">{children}</div>
    </div>
  );
}

export function PenIcon({ className = "w-5 h-5", stroke = "currentColor" }: { className?: string; stroke?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 19l7-7 3 3-7 7-3-3zM18 13l-1.5-1.5M2 22l4-1 12-12-3-3L3 18l-1 4z"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function NotebookIcon({ className = "w-5 h-5", stroke = "currentColor" }: { className?: string; stroke?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15zM8 6h8M8 10h8"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PdfIcon({ className = "w-5 h-5", stroke = "currentColor" }: { className?: string; stroke?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M10 12h4 M10 16h4"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}