"use client";

import { ButtonHTMLAttributes, CSSProperties, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variantStyles: Record<Variant, CSSProperties> = {
  primary: {
    background: "var(--accent)",
    color: "var(--accent-ink)",
    border: "1px solid #6E222A",
    boxShadow: "0 1px 2px rgba(140, 47, 57, 0.2)",
  },
  secondary: {
    background: "var(--bg-elevated)",
    color: "var(--text-primary)",
    border: "1px solid var(--border-default)",
  },
  ghost: {
    background: "transparent",
    color: "var(--text-secondary)",
    border: "1px solid var(--border-subtle)",
  },
  danger: {
    background: "var(--danger)",
    color: "#FFFFFF",
    border: "1px solid #78151F",
  },
};

const sizeStyles: Record<Size, string> = {
  sm: "px-2.5 py-1 text-[12px]",
  md: "px-4 py-2 text-[13px]",
  lg: "px-6 py-2.5 text-[14px]",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", loading, disabled, children, className = "", style, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={[
          "inline-flex items-center justify-center gap-2",
          "font-serif font-medium tracking-[0.01em] transition-all",
          "cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed",
          sizeStyles[size],
          className,
        ].join(" ")}
        style={{ borderRadius: "2px", ...variantStyles[variant], ...style }}
        {...props}
      >
        {loading ? (
          <>
            <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            {children}
          </>
        ) : (
          children
        )}
      </button>
    );
  },
);

Button.displayName = "Button";
export default Button;
