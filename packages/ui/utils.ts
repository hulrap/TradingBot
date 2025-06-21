/**
 * @fileoverview Trading Bot UI Utilities
 * 
 * Comprehensive utility functions for UI components including class name management,
 * responsive utilities, animation helpers, accessibility functions, and theme integration.
 * Designed for enterprise-grade React applications with TypeScript support.
 * 
 * @version 2.0.0
 * @author Trading Bot Development Team
 * @license MIT
 */

/**
 * Type definitions for utility functions
 */
export type ClassNameValue = string | number | boolean | undefined | null | ClassNameObject | ClassNameArray;
export type ClassNameObject = Record<string, boolean | undefined | null>;
export type ClassNameArray = ClassNameValue[];
export type ResponsiveValue<T> = T | { sm?: T; md?: T; lg?: T; xl?: T; '2xl'?: T };
export type ThemeColor = 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
export type AnimationType = 'fade' | 'slide' | 'scale' | 'bounce' | 'pulse' | 'spin';
export type Direction = 'up' | 'down' | 'left' | 'right';

/**
 * Configuration for utility functions
 */
export const CONFIG = {
  breakpoints: {
    sm: '640px',
    md: '768px', 
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px'
  },
  animations: {
    duration: {
      fast: '150ms',
      normal: '300ms',
      slow: '500ms'
    },
    easing: {
      ease: 'ease',
      linear: 'linear',
      'ease-in': 'ease-in',
      'ease-out': 'ease-out',
      'ease-in-out': 'ease-in-out'
    }
  }
} as const;

/**
 * Internal utility to process class values
 */
function processClassValue(value: ClassNameValue): string[] {
  if (!value) return [];
  
  if (typeof value === 'string') {
    return value.split(' ').filter(Boolean);
  }
  
  if (typeof value === 'number') {
    return [String(value)];
  }
  
  if (Array.isArray(value)) {
    return value.flatMap(processClassValue);
  }
  
  if (typeof value === 'object') {
    return Object.entries(value)
      .filter(([, condition]) => condition)
      .map(([className]) => className)
      .flatMap(processClassValue);
  }
  
  return [];
}

/**
 * Enhanced class name utility with conditional class support
 * 
 * Combines multiple class values into a single string, automatically handling
 * conditional classes, falsy values, and complex class combinations.
 * 
 * @param classes - Variable number of class values to combine
 * @returns Combined class name string
 * 
 * @example
 * ```typescript
 * // Basic usage
 * cn('btn', 'btn-primary') // "btn btn-primary"
 * 
 * // Conditional classes
 * cn('btn', isActive && 'active', disabled && 'disabled') // "btn active"
 * 
 * // Object syntax
 * cn('btn', { 'btn-primary': isPrimary, 'btn-secondary': !isPrimary })
 * 
 * // Array syntax
 * cn(['btn', 'btn-primary'], isLoading && 'loading')
 * ```
 */
export function cn(...classes: ClassNameValue[]): string {
  const processed = classes.flatMap(processClassValue);
  return [...new Set(processed)].join(' ');
}

/**
 * Creates responsive class names based on breakpoint values
 * 
 * @param property - CSS property prefix (e.g., 'text', 'bg', 'p')
 * @param values - Responsive values for different breakpoints
 * @returns Combined responsive class names
 * 
 * @example
 * ```typescript
 * responsive('text', { sm: 'sm', md: 'base', lg: 'lg' })
 * // Returns: "text-sm md:text-base lg:text-lg"
 * 
 * responsive('p', { sm: '2', lg: '4' })
 * // Returns: "p-2 lg:p-4"
 * ```
 */
export function responsive<T extends string>(
  property: string,
  values: ResponsiveValue<T>
): string {
  if (typeof values === 'string') {
    return `${property}-${values}`;
  }

  const classes: string[] = [];
  
  if (values.sm !== undefined) classes.push(`${property}-${values.sm}`);
  if (values.md !== undefined) classes.push(`md:${property}-${values.md}`);
  if (values.lg !== undefined) classes.push(`lg:${property}-${values.lg}`);
  if (values.xl !== undefined) classes.push(`xl:${property}-${values.xl}`);
  if (values['2xl'] !== undefined) classes.push(`2xl:${property}-${values['2xl']}`);

  return classes.join(' ');
}

/**
 * Generates theme-based color classes with variants
 * 
 * @param color - Theme color name
 * @param variant - Color variant/intensity
 * @param property - CSS property (bg, text, border)
 * @returns Theme color class name
 * 
 * @example
 * ```typescript
 * themeColor('primary', '500', 'bg') // "bg-blue-500"
 * themeColor('success', '600', 'text') // "text-green-600"
 * themeColor('danger', '200', 'border') // "border-red-200"
 * ```
 */
export function themeColor(
  color: ThemeColor,
  variant: string = '500',
  property: 'bg' | 'text' | 'border' | 'ring' = 'bg'
): string {
  const colorMap: Record<ThemeColor, string> = {
    primary: 'blue',
    secondary: 'gray',
    success: 'green',
    warning: 'yellow',
    danger: 'red',
    info: 'blue',
    neutral: 'gray'
  };

  return `${property}-${colorMap[color]}-${variant}`;
}

/**
 * Creates animation classes with customizable duration and easing
 * 
 * @param type - Animation type
 * @param duration - Animation duration
 * @param direction - Animation direction (for slide animations)
 * @returns Animation class names
 * 
 * @example
 * ```typescript
 * animation('fade', 'normal') // "transition-opacity duration-300"
 * animation('slide', 'fast', 'right') // "transform transition-transform duration-150 translate-x-full"
 * animation('scale', 'slow') // "transform transition-transform duration-500 scale-95"
 * ```
 */
export function animation(
  type: AnimationType,
  duration: keyof typeof CONFIG.animations.duration = 'normal',
  direction?: Direction
): string {
  const durationClass = `duration-${CONFIG.animations.duration[duration].replace('ms', '')}`;
  
  const animationMap: Record<AnimationType, string> = {
    fade: `transition-opacity ${durationClass}`,
    slide: `transform transition-transform ${durationClass}`,
    scale: `transform transition-transform ${durationClass}`,
    bounce: `animate-bounce`,
    pulse: `animate-pulse`,
    spin: `animate-spin`
  };

  let classes = animationMap[type];

  // Add direction-specific classes for slide animations
  if (type === 'slide' && direction) {
    const directionMap: Record<Direction, string> = {
      up: '-translate-y-full',
      down: 'translate-y-full',
      left: '-translate-x-full',
      right: 'translate-x-full'
    };
    classes += ` ${directionMap[direction]}`;
  }

  // Add initial scale for scale animations
  if (type === 'scale') {
    classes += ' scale-95';
  }

  return classes;
}

/**
 * Accessibility utility for screen reader classes
 * 
 * @param visible - Whether content should be visible to screen readers only
 * @returns Screen reader accessibility classes
 * 
 * @example
 * ```typescript
 * screenReader(true) // "sr-only"
 * screenReader(false) // "not-sr-only"
 * ```
 */
export function screenReader(visible: boolean = true): string {
  return visible ? 'sr-only' : 'not-sr-only';
}

/**
 * Focus management utility for keyboard navigation
 * 
 * @param variant - Focus style variant
 * @returns Focus management class names
 * 
 * @example
 * ```typescript
 * focusRing('default') // "focus:outline-none focus:ring-2 focus:ring-blue-500"
 * focusRing('danger') // "focus:outline-none focus:ring-2 focus:ring-red-500"
 * focusRing('subtle') // "focus:outline-none focus:ring-1 focus:ring-gray-300"
 * ```
 */
export function focusRing(variant: 'default' | 'danger' | 'success' | 'subtle' = 'default'): string {
  const baseClasses = 'focus:outline-none focus:ring-2 focus:ring-offset-2';
  
  const variantMap: Record<typeof variant, string> = {
    default: `${baseClasses} focus:ring-blue-500`,
    danger: `${baseClasses} focus:ring-red-500`,
    success: `${baseClasses} focus:ring-green-500`,
    subtle: 'focus:outline-none focus:ring-1 focus:ring-gray-300'
  };

  return variantMap[variant];
}

/**
 * Truncation utility for text overflow handling
 * 
 * @param lines - Number of lines to show before truncating
 * @returns Text truncation class names
 * 
 * @example
 * ```typescript
 * truncate() // "truncate"
 * truncate(2) // "line-clamp-2"
 * truncate(3) // "line-clamp-3"
 * ```
 */
export function truncate(lines?: number): string {
  if (!lines || lines === 1) {
    return 'truncate';
  }
  return `line-clamp-${lines}`;
}

/**
 * Spacing utility with consistent scale
 * 
 * @param property - CSS property (p, m, px, py, etc.)
 * @param size - Spacing size (0-96 or auto)
 * @returns Spacing class name
 * 
 * @example
 * ```typescript
 * spacing('p', 4) // "p-4"
 * spacing('mx', 'auto') // "mx-auto"
 * spacing('py', 8) // "py-8"
 * ```
 */
export function spacing(
  property: 'p' | 'm' | 'px' | 'py' | 'pl' | 'pr' | 'pt' | 'pb' | 'mx' | 'my' | 'ml' | 'mr' | 'mt' | 'mb',
  size: number | 'auto'
): string {
  return `${property}-${size}`;
}

/**
 * Grid utility for responsive layouts
 * 
 * @param cols - Number of columns for different breakpoints
 * @param gap - Gap size between grid items
 * @returns Grid layout class names
 * 
 * @example
 * ```typescript
 * grid({ sm: 1, md: 2, lg: 3 }, 4)
 * // Returns: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
 * ```
 */
export function grid(
  cols: ResponsiveValue<number>,
  gap: number = 4
): string {
  const classes = ['grid', `gap-${gap}`];
  
  if (typeof cols === 'number') {
    classes.push(`grid-cols-${cols}`);
  } else {
    if (typeof cols.sm === 'number') classes.push(`grid-cols-${cols.sm}`);
    if (typeof cols.md === 'number') classes.push(`md:grid-cols-${cols.md}`);
    if (typeof cols.lg === 'number') classes.push(`lg:grid-cols-${cols.lg}`);
    if (typeof cols.xl === 'number') classes.push(`xl:grid-cols-${cols.xl}`);
    if (typeof cols['2xl'] === 'number') classes.push(`2xl:grid-cols-${cols['2xl']}`);
  }

  return classes.join(' ');
}

/**
 * Flexbox utility for flexible layouts
 * 
 * @param direction - Flex direction
 * @param align - Align items
 * @param justify - Justify content
 * @param wrap - Flex wrap
 * @returns Flexbox class names
 * 
 * @example
 * ```typescript
 * flex('row', 'center', 'between')
 * // Returns: "flex flex-row items-center justify-between"
 * 
 * flex('col', 'start', 'start', true)
 * // Returns: "flex flex-col items-start justify-start flex-wrap"
 * ```
 */
export function flex(
  direction: 'row' | 'col' | 'row-reverse' | 'col-reverse' = 'row',
  align: 'start' | 'center' | 'end' | 'stretch' | 'baseline' = 'center',
  justify: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly' = 'start',
  wrap: boolean = false
): string {
  const classes = [
    'flex',
    `flex-${direction}`,
    `items-${align}`,
    `justify-${justify}`
  ];

  if (wrap) {
    classes.push('flex-wrap');
  }

  return classes.join(' ');
}

/**
 * Input validation utility for form styling
 * 
 * @param isValid - Whether the input is valid
 * @param hasError - Whether the input has an error
 * @param isFocused - Whether the input is focused
 * @returns Input validation class names
 * 
 * @example
 * ```typescript
 * inputValidation(true, false, false)
 * // Returns: "border-green-500 focus:border-green-600"
 * 
 * inputValidation(false, true, true)
 * // Returns: "border-red-500 focus:border-red-600 ring-red-200"
 * ```
 */
export function inputValidation(
  isValid?: boolean,
  hasError?: boolean,
  isFocused?: boolean
): string {
  const classes: string[] = [];

  if (hasError) {
    classes.push('border-red-500', 'focus:border-red-600');
    if (isFocused) {
      classes.push('ring-red-200');
    }
  } else if (isValid) {
    classes.push('border-green-500', 'focus:border-green-600');
    if (isFocused) {
      classes.push('ring-green-200');
    }
  } else {
    classes.push('border-gray-300', 'focus:border-blue-500');
    if (isFocused) {
      classes.push('ring-blue-200');
    }
  }

  return classes.join(' ');
}

/**
 * Utility to safely merge class names with deduplication
 * 
 * @param baseClasses - Base class names
 * @param overrideClasses - Override class names that take precedence
 * @returns Merged class names with overrides applied
 * 
 * @example
 * ```typescript
 * mergeClasses('p-4 bg-blue-500', 'p-6 text-white')
 * // Returns: "bg-blue-500 p-6 text-white"
 * ```
 */
export function mergeClasses(
  baseClasses: string,
  overrideClasses?: string
): string {
  if (!overrideClasses) return baseClasses;

  const base = baseClasses.split(' ');
  const override = overrideClasses.split(' ');
  
  // Remove base classes that are overridden
  const filtered = base.filter(cls => {
    const property = cls.split('-')[0] || '';
    return !override.some(oCls => oCls.startsWith(property));
  });

  return [...filtered, ...override].join(' ');
}

/**
 * Utility for creating consistent shadows
 * 
 * @param size - Shadow size
 * @param color - Shadow color theme
 * @returns Shadow class names
 * 
 * @example
 * ```typescript
 * shadow('md') // "shadow-md"
 * shadow('lg', 'primary') // "shadow-lg shadow-blue-500/25"
 * ```
 */
export function shadow(
  size: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'none' = 'md',
  color?: ThemeColor
): string {
  const classes = [`shadow-${size}`];
  
  if (color && size !== 'none') {
    const colorMap: Record<ThemeColor, string> = {
      primary: 'shadow-blue-500/25',
      secondary: 'shadow-gray-500/25',
      success: 'shadow-green-500/25',
      warning: 'shadow-yellow-500/25',
      danger: 'shadow-red-500/25',
      info: 'shadow-blue-500/25',
      neutral: 'shadow-gray-500/25'
    };
    classes.push(colorMap[color]);
  }

  return classes.join(' ');
}

/**
 * Export all utility functions and types
 */
export {
  CONFIG as uiConfig,
  processClassValue
};

/**
 * Default export for the main cn function
 */
export default cn; 