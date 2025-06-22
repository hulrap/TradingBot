/**
 * @file Time formatting utilities
 * @package @trading-bot/utilities
 * 
 * Production-grade time formatting with timezone support, relative time,
 * duration formatting, and various display formats for trading applications.
. */

import type { 
  TimeFormatOptions,
  DurationFormatOptions,
  TimeFormatContext,
  TradingMarket,
  MarketSessionInfo
} from '../../../types/src/utilities/formatting';

/**
 * Format timestamp with comprehensive options
 * @param timestamp
 * @param options
. */
export function formatTime(
  timestamp: number | Date | string,
  options: TimeFormatOptions = {}
): string {
  const {
    style = 'medium',
    timeZone = 'UTC',
    includeMs = false,
    pattern,
    locale = 'en-US'
  } = options;

  try {
    // Convert to Date object
    const date = new Date(timestamp);
    
    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }

    // Handle custom patterns
    if (pattern) {
      return formatWithPattern(date, pattern, timeZone, includeMs);
    }

    // Handle different styles
    switch (style) {
      case 'short':
        return formatShortTime(date, timeZone, locale);
      
      case 'medium':
        return formatMediumTime(date, timeZone, locale);
      
      case 'long':
        return formatLongTime(date, timeZone, locale);
      
      case 'full':
        return formatFullTime(date, timeZone, locale, includeMs);
      
      case 'relative':
        return formatRelativeTime(date, locale);
      
      case 'duration':
        return formatDuration(Date.now() - date.getTime());
      
      default:
        return formatMediumTime(date, timeZone, locale);
    }

  } catch (error) {
    console.warn('Time formatting failed:', error);
    return String(timestamp);
  }
}

/**
 * Format short time (HH:MM)
 * @param date
 * @param timeZone
 * @param locale
. */
function formatShortTime(date: Date, timeZone: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone
  }).format(date);
}

/**
 * Format medium time (MMM DD, HH:MM)
 * @param date
 * @param timeZone
 * @param locale
. */
function formatMediumTime(date: Date, timeZone: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone
  }).format(date);
}

/**
 * Format long time (MMM DD, YYYY HH:MM:SS)
 * @param date
 * @param timeZone
 * @param locale
. */
function formatLongTime(date: Date, timeZone: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone
  }).format(date);
}

/**
 * Format full time with timezone
 * @param date
 * @param timeZone
 * @param locale
 * @param includeMs
. */
function formatFullTime(date: Date, timeZone: string, locale: string, includeMs: boolean): string {
  const baseFormat = new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
    timeZone
  }).format(date);

  if (includeMs) {
    const ms = date.getMilliseconds().toString().padStart(3, '0');
    return baseFormat.replace(/(\d{2}:\d{2}:\d{2})/, `$1.${ms}`);
  }

  return baseFormat;
}

/**
 * Format relative time (e.g., "2 minutes ago")
 * @param date
 * @param locale
. */
function formatRelativeTime(date: Date, locale: string): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  // Use Intl.RelativeTimeFormat if available
  if (Intl?.RelativeTimeFormat) {
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    
    if (Math.abs(diffYears) >= 1) {
      return rtf.format(-diffYears, 'year');
    } else if (Math.abs(diffMonths) >= 1) {
      return rtf.format(-diffMonths, 'month');
    } else if (Math.abs(diffWeeks) >= 1) {
      return rtf.format(-diffWeeks, 'week');
    } else if (Math.abs(diffDays) >= 1) {
      return rtf.format(-diffDays, 'day');
    } else if (Math.abs(diffHours) >= 1) {
      return rtf.format(-diffHours, 'hour');
    } else if (Math.abs(diffMinutes) >= 1) {
      return rtf.format(-diffMinutes, 'minute');
    } 
      return rtf.format(-diffSeconds, 'second');
    
    
  }

  // Fallback implementation
  const isPast = diffMs > 0;
  const suffix = isPast ? 'ago' : 'from now';
  const absDiff = Math.abs(diffMs);

  if (absDiff < 60000) { // Less than 1 minute
    const seconds = Math.floor(absDiff / 1000);
    return `${seconds} second${seconds !== 1 ? 's' : ''} ${suffix}`;
  } else if (absDiff < 3600000) { // Less than 1 hour
    return `${Math.abs(diffMinutes)} minute${Math.abs(diffMinutes) !== 1 ? 's' : ''} ${suffix}`;
  } else if (absDiff < 86400000) { // Less than 1 day
    return `${Math.abs(diffHours)} hour${Math.abs(diffHours) !== 1 ? 's' : ''} ${suffix}`;
  } else if (absDiff < 604800000) { // Less than 1 week
    return `${Math.abs(diffDays)} day${Math.abs(diffDays) !== 1 ? 's' : ''} ${suffix}`;
  } else if (absDiff < 2628000000) { // Less than 1 month
    return `${Math.abs(diffWeeks)} week${Math.abs(diffWeeks) !== 1 ? 's' : ''} ${suffix}`;
  } else if (absDiff < 31536000000) { // Less than 1 year
    return `${Math.abs(diffMonths)} month${Math.abs(diffMonths) !== 1 ? 's' : ''} ${suffix}`;
  } 
    return `${Math.abs(diffYears)} year${Math.abs(diffYears) !== 1 ? 's' : ''} ${suffix}`;
  
}

/**
 * Format duration in milliseconds
 * @param durationMs
 * @param options
. */
export function formatDuration(durationMs: number, options: DurationFormatOptions = {}): string {
  const {
    style = 'short',
    precision = 'ms',
    maxUnits = 3
  } = options;

  if (durationMs < 0) {
    return `-${  formatDuration(-durationMs, options)}`;
  }

  const units = [
    { name: 'day', short: 'd', value: 86400000 },
    { name: 'hour', short: 'h', value: 3600000 },
    { name: 'minute', short: 'm', value: 60000 },
    { name: 'second', short: 's', value: 1000 },
    { name: 'millisecond', short: 'ms', value: 1 }
  ];

  // Filter units based on precision
  const precisionIndex = units.findIndex(u => u.short === precision);
  const filteredUnits = units.slice(0, precisionIndex + 1);

  const parts: string[] = [];
  let remaining = durationMs;

  for (const unit of filteredUnits) {
    if (remaining >= unit.value && parts.length < maxUnits) {
      const count = Math.floor(remaining / unit.value);
      remaining = remaining % unit.value;

      if (style === 'compact') {
        parts.push(`${count}${unit.short}`);
      } else if (style === 'short') {
        parts.push(`${count}${unit.short}`);
      } else { // long
        const unitName = count === 1 ? unit.name : `${unit.name  }s`;
        parts.push(`${count} ${unitName}`);
      }
    }
  }

  if (parts.length === 0) {
    return style === 'compact' ? '0ms' : '0 milliseconds';
  }

  if (style === 'compact') {
    return parts.join(' ');
  } 
    return parts.join(', ');
  
}

/**
 * Format with custom pattern
 * @param date
 * @param pattern
 * @param timeZone
 * @param includeMs
. */
function formatWithPattern(date: Date, pattern: string, timeZone: string, includeMs: boolean): string {
  // Pattern tokens
  const tokens: Record<string, () => string> = {
    'YYYY': () => date.getFullYear().toString(),
    'YY': () => date.getFullYear().toString().slice(-2),
    'MM': () => (date.getMonth() + 1).toString().padStart(2, '0'),
    'MMM': () => date.toLocaleDateString('en-US', { month: 'short', timeZone }),
    'MMMM': () => date.toLocaleDateString('en-US', { month: 'long', timeZone }),
    'DD': () => date.getDate().toString().padStart(2, '0'),
    'HH': () => date.getHours().toString().padStart(2, '0'),
    'mm': () => date.getMinutes().toString().padStart(2, '0'),
    'ss': () => date.getSeconds().toString().padStart(2, '0'),
    'A': () => date.getHours() >= 12 ? 'PM' : 'AM',
    'a': () => date.getHours() >= 12 ? 'pm' : 'am',
    'hh': () => {
      const hour12 = date.getHours() % 12;
      return (hour12 === 0 ? 12 : hour12).toString().padStart(2, '0');
    }
  };

  // Add milliseconds token only if includeMs is true
  if (includeMs) {
    tokens['SSS'] = () => date.getMilliseconds().toString().padStart(3, '0');
  }

  let formatted = pattern;
  
  // Replace tokens in order of length (longest first)
  const sortedTokens = Object.keys(tokens).sort((a, b) => b.length - a.length);
  
  for (const token of sortedTokens) {
    const tokenFunc = tokens[token];
    if (tokenFunc) {
      formatted = formatted.replace(new RegExp(token, 'g'), tokenFunc());
    }
  }

  return formatted;
}

/**
 * Format time for different contexts
 * @param timestamp
 * @param context
 * @param options
. */
export function formatTimeForContext(
  timestamp: number | Date | string,
  context: TimeFormatContext,
  options: Partial<TimeFormatOptions> = {}
): string {
  const contextOptions: Record<string, TimeFormatOptions> = {
    chart: { style: 'short', timeZone: 'UTC' },
    log: { style: 'full', includeMs: true, timeZone: 'UTC' },
    trade: { style: 'medium', timeZone: 'UTC' },
    notification: { style: 'relative' },
    tooltip: { style: 'long', timeZone: 'UTC' }
  };

  const mergedOptions = { ...contextOptions[context], ...options };
  return formatTime(timestamp, mergedOptions);
}

/**
 * Format time range
 * @param startTime
 * @param endTime
 * @param options
. */
export function formatTimeRange(
  startTime: number | Date | string,
  endTime: number | Date | string,
  options: TimeFormatOptions = {}
): string {
  const start = new Date(startTime);
  const end = new Date(endTime);
  
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return 'Invalid Date Range';
  }

  const sameDay = start.toDateString() === end.toDateString();
  
  if (sameDay) {
    const startFormatted = formatTime(start, { ...options, style: 'short' });
    const endFormatted = formatTime(end, { ...options, style: 'short' });
    const dateFormatted = formatTime(start, { ...options, style: 'medium' }).split(',')[0];
    
    return `${dateFormatted}, ${startFormatted} - ${endFormatted}`;
  } 
    const startFormatted = formatTime(start, options);
    const endFormatted = formatTime(end, options);
    
    return `${startFormatted} - ${endFormatted}`;
  
}

/**
 * Format trading session time
 * @param timestamp
 * @param market
. */
export function formatTradingSession(
  timestamp: number | Date | string,
  market: TradingMarket = 'crypto'
): string {
  const date = new Date(timestamp);
  
  if (isNaN(date.getTime())) {
    return 'Invalid Date';
  }

  const marketTimezones: Record<string, string> = {
    'NYSE': 'America/New_York',
    'NASDAQ': 'America/New_York',
    'LSE': 'Europe/London',
    'TSE': 'Asia/Tokyo',
    'crypto': 'UTC'
  };

  const timeZone = marketTimezones[market];
  
  return formatTime(date, {
    style: 'medium',
    timeZone: timeZone || 'UTC',
    locale: 'en-US'
  });
}

/**
 * Get market session status
 * @param timestamp
 * @param market
. */
export function getMarketSessionStatus(
  timestamp: number | Date | string,
  market: TradingMarket = 'crypto'
): MarketSessionInfo {
  if (market === 'crypto') {
    return {
      status: 'always-open',
      message: 'Crypto markets are open 24/7'
    };
  }

  const date = new Date(timestamp);
  const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
  
  // Simple implementation - in production, use a proper market calendar
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return {
      status: 'closed',
      message: 'Market is closed on weekends'
    };
  }

  // For simplicity, assuming all markets are open during weekdays
  return {
    status: 'open',
    message: 'Market is open'
  };
}

/**
 * Parse time string to timestamp
 * @param timeString
. */
export function parseTimeString(timeString: string): number | null {
  if (!timeString || typeof timeString !== 'string') {
    return null;
  }

  try {
    // Try various common formats for validation
    const formats = [
      // ISO 8601
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/,
      // Date only
      /^\d{4}-\d{2}-\d{2}$/,
      // US format
      /^\d{1,2}\/\d{1,2}\/\d{4}$/,
      // European format
      /^\d{1,2}\.\d{1,2}\.\d{4}$/,
      // Time only
      /^\d{1,2}:\d{2}(:\d{2})?$/
    ];

    const trimmed = timeString.trim();
    
    // Validate format before parsing
    const isValidFormat = formats.some(format => format.test(trimmed));
    
    if (!isValidFormat) {
      return null;
    }

    const timestamp = Date.parse(trimmed);
    
    if (!isNaN(timestamp)) {
      return timestamp;
    }

    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Time formatting utilities
. */
export const timeFormattingUtils = {
  formatTime,
  formatDuration,
  formatTimeForContext,
  formatTimeRange,
  formatTradingSession,
  getMarketSessionStatus,
  parseTimeString,
  
  // Common formatters
  formatters: {
    timestamp: (ts: number) => formatTime(ts, { style: 'full', includeMs: true }),
    date: (ts: number) => formatTime(ts, { pattern: 'YYYY-MM-DD' }),
    time: (ts: number) => formatTime(ts, { pattern: 'HH:mm:ss' }),
    datetime: (ts: number) => formatTime(ts, { pattern: 'YYYY-MM-DD HH:mm:ss' }),
    relative: (ts: number) => formatTime(ts, { style: 'relative' }),
    duration: (ms: number) => formatDuration(ms, { style: 'short' }),
    trading: (ts: number) => formatTradingSession(ts, 'crypto'),
    chart: (ts: number) => formatTimeForContext(ts, 'chart'),
    log: (ts: number) => formatTimeForContext(ts, 'log')
  },
  
  // Timezone utilities
  timezone: {
    utc: (ts: number) => formatTime(ts, { timeZone: 'UTC' }),
    est: (ts: number) => formatTime(ts, { timeZone: 'America/New_York' }),
    pst: (ts: number) => formatTime(ts, { timeZone: 'America/Los_Angeles' }),
    gmt: (ts: number) => formatTime(ts, { timeZone: 'Europe/London' }),
    jst: (ts: number) => formatTime(ts, { timeZone: 'Asia/Tokyo' })
  }
};
