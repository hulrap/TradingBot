'use client';

import React, { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "./utils";

// Button variant styles
const buttonVariants = {
  variant: {
    default: "bg-blue-600 text-white hover:bg-blue-700",
    destructive: "bg-red-600 text-white hover:bg-red-700",
    outline: "border border-gray-300 bg-transparent hover:bg-gray-50",
    secondary: "bg-gray-600 text-white hover:bg-gray-700",
    ghost: "bg-transparent hover:bg-gray-100",
    success: "bg-green-600 text-white hover:bg-green-700",
    warning: "bg-yellow-600 text-white hover:bg-yellow-700",
  },
  size: {
    default: "h-10 px-4 py-2 text-sm",
    sm: "h-8 px-3 py-1 text-sm",
    lg: "h-12 px-6 py-3 text-base",
    xl: "h-14 px-8 py-4 text-lg",
    icon: "h-10 w-10 p-0",
  },
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: keyof typeof buttonVariants.variant;
  size?: keyof typeof buttonVariants.size;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export function Button({ 
  children, 
  className = "",
  variant = "default", 
  size = "default", 
  loading = false,
  leftIcon,
  rightIcon,
  disabled,
  ...props 
}: ButtonProps): React.ReactElement {
  const baseClasses = "inline-flex items-center justify-center rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";
  const variantClasses = buttonVariants.variant[variant];
  const sizeClasses = buttonVariants.size[size];
  const loadingClasses = loading ? "pointer-events-none opacity-70" : "";

  return (
    <button
      className={cn(baseClasses, variantClasses, sizeClasses, loadingClasses, className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg
          className="mr-2 h-4 w-4 animate-spin"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {leftIcon && !loading && <span className="mr-2">{leftIcon}</span>}
      {children}
      {rightIcon && !loading && <span className="ml-2">{rightIcon}</span>}
    </button>
  );
}

// Trading-specific button variants
export function TradingButton({ 
  children, 
  action = "buy",
  ...props 
}: ButtonProps & { action?: "buy" | "sell" | "stop" }) {
  const actionVariant = action === "buy" ? "success" : action === "sell" ? "destructive" : "warning";
  
  return (
    <Button variant={actionVariant} {...props}>
      {children}
    </Button>
  );
}

// Emergency button for kill switches
export function EmergencyButton({ children, ...props }: ButtonProps) {
  return (
    <Button 
      variant="destructive" 
      size="lg" 
      className="animate-pulse border-2 border-red-500 font-bold"
      {...props}
    >
      🚨 {children}
    </Button>
  );
}

// Status indicator button
export function StatusButton({ 
  status = "idle", 
  children, 
  ...props 
}: ButtonProps & { status?: "idle" | "running" | "error" | "success" }) {
  const statusVariant = (() => {
    switch (status) {
      case "idle": return "secondary";
      case "running": return "default";
      case "error": return "destructive";
      case "success": return "success";
      default: return "default";
    }
  })();

  const statusIcon = (() => {
    switch (status) {
      case "idle": return "⏸️";
      case "running": return "▶️";
      case "error": return "❌";
      case "success": return "✅";
      default: return "";
    }
  })();

  return (
    <Button variant={statusVariant} leftIcon={statusIcon} {...props}>
      {children}
    </Button>
  );
} 