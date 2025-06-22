/**
 * @file JSON schema validation utilities
 * @package @trading-bot/utilities
 * 
 * Production-grade JSON schema validation with comprehensive error reporting,
 * type checking, and format validation.
. */

import type { 
  JSONValidationResult, 
  JSONSchema,
  SchemaValidationError,
  SchemaValidationOptions
} from '@trading-bot/types/src/utilities/validation/validation';

/**
 * Validate JSON data against schema
 * @param data
 * @param schema
 * @param options
. */
export function validateJSONSchema(
  data: any,
  schema: JSONSchema,
  options: SchemaValidationOptions = {}
): JSONValidationResult {
  const {
    strict = true,
    validateFormats = true,
    allowUndefinedKeywords = false,
    removeAdditional = false,
    useDefaults = true,
    coerceTypes = false
  } = options;

  try {
    const errors: SchemaValidationError[] = [];
    const processedData = JSON.parse(JSON.stringify(data)); // Deep clone

    // Validate data against schema
    validateValue(processedData, schema, '', errors, {
      strict,
      validateFormats,
      allowUndefinedKeywords,
      removeAdditional,
      useDefaults,
      coerceTypes
    });

    if (errors.length > 0) {
      return {
        isValid: false,
        error: {
          message: `Schema validation failed: ${errors.length} error(s) - ${errors[0]?.message || 'Unknown error'}`,
          line: 0,
          column: 0,
          offset: 0
        },
        stats: generateStats(data)
      };
    }

    return {
      isValid: true,
      data: processedData,
      stats: generateStats(processedData)
    };

  } catch (error) {
    return {
      isValid: false,
      error: {
        message: error instanceof Error ? error.message : 'Unknown validation error',
        line: 0,
        column: 0,
        offset: 0
      },
      stats: generateStats(data)
    };
  }
}

/**
 * Validate value against schema
 * @param value
 * @param schema
 * @param path
 * @param errors
 * @param options
. */
function validateValue(
  value: any,
  schema: JSONSchema,
  path: string,
  errors: SchemaValidationError[],
  options: Required<Omit<SchemaValidationOptions, 'allowUnknown' | 'stripUnknown' | 'abortEarly' | 'convert' | 'context'>>
): void {
  // Type validation
  if (schema.type) {
    if (!validateType(value, schema.type)) {
      errors.push({
        path,
        keyword: 'type',
        message: `Expected ${Array.isArray(schema.type) ? schema.type.join(' or ') : schema.type}, got ${getType(value)}`,
        value,
        schema: schema.type
      });
      return; // Early return on type mismatch
    }
  }

  // Constant validation
  if (schema.const !== undefined) {
    if (!deepEqual(value, schema.const)) {
      errors.push({
        path,
        keyword: 'const',
        message: `Value must be exactly ${JSON.stringify(schema.const)}`,
        value,
        schema: schema.const
      });
    }
  }

  // Enum validation
  if (schema.enum) {
    if (!schema.enum.some(enumValue => deepEqual(value, enumValue))) {
      errors.push({
        path,
        keyword: 'enum',
        message: `Value must be one of: ${schema.enum.map(v => JSON.stringify(v)).join(', ')}`,
        value,
        schema: schema.enum
      });
    }
  }

  // String validations
  if (typeof value === 'string') {
    validateString(value, schema, path, errors, options);
  }

  // Number validations
  if (typeof value === 'number') {
    validateNumber(value, schema, path, errors);
  }

  // Array validations
  if (Array.isArray(value)) {
    validateArray(value, schema, path, errors, options);
  }

  // Object validations
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    validateObject(value, schema, path, errors, options);
  }

  // Conditional validations
  if (schema.if) {
    const ifValid = validateConditional(value, schema.if, path, options);
    if (ifValid && schema.then) {
      validateValue(value, schema.then, path, errors, options);
    } else if (!ifValid && schema.else) {
      validateValue(value, schema.else, path, errors, options);
    }
  }

  // Composition validations
  if (schema.allOf) {
    for (const subSchema of schema.allOf) {
      validateValue(value, subSchema, path, errors, options);
    }
  }

  if (schema.anyOf) {
    const anyOfErrors: SchemaValidationError[] = [];
    let anyValid = false;
    
    for (const subSchema of schema.anyOf) {
      const subErrors: SchemaValidationError[] = [];
      validateValue(value, subSchema, path, subErrors, options);
      if (subErrors.length === 0) {
        anyValid = true;
        break;
      }
      anyOfErrors.push(...subErrors);
    }
    
    if (!anyValid) {
      errors.push({
        path,
        keyword: 'anyOf',
        message: 'Value does not match any of the allowed schemas',
        value,
        schema: schema.anyOf
      });
    }
  }

  if (schema.oneOf) {
    let validCount = 0;
    
    for (const subSchema of schema.oneOf) {
      const subErrors: SchemaValidationError[] = [];
      validateValue(value, subSchema, path, subErrors, options);
      if (subErrors.length === 0) {
        validCount++;
      }
    }
    
    if (validCount !== 1) {
      errors.push({
        path,
        keyword: 'oneOf',
        message: `Value must match exactly one schema, but matched ${validCount}`,
        value,
        schema: schema.oneOf
      });
    }
  }

  if (schema.not) {
    const notErrors: SchemaValidationError[] = [];
    validateValue(value, schema.not, path, notErrors, options);
    if (notErrors.length === 0) {
      errors.push({
        path,
        keyword: 'not',
        message: 'Value must not match the given schema',
        value,
        schema: schema.not
      });
    }
  }
}

/**
 * Validate string value
 * @param value
 * @param schema
 * @param path
 * @param errors
 * @param options
. */
function validateString(
  value: string,
  schema: JSONSchema,
  path: string,
  errors: SchemaValidationError[],
  options: Required<Omit<SchemaValidationOptions, 'allowUnknown' | 'stripUnknown' | 'abortEarly' | 'convert' | 'context'>>
): void {
  // Length validations
  if (schema.minLength !== undefined && value.length < schema.minLength) {
    errors.push({
      path,
      keyword: 'minLength',
      message: `String must be at least ${schema.minLength} characters long`,
      value,
      schema: schema.minLength
    });
  }

  if (schema.maxLength !== undefined && value.length > schema.maxLength) {
    errors.push({
      path,
      keyword: 'maxLength',
      message: `String must be at most ${schema.maxLength} characters long`,
      value,
      schema: schema.maxLength
    });
  }

  // Pattern validation
  if (schema.pattern) {
    const regex = new RegExp(schema.pattern);
    if (!regex.test(value)) {
      errors.push({
        path,
        keyword: 'pattern',
        message: `String does not match pattern: ${schema.pattern}`,
        value,
        schema: schema.pattern
      });
    }
  }

  // Format validation
  if (schema.format && options.validateFormats) {
    if (!validateFormat(value, schema.format)) {
      errors.push({
        path,
        keyword: 'format',
        message: `String does not match format: ${schema.format}`,
        value,
        schema: schema.format
      });
    }
  }
}

/**
 * Validate number value
 * @param value
 * @param schema
 * @param path
 * @param errors
. */
function validateNumber(
  value: number,
  schema: JSONSchema,
  path: string,
  errors: SchemaValidationError[]
): void {
  if (schema.minimum !== undefined && value < schema.minimum) {
    errors.push({
      path,
      keyword: 'minimum',
      message: `Number must be >= ${schema.minimum}`,
      value,
      schema: schema.minimum
    });
  }

  if (schema.maximum !== undefined && value > schema.maximum) {
    errors.push({
      path,
      keyword: 'maximum',
      message: `Number must be <= ${schema.maximum}`,
      value,
      schema: schema.maximum
    });
  }
}

/**
 * Validate array value
 * @param value
 * @param schema
 * @param path
 * @param errors
 * @param options
. */
function validateArray(
  value: any[],
  schema: JSONSchema,
  path: string,
  errors: SchemaValidationError[],
  options: Required<Omit<SchemaValidationOptions, 'allowUnknown' | 'stripUnknown' | 'abortEarly' | 'convert' | 'context'>>
): void {
  // Length validations
  if (schema.minItems !== undefined && value.length < schema.minItems) {
    errors.push({
      path,
      keyword: 'minItems',
      message: `Array must have at least ${schema.minItems} items`,
      value,
      schema: schema.minItems
    });
  }

  if (schema.maxItems !== undefined && value.length > schema.maxItems) {
    errors.push({
      path,
      keyword: 'maxItems',
      message: `Array must have at most ${schema.maxItems} items`,
      value,
      schema: schema.maxItems
    });
  }

  // Unique items validation
  if (schema.uniqueItems) {
    const seen = new Set();
    for (let i = 0; i < value.length; i++) {
      const serialized = JSON.stringify(value[i]);
      if (seen.has(serialized)) {
        errors.push({
          path: `${path}[${i}]`,
          keyword: 'uniqueItems',
          message: 'Array items must be unique',
          value: value[i],
          schema: true
        });
      }
      seen.add(serialized);
    }
  }

  // Items validation
  if (schema.items) {
    for (let i = 0; i < value.length; i++) {
      validateValue(value[i], schema.items, `${path}[${i}]`, errors, options);
    }
  }
}

/**
 * Validate object value
 * @param value
 * @param schema
 * @param path
 * @param errors
 * @param options
. */
function validateObject(
  value: Record<string, any>,
  schema: JSONSchema,
  path: string,
  errors: SchemaValidationError[],
  options: Required<Omit<SchemaValidationOptions, 'allowUnknown' | 'stripUnknown' | 'abortEarly' | 'convert' | 'context'>>
): void {
  // Required properties validation
  if (schema.required) {
    for (const requiredProp of schema.required) {
      if (!(requiredProp in value) || value[requiredProp] === undefined) {
        errors.push({
          path: path ? `${path}.${requiredProp}` : requiredProp,
          keyword: 'required',
          message: `Missing required property: ${requiredProp}`,
          value: undefined,
          schema: schema.required
        });
      }
    }
  }

  // Properties validation
  if (schema.properties) {
    for (const [propName, propSchema] of Object.entries(schema.properties)) {
      if (propName in value) {
        const propPath = path ? `${path}.${propName}` : propName;
        validateValue(value[propName], propSchema, propPath, errors, options);
      }
    }
  }

  // Additional properties validation
  if (schema.additionalProperties !== undefined) {
    const allowedProps = new Set(Object.keys(schema.properties || {}));
    
    for (const propName of Object.keys(value)) {
      if (!allowedProps.has(propName)) {
        if (schema.additionalProperties === false) {
          if (options.removeAdditional) {
            delete value[propName];
          } else {
            errors.push({
              path: path ? `${path}.${propName}` : propName,
              keyword: 'additionalProperties',
              message: `Additional property not allowed: ${propName}`,
              value: value[propName],
              schema: false
            });
          }
        } else if (typeof schema.additionalProperties === 'object') {
          const propPath = path ? `${path}.${propName}` : propName;
          validateValue(value[propName], schema.additionalProperties, propPath, errors, options);
        }
      }
    }
  }
}

/**
 * Validate conditional schema
 * @param value
 * @param schema
 * @param path
 * @param options
. */
function validateConditional(
  value: any,
  schema: JSONSchema,
  path: string,
  options: Required<Omit<SchemaValidationOptions, 'allowUnknown' | 'stripUnknown' | 'abortEarly' | 'convert' | 'context'>>
): boolean {
  const errors: SchemaValidationError[] = [];
  validateValue(value, schema, path, errors, options);
  return errors.length === 0;
}

/**
 * Validate data type
 * @param value
 * @param expectedType
. */
function validateType(value: any, expectedType: string | string[]): boolean {
  const actualType = getType(value);
  
  if (Array.isArray(expectedType)) {
    return expectedType.includes(actualType);
  }
  
  return actualType === expectedType;
}

/**
 * Get JSON Schema type of value
 * @param value
. */
function getType(value: any): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'number' && Number.isInteger(value)) return 'integer';
  if (typeof value === 'number') return 'number';
  return typeof value;
}

/**
 * Validate string format
 * @param value
 * @param format
. */
function validateFormat(value: string, format: string): boolean {
  switch (format) {
    case 'email':
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    
    case 'uri':
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    
    case 'date':
      return /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(Date.parse(value));
    
    case 'time':
      return /^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})?$/.test(value);
    
    case 'date-time':
      return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value);
    
    case 'uuid':
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
    
    case 'ipv4':
      return /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(value);
    
    case 'ipv6':
      return /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^::$/.test(value);
    
    case 'hostname':
      return /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/.test(value);
    
    default:
      return true; // Unknown formats are considered valid
  }
}

/**
 * Deep equality check
 * @param a
 * @param b
. */
function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  
  if (a === null || b === null) return a === b;
  
  if (typeof a !== typeof b) return false;
  
  if (typeof a === 'object') {
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    
    if (Array.isArray(a)) {
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        if (!deepEqual(a[i], b[i])) return false;
      }
      return true;
    }
    
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    
    if (keysA.length !== keysB.length) return false;
    
    for (const key of keysA) {
      if (!keysB.includes(key)) return false;
      if (!deepEqual(a[key], b[key])) return false;
    }
    
    return true;
  }
  
  return false;
}

/**
 * Generate JSON statistics
 * @param data
. */
function generateStats(data: any): {
  size: number;
  depth: number;
  keys: number;
  arrays: number;
  objects: number;
} {
  const stats = {
    size: JSON.stringify(data).length,
    depth: 0,
    keys: 0,
    arrays: 0,
    objects: 0
  };

  /**
   *
   * @param obj
   * @param currentDepth
  . */
  function traverse(obj: any, currentDepth: number): void {
    stats.depth = Math.max(stats.depth, currentDepth);
    
    if (Array.isArray(obj)) {
      stats.arrays++;
      for (const item of obj) {
        traverse(item, currentDepth + 1);
      }
    } else if (obj && typeof obj === 'object') {
      stats.objects++;
      const keys = Object.keys(obj);
      stats.keys += keys.length;
      for (const value of Object.values(obj)) {
        traverse(value, currentDepth + 1);
      }
    }
  }

  traverse(data, 0);
  return stats;
}

/**
 * Parse and validate JSON string
 * @param jsonString
 * @param schema
 * @param options
. */
export function parseAndValidateJSON(
  jsonString: string,
  schema?: JSONSchema,
  options: SchemaValidationOptions = {}
): JSONValidationResult {
  try {
    // Parse JSON
    const data = JSON.parse(jsonString);
    
    // If schema provided, validate against it
    if (schema) {
      return validateJSONSchema(data, schema, options);
    }
    
    // Otherwise, just return parsed data with stats
    return {
      isValid: true,
      data,
      stats: generateStats(data)
    };
    
  } catch (error) {
    // Parse error
    const parseError = error as SyntaxError;
    let line: number | undefined;
    let column: number | undefined;
    let offset: number | undefined;
    
    // Extract position information from error message
    const match = parseError.message.match(/at position (\d+)/);
    if (match) {
      offset = parseInt(match[1] || '0', 10);
      
      // Calculate line and column from offset
      const lines = jsonString.substring(0, offset).split('\n');
      line = lines.length;
      column = (lines[lines.length - 1] || '').length + 1;
    }
    
    return {
      isValid: false,
      error: {
        message: parseError.message,
        line: line || 0,
        column: column || 0,
        offset: offset || 0
      },
      stats: {
        size: jsonString.length,
        depth: 0,
        keys: 0,
        arrays: 0,
        objects: 0
      }
    };
  }
}

/**
 * Create schema builder functions for common patterns
 * @param properties
 * @param required
. */
function createObjectSchema(
  properties: Record<string, JSONSchema>, 
  required?: string[]
): JSONSchema {
  const schema: JSONSchema = {
    type: 'object',
    properties,
    additionalProperties: false
  };
  
  if (required && required.length > 0) {
    schema.required = required;
  }
  
  return schema;
}

/**
 *
 * @param items
 * @param minItems
 * @param maxItems
. */
function createArraySchema(
  items: JSONSchema, 
  minItems?: number, 
  maxItems?: number
): JSONSchema {
  const schema: JSONSchema = {
    type: 'array',
    items
  };
  
  if (minItems !== undefined) {
    schema.minItems = minItems;
  }
  
  if (maxItems !== undefined) {
    schema.maxItems = maxItems;
  }
  
  return schema;
}

/**
 *
 * @param minLength
 * @param maxLength
 * @param pattern
 * @param format
. */
function createStringSchema(
  minLength?: number, 
  maxLength?: number, 
  pattern?: string, 
  format?: string
): JSONSchema {
  const schema: JSONSchema = {
    type: 'string'
  };
  
  if (minLength !== undefined) {
    schema.minLength = minLength;
  }
  
  if (maxLength !== undefined) {
    schema.maxLength = maxLength;
  }
  
  if (pattern !== undefined) {
    schema.pattern = pattern;
  }
  
  if (format !== undefined) {
    schema.format = format;
  }
  
  return schema;
}

/**
 *
 * @param minimum
 * @param maximum
. */
function createNumberSchema(
  minimum?: number, 
  maximum?: number
): JSONSchema {
  const schema: JSONSchema = {
    type: 'number'
  };
  
  if (minimum !== undefined) {
    schema.minimum = minimum;
  }
  
  if (maximum !== undefined) {
    schema.maximum = maximum;
  }
  
  return schema;
}

/**
 *
 * @param values
. */
function createEnumSchema(values: any[]): JSONSchema {
  return {
    enum: values
  };
}

/**
 * Schema validation utilities
. */
export const schemaValidationUtils = {
  validateJSONSchema,
  parseAndValidateJSON,
  validateFormat,
  getType,
  deepEqual,
  
  // Schema builders
  createObjectSchema,
  createArraySchema,
  createStringSchema,
  createNumberSchema,
  createEnumSchema
};
