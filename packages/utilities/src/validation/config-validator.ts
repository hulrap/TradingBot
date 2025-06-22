/**
 * @file Configuration validation utilities
 * @package @trading-bot/utilities
 * 
 * Production-grade configuration validation with deep object validation,
 * type checking, and comprehensive error reporting.
. */

import type { 
  ConfigValidationResult, 
  SchemaValidationOptions, 
  ValidationRule, 
  FieldSchema, 
  ValidationSchema,
  FieldValidationResult,
  TypeValidationResult,
  RuleValidationResult
} from '../../../types/src/utilities/validation';

/**
 * Validate configuration object against schema
 * @param config
 * @param schema
 * @param options
. */
export function validateConfig<T = any>(
  config: any,
  schema: ValidationSchema,
  options: SchemaValidationOptions = {}
): ConfigValidationResult<T> {
  const startTime = Date.now();
  
  const {
    allowUnknown = false,
    stripUnknown = false,
    abortEarly = false,
    convert = true,
    context = {}
  } = { ...schema.options, ...options };

  const errors: Array<{ field: string; message: string; value?: any; code?: string }> = [];
  const warnings: Array<{ field: string; message: string; value?: any; code?: string }> = [];
  const defaults: Record<string, any> = {};
  const validatedConfig: any = stripUnknown ? {} : { ...config };

  try {
    // Validate that config is an object
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
      return {
        isValid: false,
        errors: [{
          field: 'root',
          message: 'Configuration must be an object',
          value: config,
          code: 'INVALID_TYPE'
        }],
        warnings: []
      };
    }

    // Validate each field in the schema
    for (const [fieldName, fieldSchema] of Object.entries(schema.fields)) {
      const fieldResult = validateField(
        config[fieldName],
        fieldSchema,
        fieldName,
        { ...context, parentObject: config },
        convert
      );

      if (fieldResult.errors.length > 0) {
        errors.push(...fieldResult.errors);
        if (abortEarly) break;
      }

      if (fieldResult.warnings.length > 0) {
        warnings.push(...fieldResult.warnings);
      }

      if (fieldResult.hasDefault) {
        defaults[fieldName] = fieldResult.defaultValue;
        validatedConfig[fieldName] = fieldResult.defaultValue;
      } else if (fieldResult.isValid) {
        validatedConfig[fieldName] = fieldResult.value;
      }
    }

    // Check for unknown fields
    if (!allowUnknown) {
      for (const key of Object.keys(config)) {
        if (!(key in schema.fields)) {
          if (stripUnknown) {
            delete validatedConfig[key];
          } else {
            errors.push({
              field: key,
              message: `Unknown field '${key}' is not allowed`,
              value: config[key],
              code: 'UNKNOWN_FIELD'
            });
          }
        }
      }
    }

    // Validate interdependent fields if present
    const interdependencyErrors = validateFieldInterdependencies(validatedConfig, schema, context);
    errors.push(...interdependencyErrors);

    const endTime = Date.now();
    const validationTime = endTime - startTime;

    const result: ConfigValidationResult<T> = {
      isValid: errors.length === 0,
      config: errors.length === 0 ? validatedConfig : undefined,
      errors,
      warnings,
      defaults: Object.keys(defaults).length > 0 ? defaults : {}
    };

    // Add performance metadata for development
    if (process.env.NODE_ENV === 'development') {
      (result as any).metadata = {
        validationTimeMs: validationTime,
        fieldsValidated: Object.keys(schema.fields).length,
        totalFields: Object.keys(config).length
      };
    }

    return result;

  } catch (error) {
    return {
      isValid: false,
      errors: [{
        field: 'root',
        message: `Configuration validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        code: 'VALIDATION_ERROR'
      }],
      warnings: []
    };
  }
}

/**
 * Validate individual field against schema
 * @param value
 * @param schema
 * @param fieldName
 * @param context
 * @param convert
. */
function validateField(
  value: any,
  schema: FieldSchema,
  fieldName: string,
  context: Record<string, any>,
  convert: boolean
): FieldValidationResult {
  const errors: Array<{ field: string; message: string; value?: any; code?: string }> = [];
  const warnings: Array<{ field: string; message: string; value?: any; code?: string }> = [];
  let processedValue = value;
  let hasDefault = false;
  let defaultValue: any;

  // Handle undefined/null values
  if (value === undefined || value === null) {
    if (schema.required) {
      errors.push({
        field: fieldName,
        message: `Field '${fieldName}' is required`,
        value,
        code: 'REQUIRED_FIELD'
      });
      return { isValid: false, errors, warnings, hasDefault };
    } else if (schema.default !== undefined) {
      processedValue = schema.default;
      hasDefault = true;
      defaultValue = schema.default;
    } else {
      return { isValid: true, value: processedValue, errors, warnings, hasDefault };
    }
  }

  // Type conversion
  if (convert && processedValue !== undefined && processedValue !== null) {
    const conversionResult = convertValue(processedValue, schema.type);
    if (conversionResult.success) {
      if (conversionResult.value !== processedValue) {
        warnings.push({
          field: fieldName,
          message: `Value automatically converted from ${typeof processedValue} to ${schema.type}`,
          value: processedValue,
          code: 'TYPE_CONVERSION'
        });
      }
      processedValue = conversionResult.value;
    } else {
      errors.push({
        field: fieldName,
        message: `Cannot convert '${processedValue}' to ${schema.type}: ${conversionResult.error}`,
        value: processedValue,
        code: 'TYPE_CONVERSION_ERROR'
      });
      return { isValid: false, errors, warnings, hasDefault, defaultValue };
    }
  }

  // Type validation
  const typeValidation = validateType(processedValue, schema.type, fieldName);
  if (!typeValidation.isValid) {
    errors.push(...typeValidation.errors);
    return { isValid: false, errors, warnings, hasDefault, defaultValue };
  }

  // Rules validation
  if (schema.rules) {
    for (const rule of schema.rules) {
      // Check if rule should be applied based on condition
      if (rule.condition && !rule.condition(context)) {
        continue;
      }

      const ruleResult = validateRule(processedValue, rule, fieldName);
      if (!ruleResult.isValid) {
        errors.push(...ruleResult.errors);
      }
      if (ruleResult.warnings) {
        warnings.push(...ruleResult.warnings);
      }
    }
  }

  // Nested object validation
  if (schema.type === 'object' && schema.schema && processedValue && typeof processedValue === 'object' && !Array.isArray(processedValue)) {
    const nestedSchema: ValidationSchema = {
      fields: schema.schema,
      options: { allowUnknown: true }
    };
    
    const nestedResult = validateConfig(processedValue, nestedSchema, { convert });
    if (!nestedResult.isValid) {
      // Prefix field names with parent field
      const prefixedErrors = nestedResult.errors.map(error => ({
        ...error,
        field: `${fieldName}.${error.field}`
      }));
      errors.push(...prefixedErrors);
    } else {
      processedValue = nestedResult.config;
    }
  }

  // Array validation
  if (schema.type === 'array' && Array.isArray(processedValue) && schema.schema) {
    const arrayErrors: typeof errors = [];
    const validatedArray: any[] = [];

    // Get the item schema - use the first field as the item schema
    const itemSchemaEntries = Object.entries(schema.schema);
    if (itemSchemaEntries.length === 0) {
      errors.push({
        field: fieldName,
        message: 'Array schema must define at least one field for items',
        value: processedValue,
        code: 'MISSING_ITEM_SCHEMA'
      });
      return { isValid: false, errors, warnings, hasDefault, defaultValue };
    }

    const firstEntry = itemSchemaEntries[0]!; // Non-null assertion since we checked length > 0
    const [, itemSchema] = firstEntry;

    for (let i = 0; i < processedValue.length; i++) {
      const itemResult = validateField(
        processedValue[i],
        itemSchema,
        `${fieldName}[${i}]`,
        { ...context, arrayIndex: i, parentArray: processedValue },
        convert
      );

      if (!itemResult.isValid) {
        arrayErrors.push(...itemResult.errors);
      } else {
        validatedArray.push(itemResult.value);
      }
    }

    if (arrayErrors.length > 0) {
      errors.push(...arrayErrors);
    } else {
      processedValue = validatedArray;
    }
  }

  return {
    isValid: errors.length === 0,
    value: processedValue,
    errors,
    warnings,
    hasDefault,
    defaultValue
  };
}

/**
 * Validate value type
 * @param value
 * @param expectedType
 * @param fieldName
. */
function validateType(
  value: any,
  expectedType: string,
  fieldName: string
): TypeValidationResult {
  const errors: Array<{ field: string; message: string; value?: any; code?: string }> = [];

  switch (expectedType) {
    case 'string':
      if (typeof value !== 'string') {
        errors.push({
          field: fieldName,
          message: `Expected string, got ${typeof value}`,
          value,
          code: 'TYPE_MISMATCH'
        });
      }
      break;

    case 'number':
      if (typeof value !== 'number' || !isFinite(value)) {
        errors.push({
          field: fieldName,
          message: `Expected finite number, got ${typeof value}`,
          value,
          code: 'TYPE_MISMATCH'
        });
      }
      break;

    case 'boolean':
      if (typeof value !== 'boolean') {
        errors.push({
          field: fieldName,
          message: `Expected boolean, got ${typeof value}`,
          value,
          code: 'TYPE_MISMATCH'
        });
      }
      break;

    case 'object':
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        errors.push({
          field: fieldName,
          message: `Expected object, got ${Array.isArray(value) ? 'array' : typeof value}`,
          value,
          code: 'TYPE_MISMATCH'
        });
      }
      break;

    case 'array':
      if (!Array.isArray(value)) {
        errors.push({
          field: fieldName,
          message: `Expected array, got ${typeof value}`,
          value,
          code: 'TYPE_MISMATCH'
        });
      }
      break;

    case 'date':
      if (!(value instanceof Date) || isNaN(value.getTime())) {
        errors.push({
          field: fieldName,
          message: `Expected valid Date object, got ${typeof value}`,
          value,
          code: 'TYPE_MISMATCH'
        });
      }
      break;

    case 'bigint':
      if (typeof value !== 'bigint') {
        errors.push({
          field: fieldName,
          message: `Expected bigint, got ${typeof value}`,
          value,
          code: 'TYPE_MISMATCH'
        });
      }
      break;

    default:
      errors.push({
        field: fieldName,
        message: `Unknown type '${expectedType}'`,
        value,
        code: 'UNKNOWN_TYPE'
      });
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Convert value to target type
 * @param value
 * @param targetType
. */
function convertValue(
  value: any,
  targetType: string
): { success: boolean; value?: any; error?: string } {
  try {
    switch (targetType) {
      case 'string':
        return { success: true, value: String(value) };

      case 'number':
        if (typeof value === 'string') {
          const num = parseFloat(value);
          if (isNaN(num)) {
            return { success: false, error: 'Cannot parse as number' };
          }
          return { success: true, value: num };
        }
        if (typeof value === 'number') {
          return { success: true, value };
        }
        if (typeof value === 'boolean') {
          return { success: true, value: value ? 1 : 0 };
        }
        return { success: false, error: 'Cannot convert to number' };

      case 'boolean':
        if (typeof value === 'boolean') {
          return { success: true, value };
        }
        if (typeof value === 'string') {
          const lower = value.toLowerCase().trim();
          if (['true', '1', 'yes', 'on', 'enabled'].includes(lower)) {
            return { success: true, value: true };
          }
          if (['false', '0', 'no', 'off', 'disabled'].includes(lower)) {
            return { success: true, value: false };
          }
        }
        if (typeof value === 'number') {
          return { success: true, value: Boolean(value) };
        }
        return { success: false, error: 'Cannot convert to boolean' };

      case 'date':
        if (value instanceof Date) {
          return { success: true, value };
        }
        if (typeof value === 'string' || typeof value === 'number') {
          const date = new Date(value);
          if (isNaN(date.getTime())) {
            return { success: false, error: 'Invalid date format' };
          }
          return { success: true, value: date };
        }
        return { success: false, error: 'Cannot convert to Date' };

      case 'bigint':
        if (typeof value === 'bigint') {
          return { success: true, value };
        }
        if (typeof value === 'string' || typeof value === 'number') {
          try {
            return { success: true, value: BigInt(value) };
          } catch {
            return { success: false, error: 'Cannot convert to BigInt' };
          }
        }
        return { success: false, error: 'Cannot convert to BigInt' };

      case 'array':
        if (Array.isArray(value)) {
          return { success: true, value };
        }
        // Convert single values to arrays
        return { success: true, value: [value] };

      case 'object':
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          return { success: true, value };
        }
        return { success: false, error: 'Cannot convert to object' };

      default:
        return { success: true, value }; // No conversion for unknown types
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Conversion failed' };
  }
}

/**
 * Validate field against rule
 * @param value
 * @param rule
 * @param fieldName
. */
function validateRule(
  value: any,
  rule: ValidationRule,
  fieldName: string
): RuleValidationResult {
  const errors: Array<{ field: string; message: string; value?: any; code?: string }> = [];
  const warnings: Array<{ field: string; message: string; value?: any; code?: string }> = [];

  switch (rule.type) {
    case 'required':
      if (value === undefined || value === null || value === '') {
        errors.push({
          field: fieldName,
          message: rule.message || `Field '${fieldName}' is required`,
          value,
          code: 'REQUIRED'
        });
      }
      break;

    case 'min':
      if (typeof value === 'number' && value < rule.value) {
        errors.push({
          field: fieldName,
          message: rule.message || `Value must be at least ${rule.value}`,
          value,
          code: 'MIN_VALUE'
        });
      } else if (typeof value === 'string' && value.length < rule.value) {
        errors.push({
          field: fieldName,
          message: rule.message || `String must be at least ${rule.value} characters`,
          value,
          code: 'MIN_LENGTH'
        });
      } else if (Array.isArray(value) && value.length < rule.value) {
        errors.push({
          field: fieldName,
          message: rule.message || `Array must have at least ${rule.value} items`,
          value,
          code: 'MIN_ITEMS'
        });
      }
      break;

    case 'max':
      if (typeof value === 'number' && value > rule.value) {
        errors.push({
          field: fieldName,
          message: rule.message || `Value must be at most ${rule.value}`,
          value,
          code: 'MAX_VALUE'
        });
      } else if (typeof value === 'string' && value.length > rule.value) {
        errors.push({
          field: fieldName,
          message: rule.message || `String must be at most ${rule.value} characters`,
          value,
          code: 'MAX_LENGTH'
        });
      } else if (Array.isArray(value) && value.length > rule.value) {
        errors.push({
          field: fieldName,
          message: rule.message || `Array must have at most ${rule.value} items`,
          value,
          code: 'MAX_ITEMS'
        });
      }
      break;

    case 'pattern':
      if (typeof value === 'string' && rule.value instanceof RegExp) {
        if (!rule.value.test(value)) {
          errors.push({
            field: fieldName,
            message: rule.message || `Value does not match required pattern`,
            value,
            code: 'PATTERN_MISMATCH'
          });
        }
      }
      break;

    case 'enum':
      if (Array.isArray(rule.value) && !rule.value.includes(value)) {
        errors.push({
          field: fieldName,
          message: rule.message || `Value must be one of: ${rule.value.join(', ')}`,
          value,
          code: 'ENUM_MISMATCH'
        });
      }
      break;

    case 'custom':
      if (rule.validator) {
        try {
          const result = rule.validator(value, { fieldName, ...rule });
          if (typeof result === 'string') {
            errors.push({
              field: fieldName,
              message: result,
              value,
              code: 'CUSTOM_VALIDATION'
            });
          } else if (result === false) {
            errors.push({
              field: fieldName,
              message: rule.message || 'Custom validation failed',
              value,
              code: 'CUSTOM_VALIDATION'
            });
          }
        } catch (error) {
          errors.push({
            field: fieldName,
            message: `Custom validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            value,
            code: 'CUSTOM_VALIDATION_ERROR'
          });
        }
      }
      break;
  }

  return { isValid: errors.length === 0, errors, warnings };
}

/**
 * Validate field interdependencies
 * @param config
 * @param schema
 * @param context
. */
function validateFieldInterdependencies(
  config: any,
  schema: ValidationSchema,
  context: Record<string, any>
): Array<{ field: string; message: string; value?: any; code?: string }> {
  const errors: Array<{ field: string; message: string; value?: any; code?: string }> = [];

  // Example interdependency validations that can be extended
  for (const [fieldName, fieldSchema] of Object.entries(schema.fields)) {
    if (fieldSchema.rules) {
      for (const rule of fieldSchema.rules) {
        if (rule.type === 'custom' && rule.validator) {
          try {
            const result = rule.validator(config[fieldName], { 
              fieldName, 
              config, 
              context,
              ...rule 
            });
            
            if (typeof result === 'string') {
              errors.push({
                field: fieldName,
                message: result,
                value: config[fieldName],
                code: 'INTERDEPENDENCY_VALIDATION'
              });
            } else if (result === false) {
              errors.push({
                field: fieldName,
                message: rule.message || 'Interdependency validation failed',
                value: config[fieldName],
                code: 'INTERDEPENDENCY_VALIDATION'
              });
            }
          } catch (error) {
            errors.push({
              field: fieldName,
              message: `Interdependency validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
              value: config[fieldName],
              code: 'INTERDEPENDENCY_VALIDATION_ERROR'
            });
          }
        }
      }
    }
  }

  return errors;
}

/**
 * Create validation schema builder
. */
export function createSchema(): ValidationSchemaBuilder {
  return new ValidationSchemaBuilder();
}

/**
 * Schema builder for fluent API
. */
class ValidationSchemaBuilder {
  private fields: Record<string, FieldSchema> = {};
  private schemaOptions: SchemaValidationOptions = {};

  /**
   *
   * @param name
  . */
  field(name: string): FieldBuilder {
    return new FieldBuilder(this, name);
  }

  /**
   *
   * @param opts
  . */
  setOptions(opts: SchemaValidationOptions): ValidationSchemaBuilder {
    this.schemaOptions = { ...this.schemaOptions, ...opts };
    return this;
  }

  /**
   *
  . */
  build(): ValidationSchema {
    return {
      fields: this.fields,
      options: this.schemaOptions
    };
  }

  /**
   * @param name
   * @param schema
   * @internal
  . */
  addField(name: string, schema: FieldSchema): void {
    this.fields[name] = schema;
  }
}

/**
 * Field builder for fluent API
. */
class FieldBuilder {
  private readonly schema: FieldSchema;

  /**
   *
   * @param parent
   * @param fieldName
  . */
  constructor(private readonly parent: ValidationSchemaBuilder, private readonly fieldName: string) {
    this.schema = { type: 'string' };
  }

  /**
   *
   * @param type
  . */
  type(type: FieldSchema['type']): FieldBuilder {
    this.schema.type = type;
    return this;
  }

  /**
   *
   * @param required
  . */
  required(required: boolean = true): FieldBuilder {
    this.schema.required = required;
    return this;
  }

  /**
   *
   * @param value
  . */
  default(value: any): FieldBuilder {
    this.schema.default = value;
    return this;
  }

  /**
   *
   * @param value
  . */
  min(value: number): FieldBuilder {
    this.addRule({ type: 'min', value });
    return this;
  }

  /**
   *
   * @param value
  . */
  max(value: number): FieldBuilder {
    this.addRule({ type: 'max', value });
    return this;
  }

  /**
   *
   * @param regex
   * @param message
  . */
  pattern(regex: RegExp, message?: string): FieldBuilder {
    this.addRule({ type: 'pattern', value: regex, message: message || '' });
    return this;
  }

  /**
   *
   * @param values
   * @param message
  . */
  enum(values: any[], message?: string): FieldBuilder {
    this.addRule({ type: 'enum', value: values, message: message || '' });
    return this;
  }

  /**
   *
   * @param validator
   * @param message
  . */
  custom(validator: ValidationRule['validator'], message?: string): FieldBuilder {
    this.addRule({ type: 'custom', validator: validator || (() => false), message: message || '' });
    return this;
  }

  /**
   *
   * @param desc
  . */
  description(desc: string): FieldBuilder {
    this.schema.description = desc;
    return this;
  }

  /**
   *
   * @param examples
  . */
  examples(examples: any[]): FieldBuilder {
    this.schema.examples = examples;
    return this;
  }

  /**
   *
  . */
  end(): ValidationSchemaBuilder {
    this.parent.addField(this.fieldName, this.schema);
    return this.parent;
  }

  /**
   *
   * @param rule
  . */
  private addRule(rule: ValidationRule): void {
    if (!this.schema.rules) {
      this.schema.rules = [];
    }
    this.schema.rules.push(rule);
  }
}

/**
 * Configuration validation utilities
. */
export const configValidationUtils = {
  validateConfig,
  createSchema,
  
  // Quick validation functions
  validateString: (value: any, options: { min?: number; max?: number; pattern?: RegExp } = {}) => {
    const schemaBuilder = createSchema().field('value').type('string');
    
    if (options.min !== undefined) {
      schemaBuilder.min(options.min);
    }
    
    if (options.max !== undefined) {
      schemaBuilder.max(options.max);
    }
    
    if (options.pattern) {
      schemaBuilder.pattern(options.pattern);
    }
    
    return validateConfig({ value }, schemaBuilder.end().build());
  },
  
  validateNumber: (value: any, options: { min?: number; max?: number } = {}) => {
    const schemaBuilder = createSchema().field('value').type('number');
    
    if (options.min !== undefined) {
      schemaBuilder.min(options.min);
    }
    
    if (options.max !== undefined) {
      schemaBuilder.max(options.max);
    }
    
    return validateConfig({ value }, schemaBuilder.end().build());
  },
  
  validateArray: (value: any, options: { minItems?: number; maxItems?: number } = {}) => {
    const schemaBuilder = createSchema().field('value').type('array');
    
    if (options.minItems !== undefined) {
      schemaBuilder.min(options.minItems);
    }
    
    if (options.maxItems !== undefined) {
      schemaBuilder.max(options.maxItems);
    }
    
    return validateConfig({ value }, schemaBuilder.end().build());
  },

  // Predefined common schemas
  createTradingConfigSchema: () => createSchema()
    .field('apiKey').type('string').required().min(1).end()
    .field('secretKey').type('string').required().min(1).end()
    .field('testnet').type('boolean').default(false).end()
    .field('timeout').type('number').min(1000).max(30000).default(5000).end()
    .field('retries').type('number').min(0).max(10).default(3).end()
    .build(),

  createDatabaseConfigSchema: () => createSchema()
    .field('host').type('string').required().min(1).end()
    .field('port').type('number').min(1).max(65535).default(5432).end()
    .field('database').type('string').required().min(1).end()
    .field('username').type('string').required().min(1).end()
    .field('password').type('string').required().min(1).end()
    .field('ssl').type('boolean').default(false).end()
    .field('poolSize').type('number').min(1).max(100).default(10).end()
    .build()
};
