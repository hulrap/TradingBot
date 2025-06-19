import { z } from 'zod';

// Generic API response
export const APIResponseSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  error: z.string().optional(),
  message: z.string().optional(),
  timestamp: z.date().default(() => new Date())
});

export type APIResponse<T = any> = {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: Date;
};

// Pagination
export const PaginationSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
  total: z.number().optional(),
  totalPages: z.number().optional()
});

export type Pagination = z.infer<typeof PaginationSchema>;

// Paginated response
export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    data: z.array(dataSchema),
    pagination: PaginationSchema,
    error: z.string().optional()
  });

export type PaginatedResponse<T> = {
  success: boolean;
  data: T[];
  pagination: Pagination;
  error?: string;
};

// API endpoint types
export const HTTPMethodSchema = z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']);
export type HTTPMethod = z.infer<typeof HTTPMethodSchema>;

// Request headers
export const RequestHeadersSchema = z.object({
  'Authorization': z.string().optional(),
  'Content-Type': z.string().optional(),
  'X-API-Key': z.string().optional(),
  'User-Agent': z.string().optional()
});

export type RequestHeaders = z.infer<typeof RequestHeadersSchema>;

// Rate limiting
export const RateLimitSchema = z.object({
  limit: z.number(),
  remaining: z.number(),
  reset: z.number(),
  retryAfter: z.number().optional()
});

export type RateLimit = z.infer<typeof RateLimitSchema>;