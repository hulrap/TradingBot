'use client';

/**
 * @fileoverview Trading Bot UI Component Library
 * 
 * Comprehensive React component library providing enterprise-grade UI components
 * specifically designed for financial trading applications. This library includes
 * accessible, themeable, and type-safe components with advanced patterns for
 * professional trading interfaces.
 * 
 * @version 2.0.0
 * @author Trading Bot Development Team
 * @license MIT
 */

import React, { 
  ButtonHTMLAttributes, 
  ReactNode, 
  forwardRef,
  useCallback,
  useMemo,
  Component,
  ErrorInfo,
  ReactElement
} from "react";
import { cn } from "./utils";

/**
 * Theme configuration for consistent styling across components
 */
const theme = {
  colors: {
    primary: {
      50: 'bg-blue-50 text-blue-900',
      500: 'bg-blue-500 text-white',
      600: 'bg-blue-600 text-white',
      700: 'bg-blue-700 text-white',
      900: 'bg-blue-900 text-white'
    },
    success: {
      50: 'bg-green-50 text-green-900',
      500: 'bg-green-500 text-white',
      600: 'bg-green-600 text-white',
      700: 'bg-green-700 text-white'
    },
    danger: {
      50: 'bg-red-50 text-red-900',
      500: 'bg-red-500 text-white',
      600: 'bg-red-600 text-white',
      700: 'bg-red-700 text-white'
    },
    warning: {
      50: 'bg-yellow-50 text-yellow-900',
      500: 'bg-yellow-500 text-white',
      600: 'bg-yellow-600 text-white',
      700: 'bg-yellow-700 text-white'
    },
    neutral: {
      50: 'bg-gray-50 text-gray-900',
      100: 'bg-gray-100 text-gray-900',
      200: 'bg-gray-200 text-gray-900',
      600: 'bg-gray-600 text-white',
      700: 'bg-gray-700 text-white'
    }
  },
  spacing: {
    xs: 'px-2 py-1',
    sm: 'px-3 py-1.5',
    md: 'px-4 py-2',
    lg: 'px-6 py-3',
    xl: 'px-8 py-4'
  },
  borderRadius: {
    none: 'rounded-none',
    sm: 'rounded-sm',
    md: 'rounded-md',
    lg: 'rounded-lg',
    full: 'rounded-full'
  }
} as const;

/**
 * Button variant styles with comprehensive theming support
 */
const buttonVariants = {
  variant: {
    default: "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500",
    destructive: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500",
    outline: "border border-gray-300 bg-transparent hover:bg-gray-50 focus:ring-gray-500",
    secondary: "bg-gray-600 text-white hover:bg-gray-700 focus:ring-gray-500",
    ghost: "bg-transparent hover:bg-gray-100 focus:ring-gray-500",
    success: "bg-green-600 text-white hover:bg-green-700 focus:ring-green-500",
    warning: "bg-yellow-600 text-white hover:bg-yellow-700 focus:ring-yellow-500",
    info: "bg-blue-500 text-white hover:bg-blue-600 focus:ring-blue-500",
    link: "bg-transparent text-blue-600 hover:text-blue-700 hover:underline focus:ring-blue-500",
  },
  size: {
    xs: "h-6 px-2 py-1 text-xs",
    sm: "h-8 px-3 py-1 text-sm",
    default: "h-10 px-4 py-2 text-sm",
    lg: "h-12 px-6 py-3 text-base",
    xl: "h-14 px-8 py-4 text-lg",
    icon: "h-10 w-10 p-0",
  },
  shape: {
    square: "rounded-md",
    rounded: "rounded-lg",
    pill: "rounded-full",
    none: "rounded-none"
  }
} as const;

/**
 * Loading spinner component with accessibility features
 */
const LoadingSpinner = React.memo(({ 
  size = 'default',
  className = ''
}: {
  size?: 'xs' | 'sm' | 'default' | 'lg';
  className?: string;
}) => {
  const sizeClasses = {
    xs: 'h-3 w-3',
    sm: 'h-4 w-4',
    default: 'h-4 w-4',
    lg: 'h-6 w-6'
  };

  return (
    <svg
      className={cn("animate-spin", sizeClasses[size], className)}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      role="img"
      aria-label="Loading..."
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
  );
});

LoadingSpinner.displayName = 'LoadingSpinner';

/**
 * Error boundary component for handling component errors gracefully
 */
class ButtonErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: ReactNode; fallback?: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): { hasError: boolean; error: Error } {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error for development and monitoring
    const errorReport = {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      errorInfo: {
        componentStack: errorInfo.componentStack
      },
      timestamp: new Date().toISOString(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
      url: typeof window !== 'undefined' ? window.location.href : 'Unknown'
    };

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.group('🚨 Component Error Boundary');
      console.error('Error:', error);
      console.error('Error Info:', errorInfo);
      console.error('Full Report:', errorReport);
      console.groupEnd();
    }

    // Send to error reporting service in production
    if (process.env.NODE_ENV === 'production') {
      this.reportError(errorReport);
    }
  }

  /**
   * Report error to monitoring service
   */
  private reportError(errorReport: any): void {
    // Integration with error monitoring services
    try {
      // Example: Sentry, LogRocket, or custom error service
      if (typeof window !== 'undefined' && (window as any).errorReporting) {
        (window as any).errorReporting.captureException(errorReport);
      }
      
      // Fallback: Send to custom endpoint
      fetch('/api/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(errorReport)
      }).catch(() => {
        // Silent fail for error reporting
      });
    } catch {
      // Silent fail for error reporting to prevent recursion
    }
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback || (
        <button 
          className="bg-red-100 text-red-800 px-3 py-1 rounded border border-red-300"
          disabled
        >
          Error
        </button>
      );
    }

    return this.props.children;
  }
}

/**
 * Enhanced button props with comprehensive type safety and accessibility
 */
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Button content */
  children: ReactNode;
  /** Visual variant of the button */
  variant?: keyof typeof buttonVariants.variant;
  /** Size variant of the button */
  size?: keyof typeof buttonVariants.size;
  /** Shape variant of the button */
  shape?: keyof typeof buttonVariants.shape;
  /** Loading state - disables interaction and shows spinner */
  loading?: boolean;
  /** Icon to display on the left side */
  leftIcon?: ReactNode;
  /** Icon to display on the right side */
  rightIcon?: ReactNode;
  /** Full width button */
  fullWidth?: boolean;
  /** Test ID for testing purposes */
  testId?: string;
  /** Custom loading text for screen readers */
  loadingText?: string;
  /** Tooltip text */
  tooltip?: string;
  /** Auto-focus on mount */
  autoFocus?: boolean;
  /** Ref forwarding support */
  ref?: React.Ref<HTMLButtonElement>;
}

/**
 * Professional Button Component
 * 
 * A comprehensive, accessible button component designed for trading applications.
 * Supports multiple variants, sizes, loading states, icons, and full accessibility.
 * 
 * @example
 * ```tsx
 * <Button variant="success" size="lg" loading={isLoading}>
 *   Execute Trade
 * </Button>
 * ```
 * 
 * @example
 * ```tsx
 * <Button 
 *   variant="outline" 
 *   leftIcon={<ChartIcon />}
 *   tooltip="View market data"
 * >
 *   Market Data
 * </Button>
 * ```
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ 
  children, 
  className = "",
  variant = "default", 
  size = "default", 
  shape = "square",
  loading = false,
  leftIcon,
  rightIcon,
  disabled,
  fullWidth = false,
  testId,
  loadingText = "Loading...",
  tooltip,
  autoFocus = false,
  onClick,
  ...props 
}, ref): ReactElement => {
  // Memoize class calculations for performance
  const buttonClasses = useMemo(() => {
    const baseClasses = "inline-flex items-center justify-center font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-95";
    const variantClasses = buttonVariants.variant[variant];
    const sizeClasses = buttonVariants.size[size];
    const shapeClasses = buttonVariants.shape[shape];
    const loadingClasses = loading ? "pointer-events-none opacity-70" : "";
    const widthClasses = fullWidth ? "w-full" : "";
    
    return cn(
      baseClasses, 
      variantClasses, 
      sizeClasses, 
      shapeClasses,
      loadingClasses, 
      widthClasses,
      className
    );
  }, [variant, size, shape, loading, fullWidth, className]);

  // Handle click with loading state
  const handleClick = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    if (loading || disabled) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  }, [loading, disabled, onClick]);

  // Determine ARIA attributes
  const ariaAttributes = useMemo(() => ({
    'aria-disabled': disabled || loading,
    'aria-busy': loading,
    'aria-label': loading ? loadingText : undefined,
    'title': tooltip,
    'data-testid': testId
  }), [disabled, loading, loadingText, tooltip, testId]);

  return (
    <ButtonErrorBoundary>
      <button
        ref={ref}
        className={buttonClasses}
        disabled={disabled || loading}
        autoFocus={autoFocus}
        onClick={handleClick}
        {...ariaAttributes}
        {...props}
      >
        {loading && (
          <LoadingSpinner 
            size={size === 'xs' ? 'xs' : size === 'sm' ? 'sm' : size === 'lg' || size === 'xl' ? 'lg' : 'default'} 
            className="mr-2" 
          />
        )}
        {leftIcon && !loading && (
          <span className="mr-2 flex items-center" aria-hidden="true">
            {leftIcon}
          </span>
        )}
        <span className="flex items-center">
          {children}
        </span>
        {rightIcon && !loading && (
          <span className="ml-2 flex items-center" aria-hidden="true">
            {rightIcon}
          </span>
        )}
      </button>
    </ButtonErrorBoundary>
  );
});

Button.displayName = 'Button';

/**
 * Trading-specific button for buy/sell/stop actions
 * 
 * @example
 * ```tsx
 * <TradingButton action="buy" size="lg" loading={isExecuting}>
 *   Buy BTC
 * </TradingButton>
 * ```
 */
export interface TradingButtonProps extends Omit<ButtonProps, 'variant'> {
  /** Trading action type */
  action?: "buy" | "sell" | "stop" | "limit";
}

export const TradingButton = forwardRef<HTMLButtonElement, TradingButtonProps>(({ 
  children, 
  action = "buy",
  ...props 
}, ref): ReactElement => {
  const actionVariant = useMemo(() => {
    switch (action) {
      case "buy": return "success";
      case "sell": return "destructive";
      case "stop": return "warning";
      case "limit": return "info";
      default: return "default";
    }
  }, [action]);

  const actionIcon = useMemo(() => {
    switch (action) {
      case "buy": return "📈";
      case "sell": return "📉";
      case "stop": return "🛑";
      case "limit": return "📊";
      default: return "";
    }
  }, [action]);
  
  return (
    <Button 
      ref={ref}
      variant={actionVariant} 
      leftIcon={actionIcon}
      testId={`trading-button-${action}`}
      {...props}
    >
      {children}
    </Button>
  );
});

TradingButton.displayName = 'TradingButton';

/**
 * Emergency button for critical actions like kill switches
 * 
 * @example
 * ```tsx
 * <EmergencyButton onClick={handleEmergencyStop}>
 *   Emergency Stop
 * </EmergencyButton>
 * ```
 */
export const EmergencyButton = forwardRef<HTMLButtonElement, ButtonProps>(({ 
  children, 
  className = "",
  ...props 
}, ref): ReactElement => {
  return (
    <Button 
      ref={ref}
      variant="destructive" 
      size="lg" 
      className={cn(
        "animate-pulse border-2 border-red-500 font-bold shadow-lg",
        "hover:animate-none hover:shadow-xl",
        "focus:animate-none focus:ring-4 focus:ring-red-300",
        className
      )}
      testId="emergency-button"
      tooltip="Emergency action - use with caution"
      leftIcon="🚨"
      {...props}
    >
      {children}
    </Button>
  );
});

EmergencyButton.displayName = 'EmergencyButton';

/**
 * Status indicator button with visual status representation
 * 
 * @example
 * ```tsx
 * <StatusButton status="running" onClick={handleStatusChange}>
 *   Bot Status
 * </StatusButton>
 * ```
 */
export interface StatusButtonProps extends Omit<ButtonProps, 'variant' | 'leftIcon'> {
  /** Current status */
  status?: "idle" | "running" | "error" | "success" | "warning" | "paused";
}

export const StatusButton = forwardRef<HTMLButtonElement, StatusButtonProps>(({ 
  status = "idle", 
  children, 
  ...props 
}, ref): ReactElement => {
  const statusConfig = useMemo(() => {
    switch (status) {
      case "idle": 
        return { variant: "secondary" as const, icon: "⏸️", label: "Idle" };
      case "running": 
        return { variant: "success" as const, icon: "▶️", label: "Running" };
      case "error": 
        return { variant: "destructive" as const, icon: "❌", label: "Error" };
      case "success": 
        return { variant: "success" as const, icon: "✅", label: "Success" };
      case "warning": 
        return { variant: "warning" as const, icon: "⚠️", label: "Warning" };
      case "paused": 
        return { variant: "secondary" as const, icon: "⏸️", label: "Paused" };
      default: 
        return { variant: "default" as const, icon: "❓", label: "Unknown" };
    }
  }, [status]);

  return (
    <Button 
      ref={ref}
      variant={statusConfig.variant} 
      leftIcon={statusConfig.icon}
      testId={`status-button-${status}`}
      tooltip={`Status: ${statusConfig.label}`}
      {...props}
    >
      {children}
    </Button>
  );
});

StatusButton.displayName = 'StatusButton';

/**
 * Button Group component for related actions
 * 
 * @example
 * ```tsx
 * <ButtonGroup>
 *   <Button variant="outline">Cancel</Button>
 *   <Button variant="default">Save</Button>
 * </ButtonGroup>
 * ```
 */
export interface ButtonGroupProps {
  children: ReactNode;
  className?: string;
  orientation?: 'horizontal' | 'vertical';
  spacing?: 'none' | 'sm' | 'md' | 'lg';
}

export const ButtonGroup: React.FC<ButtonGroupProps> = ({
  children,
  className = "",
  orientation = 'horizontal',
  spacing = 'sm'
}): ReactElement => {
  const groupClasses = useMemo(() => {
    const baseClasses = "flex";
    const orientationClasses = orientation === 'horizontal' ? "flex-row" : "flex-col";
    const spacingClasses = {
      none: "",
      sm: orientation === 'horizontal' ? "space-x-2" : "space-y-2",
      md: orientation === 'horizontal' ? "space-x-4" : "space-y-4",
      lg: orientation === 'horizontal' ? "space-x-6" : "space-y-6"
    };
    
    return cn(baseClasses, orientationClasses, spacingClasses[spacing], className);
  }, [orientation, spacing, className]);

  return (
    <div className={groupClasses} role="group">
      {children}
    </div>
  );
};

ButtonGroup.displayName = 'ButtonGroup';

/**
 * Export utilities and theme
 */
export {
  LoadingSpinner,
  ButtonErrorBoundary,
  theme,
  buttonVariants
};

/**
 * Default export for convenience
 */
export default Button; 