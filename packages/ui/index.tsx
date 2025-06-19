'use client';

import React, { ReactNode, forwardRef, ButtonHTMLAttributes } from "react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, className = "", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={`px-5 py-2.5 text-base cursor-pointer bg-blue-600 text-white border-0 rounded-md hover:bg-blue-700 transition-colors ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button"; 