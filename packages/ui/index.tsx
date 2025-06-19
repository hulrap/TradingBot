'use client';

import React, { ButtonHTMLAttributes, ReactNode } from "react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
}

export function Button({ children, className = "", ...props }: ButtonProps): React.ReactElement {
  return (
    <button
      className={`px-5 py-2.5 text-base cursor-pointer bg-blue-600 text-white border-0 rounded-md hover:bg-blue-700 transition-colors ${className}`}
      {...props}
    >
      {children}
    </button>
  );
} 