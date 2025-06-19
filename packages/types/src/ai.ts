import { z } from 'zod';

// AI strategy types
export const AIStrategyTypeSchema = z.enum([
  'reinforcement_learning', 'ensemble', 'neural_network', 
  'genetic_algorithm', 'sentiment_analysis', 'pattern_recognition'
]);

export type AIStrategyType = z.infer<typeof AIStrategyTypeSchema>;

// ML model configuration
export const MLModelConfigSchema = z.object({
  modelType: AIStrategyTypeSchema,
  parameters: z.record(z.any()),
  trainingData: z.object({
    features: z.array(z.string()),
    targetVariable: z.string(),
    timeframe: z.string()
  }),
  performance: z.object({
    accuracy: z.number().optional(),
    precision: z.number().optional(),
    recall: z.number().optional(),
    f1Score: z.number().optional(),
    sharpeRatio: z.number().optional()
  }).optional()
});

export type MLModelConfig = z.infer<typeof MLModelConfigSchema>;

// Feature engineering
export const FeatureSchema = z.object({
  name: z.string(),
  type: z.enum(['technical', 'fundamental', 'sentiment', 'on_chain']),
  timeframe: z.string(),
  value: z.number(),
  timestamp: z.date()
});

export type Feature = z.infer<typeof FeatureSchema>;

// Prediction
export const PredictionSchema = z.object({
  symbol: z.string(),
  prediction: z.number(),
  confidence: z.number().min(0).max(1),
  timeframe: z.string(),
  features: z.array(FeatureSchema),
  modelId: z.string(),
  createdAt: z.date(),
  expiresAt: z.date()
});

export type Prediction = z.infer<typeof PredictionSchema>;