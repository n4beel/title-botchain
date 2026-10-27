import { HTMLAttributes } from "react";

interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  elevated?: boolean;
  deedFrame?: boolean;
  noPadding?: boolean;
  headerTitle?: string;
  headerSub?: string;
}

export default function Panel({
  elevated,
  deedFrame,
  noPadding,
  headerTitle,
  headerSub,
  children,
  className = "",
  style,
  ...props
}: PanelProps) {
  return (
    <div
      className={[
        "rounded-[2px] transition-shadow",
        deedFrame ? "deed-sheet" : "",
        noPadding ? "" : "p-5 md:p-6",
        className,
      ].join(" ")}
      style={{
        background: elevated ? "var(--bg-elevated)" : "var(--bg-surface)",
        border: deedFrame ? "4px double var(--border-default)" : "1px solid var(--border-default)",
        boxShadow: "0 2px 6px rgba(38, 35, 27, 0.04)",
        ...style,
      }}
      {...props}
    >
      {(headerTitle || headerSub) && (
        <div
          className="border-b pb-3 mb-4 flex items-baseline justify-between gap-2"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          {headerTitle && (
            <h3 className="font-serif text-[17px] font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
              {headerTitle}
            </h3>
          )}
          {headerSub && (
            <span className="font-mono text-[11px]" style={{ color: "var(--text-muted)" }}>
              {headerSub}
            </span>
          )}
        </div>
      )}
      {children}
    </div>
  );
}
