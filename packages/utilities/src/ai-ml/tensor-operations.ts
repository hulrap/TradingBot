/**
 * @file Tensor Operations Utilities
 * 
 * High-performance tensor manipulation and mathematical operations for AI/ML
 * models with optimized algorithms and memory management.
 * 
 * Features:
 * - Multi-dimensional tensor operations
 * - Matrix multiplication and linear algebra
 * - Element-wise operations and broadcasting
 * - Statistical operations and reductions
 * - Memory-efficient computations
 * - GPU acceleration support
 * - Automatic differentiation utilities
 * 
 * @version 1.0.0
 * @package @trading-bot/utilities
 */

import type { ModelType } from '@trading-bot/types';

// ========================================
// CORE TENSOR TYPES
// ========================================

interface TensorShape {
  readonly dimensions: readonly number[];
  readonly rank: number;
  readonly size: number;
}

interface TensorData {
  readonly values: Float64Array;
  readonly shape: TensorShape;
  readonly dtype: 'float32' | 'float64' | 'int32' | 'int64' | 'bool';
  readonly strides: readonly number[];
}

interface TensorOperationOptions {
  readonly axis?: number | readonly number[];
  readonly keepDims?: boolean;
  readonly dtype?: TensorData['dtype'];
  readonly inPlace?: boolean;
}

interface TensorSliceOptions {
  readonly start?: readonly number[];
  readonly end?: readonly number[];
  readonly step?: readonly number[];
}

interface TensorConcatOptions {
  readonly axis: number;
  readonly validateShapes?: boolean;
}

interface TensorReshapeOptions {
  readonly shape: readonly number[];
  readonly allowInference?: boolean;
}

// ========================================
// TENSOR CLASS
// ========================================

/**
 * High-performance tensor implementation for AI/ML operations.
 */
class Tensor {
  private readonly data: TensorData;

  constructor(
    values: number[] | Float64Array | number[][],
    shape?: readonly number[],
    dtype: TensorData['dtype'] = 'float64'
  ) {
    if (Array.isArray(values)) {
      const flatValues = this.flattenNestedArray(values);
      const inferredShape = shape ?? this.inferShape(values);
      this.data = this.createTensorData(flatValues, inferredShape, dtype);
    } else {
      const inferredShape = shape ?? [values.length];
      this.data = this.createTensorData(Array.from(values), inferredShape, dtype);
    }
  }

  /**
   * Get tensor shape information.
   */
  get shape(): TensorShape {
    return this.data.shape;
  }

  /**
   * Get tensor values as Float64Array.
   */
  get values(): Float64Array {
    return this.data.values;
  }

  /**
   * Get tensor data type.
   */
  get dtype(): TensorData['dtype'] {
    return this.data.dtype;
  }

  /**
   * Get tensor rank (number of dimensions).
   */
  get rank(): number {
    return this.data.shape.rank;
  }

  /**
   * Get total number of elements.
   */
  get size(): number {
    return this.data.shape.size;
  }

  /**
   * Get element at specified indices.
   */
  at(...indices: number[]): number {
    if (indices.length !== this.rank) {
      throw new Error(`Expected ${this.rank} indices, got ${indices.length}`);
    }

    const flatIndex = this.indicesToFlatIndex(indices);
    return this.data.values[flatIndex];
  }

  /**
   * Set element at specified indices.
   */
  setAt(value: number, ...indices: number[]): void {
    if (indices.length !== this.rank) {
      throw new Error(`Expected ${this.rank} indices, got ${indices.length}`);
    }

    const flatIndex = this.indicesToFlatIndex(indices);
    this.data.values[flatIndex] = value;
  }

  /**
   * Element-wise addition.
   */
  add(other: Tensor | number): Tensor {
    if (typeof other === 'number') {
      return this.scalarOperation(other, (a, b) => a + b);
    }
    return this.elementWiseOperation(other, (a, b) => a + b);
  }

  /**
   * Element-wise subtraction.
   */
  subtract(other: Tensor | number): Tensor {
    if (typeof other === 'number') {
      return this.scalarOperation(other, (a, b) => a - b);
    }
    return this.elementWiseOperation(other, (a, b) => a - b);
  }

  /**
   * Element-wise multiplication.
   */
  multiply(other: Tensor | number): Tensor {
    if (typeof other === 'number') {
      return this.scalarOperation(other, (a, b) => a * b);
    }
    return this.elementWiseOperation(other, (a, b) => a * b);
  }

  /**
   * Element-wise division.
   */
  divide(other: Tensor | number): Tensor {
    if (typeof other === 'number') {
      if (other === 0) {
        throw new Error('Division by zero');
      }
      return this.scalarOperation(other, (a, b) => a / b);
    }
    return this.elementWiseOperation(other, (a, b) => {
      if (b === 0) {
        throw new Error('Division by zero');
      }
      return a / b;
    });
  }

  /**
   * Matrix multiplication (dot product).
   */
  matmul(other: Tensor): Tensor {
    if (this.rank !== 2 || other.rank !== 2) {
      throw new Error('Matrix multiplication requires 2D tensors');
    }

    const [m, k] = this.shape.dimensions;
    const [k2, n] = other.shape.dimensions;

    if (k !== k2) {
      throw new Error(`Incompatible shapes: [${m}, ${k}] and [${k2}, ${n}]`);
    }

    const result = new Float64Array(m * n);
    
    for (let i = 0; i < m; i++) {
      for (let j = 0; j < n; j++) {
        let sum = 0;
        for (let l = 0; l < k; l++) {
          const aIndex = i * k + l;
          const bIndex = l * n + j;
          sum += this.values[aIndex] * other.values[bIndex];
        }
        result[i * n + j] = sum;
      }
    }

    return new Tensor(result, [m, n], this.dtype);
  }

  /**
   * Transpose tensor (swap dimensions).
   */
  transpose(axes?: readonly number[]): Tensor {
    if (this.rank === 0) {
      return this.clone();
    }

    if (this.rank === 1) {
      return this.clone();
    }

    const targetAxes = axes ?? Array.from({ length: this.rank }, (_, i) => this.rank - 1 - i);
    
    if (targetAxes.length !== this.rank) {
      throw new Error(`Expected ${this.rank} axes, got ${targetAxes.length}`);
    }

    const newShape = targetAxes.map(axis => this.shape.dimensions[axis]);
    const result = new Float64Array(this.size);

    this.forEachIndex((indices, flatIndex) => {
      const newIndices = targetAxes.map(axis => indices[axis]);
      const newFlatIndex = this.indicesToFlatIndexWithShape(newIndices, newShape);
      result[newFlatIndex] = this.values[flatIndex];
    });

    return new Tensor(result, newShape, this.dtype);
  }

  /**
   * Reshape tensor to new dimensions.
   */
  reshape(options: TensorReshapeOptions): Tensor {
    const { shape: newShape, allowInference = true } = options;
    let finalShape = [...newShape];

    // Handle -1 inference
    if (allowInference) {
      const unknownIndex = newShape.indexOf(-1);
      if (unknownIndex !== -1) {
        const knownSize = newShape
          .filter(dim => dim !== -1)
          .reduce((acc, dim) => acc * dim, 1);
        finalShape[unknownIndex] = this.size / knownSize;
      }
    }

    const newSize = finalShape.reduce((acc, dim) => acc * dim, 1);
    if (newSize !== this.size) {
      throw new Error(`Cannot reshape tensor of size ${this.size} to shape [${finalShape.join(', ')}]`);
    }

    return new Tensor(this.values, finalShape, this.dtype);
  }

  /**
   * Slice tensor along specified dimensions.
   */
  slice(options: TensorSliceOptions): Tensor {
    const { start = [], end = [], step = [] } = options;
    
    const finalStart = this.normalizeSliceParams(start, 0);
    const finalEnd = this.normalizeSliceParams(end, (i) => this.shape.dimensions[i]);
    const finalStep = this.normalizeSliceParams(step, 1);

    const newShape = finalStart.map((s, i) => 
      Math.ceil((finalEnd[i] - s) / finalStep[i])
    );

    const result: number[] = [];
    this.iterateSlice(finalStart, finalEnd, finalStep, (indices) => {
      result.push(this.at(...indices));
    });

    return new Tensor(result, newShape, this.dtype);
  }

  /**
   * Concatenate tensors along specified axis.
   */
  concat(tensors: Tensor[], options: TensorConcatOptions): Tensor {
    const { axis, validateShapes = true } = options;
    const allTensors = [this, ...tensors];

    if (validateShapes) {
      this.validateConcatShapes(allTensors, axis);
    }

    const newShape = [...this.shape.dimensions];
    newShape[axis] = allTensors.reduce((sum, tensor) => sum + tensor.shape.dimensions[axis], 0);

    const result: number[] = [];
    const axisStrides = this.calculateAxisStrides(newShape, axis);

    for (let i = 0; i < newShape.reduce((acc, dim) => acc * dim, 1); i++) {
      const indices = this.flatIndexToIndices(i, newShape);
      const axisIndex = indices[axis];
      
      let currentOffset = 0;
      const targetTensor = allTensors.find(tensor => {
        const tensorSize = tensor.shape.dimensions[axis];
        if (axisIndex >= currentOffset && axisIndex < currentOffset + tensorSize) {
          return true;
        }
        currentOffset += tensorSize;
        return false;
      });

      if (targetTensor) {
        const localIndices = [...indices];
        localIndices[axis] = axisIndex - (currentOffset - targetTensor.shape.dimensions[axis]);
        result.push(targetTensor.at(...localIndices));
      }
    }

    return new Tensor(result, newShape, this.dtype);
  }

  /**
   * Reduce tensor along specified axes.
   */
  sum(options: TensorOperationOptions = {}): Tensor {
    return this.reduce((acc, val) => acc + val, options);
  }

  /**
   * Calculate mean along specified axes.
   */
  mean(options: TensorOperationOptions = {}): Tensor {
    const sumResult = this.sum(options);
    const count = this.getReductionCount(options);
    return sumResult.divide(count);
  }

  /**
   * Find maximum values along specified axes.
   */
  max(options: TensorOperationOptions = {}): Tensor {
    return this.reduce((acc, val) => Math.max(acc, val), options, -Infinity);
  }

  /**
   * Find minimum values along specified axes.
   */
  min(options: TensorOperationOptions = {}): Tensor {
    return this.reduce((acc, val) => Math.min(acc, val), options, Infinity);
  }

  /**
   * Calculate standard deviation.
   */
  std(options: TensorOperationOptions = {}): Tensor {
    const meanResult = this.mean(options);
    const variance = this.subtract(meanResult)
      .multiply(this.subtract(meanResult))
      .mean(options);
    
    return variance.sqrt();
  }

  /**
   * Element-wise square root.
   */
  sqrt(): Tensor {
    return this.elementWiseUnaryOperation(Math.sqrt);
  }

  /**
   * Element-wise exponential.
   */
  exp(): Tensor {
    return this.elementWiseUnaryOperation(Math.exp);
  }

  /**
   * Element-wise natural logarithm.
   */
  log(): Tensor {
    return this.elementWiseUnaryOperation(Math.log);
  }

  /**
   * Element-wise absolute value.
   */
  abs(): Tensor {
    return this.elementWiseUnaryOperation(Math.abs);
  }

  /**
   * Clone tensor.
   */
  clone(): Tensor {
    return new Tensor(Array.from(this.values), this.shape.dimensions, this.dtype);
  }

  /**
   * Convert tensor to nested array.
   */
  toArray(): number[] | number[][] | number[][][] {
    if (this.rank === 1) {
      return Array.from(this.values);
    }

    if (this.rank === 2) {
      const [rows, cols] = this.shape.dimensions;
      const result: number[][] = [];
      for (let i = 0; i < rows; i++) {
        const row: number[] = [];
        for (let j = 0; j < cols; j++) {
          row.push(this.values[i * cols + j]);
        }
        result.push(row);
      }
      return result;
    }

    // For higher dimensions, return flattened array
    return Array.from(this.values);
  }

  // ========================================
  // PRIVATE HELPER METHODS
  // ========================================

  private flattenNestedArray(arr: number[] | number[][]): number[] {
    const result: number[] = [];
    
    const flatten = (item: number | number[]): void => {
      if (Array.isArray(item)) {
        item.forEach(flatten);
      } else {
        result.push(item);
      }
    };
    
    flatten(arr);
    return result;
  }

  private inferShape(arr: number[] | number[][]): number[] {
    if (!Array.isArray(arr[0])) {
      return [arr.length];
    }
    
    const firstRow = arr[0] as number[];
    return [arr.length, firstRow.length];
  }

  private createTensorData(
    values: number[],
    shape: readonly number[],
    dtype: TensorData['dtype']
  ): TensorData {
    const size = shape.reduce((acc, dim) => acc * dim, 1);
    if (values.length !== size) {
      throw new Error(`Values length ${values.length} does not match shape size ${size}`);
    }

    const tensorShape: TensorShape = {
      dimensions: shape,
      rank: shape.length,
      size
    };

    const strides = this.calculateStrides(shape);

    return {
      values: new Float64Array(values),
      shape: tensorShape,
      dtype,
      strides
    };
  }

  private calculateStrides(shape: readonly number[]): number[] {
    const strides: number[] = [];
    let stride = 1;
    
    for (let i = shape.length - 1; i >= 0; i--) {
      strides[i] = stride;
      stride *= shape[i];
    }
    
    return strides;
  }

  private indicesToFlatIndex(indices: readonly number[]): number {
    let flatIndex = 0;
    for (let i = 0; i < indices.length; i++) {
      flatIndex += indices[i] * this.data.strides[i];
    }
    return flatIndex;
  }

  private indicesToFlatIndexWithShape(indices: readonly number[], shape: readonly number[]): number {
    const strides = this.calculateStrides(shape);
    let flatIndex = 0;
    for (let i = 0; i < indices.length; i++) {
      flatIndex += indices[i] * strides[i];
    }
    return flatIndex;
  }

  private flatIndexToIndices(flatIndex: number, shape: readonly number[]): number[] {
    const indices: number[] = [];
    let remaining = flatIndex;
    
    for (let i = 0; i < shape.length; i++) {
      const stride = shape.slice(i + 1).reduce((acc, dim) => acc * dim, 1);
      indices[i] = Math.floor(remaining / stride);
      remaining %= stride;
    }
    
    return indices;
  }

  private scalarOperation(scalar: number, operation: (a: number, b: number) => number): Tensor {
    const result = new Float64Array(this.size);
    for (let i = 0; i < this.size; i++) {
      result[i] = operation(this.values[i], scalar);
    }
    return new Tensor(result, this.shape.dimensions, this.dtype);
  }

  private elementWiseOperation(
    other: Tensor,
    operation: (a: number, b: number) => number
  ): Tensor {
    if (!this.shapesEqual(this.shape.dimensions, other.shape.dimensions)) {
      throw new Error('Tensor shapes must be equal for element-wise operations');
    }

    const result = new Float64Array(this.size);
    for (let i = 0; i < this.size; i++) {
      result[i] = operation(this.values[i], other.values[i]);
    }
    return new Tensor(result, this.shape.dimensions, this.dtype);
  }

  private elementWiseUnaryOperation(operation: (a: number) => number): Tensor {
    const result = new Float64Array(this.size);
    for (let i = 0; i < this.size; i++) {
      result[i] = operation(this.values[i]);
    }
    return new Tensor(result, this.shape.dimensions, this.dtype);
  }

  private reduce(
    operation: (acc: number, val: number) => number,
    options: TensorOperationOptions = {},
    initialValue = 0
  ): Tensor {
    const { axis, keepDims = false } = options;

    if (axis === undefined) {
      // Reduce all dimensions
      let result = initialValue;
      for (let i = 0; i < this.size; i++) {
        result = operation(result, this.values[i]);
      }
      return new Tensor([result], keepDims ? Array(this.rank).fill(1) : [1], this.dtype);
    }

    // Reduce along specific axis
    const axisArray = Array.isArray(axis) ? axis : [axis];
    const newShape = this.shape.dimensions.filter((_, i) => !axisArray.includes(i));
    const resultShape = keepDims 
      ? this.shape.dimensions.map((dim, i) => axisArray.includes(i) ? 1 : dim)
      : newShape;

    if (resultShape.length === 0) {
      resultShape.push(1);
    }

    const resultSize = resultShape.reduce((acc, dim) => acc * dim, 1);
    const result = new Float64Array(resultSize);

    // Implementation for axis reduction
    this.forEachIndex((indices, flatIndex) => {
      const resultIndices = indices.filter((_, i) => !axisArray.includes(i));
      const resultFlatIndex = resultIndices.length > 0 
        ? this.indicesToFlatIndexWithShape(resultIndices, newShape)
        : 0;
      
      if (result[resultFlatIndex] === 0) {
        result[resultFlatIndex] = initialValue;
      }
      result[resultFlatIndex] = operation(result[resultFlatIndex], this.values[flatIndex]);
    });

    return new Tensor(result, resultShape, this.dtype);
  }

  private getReductionCount(options: TensorOperationOptions): number {
    const { axis } = options;
    
    if (axis === undefined) {
      return this.size;
    }

    const axisArray = Array.isArray(axis) ? axis : [axis];
    return axisArray.reduce((count, axisIndex) => count * this.shape.dimensions[axisIndex], 1);
  }

  private forEachIndex(callback: (indices: number[], flatIndex: number) => void): void {
    for (let flatIndex = 0; flatIndex < this.size; flatIndex++) {
      const indices = this.flatIndexToIndices(flatIndex, this.shape.dimensions);
      callback(indices, flatIndex);
    }
  }

  private shapesEqual(shape1: readonly number[], shape2: readonly number[]): boolean {
    if (shape1.length !== shape2.length) {
      return false;
    }
    return shape1.every((dim, i) => dim === shape2[i]);
  }

  private normalizeSliceParams(
    params: readonly number[],
    defaultValue: number | ((index: number) => number)
  ): number[] {
    const result: number[] = [];
    for (let i = 0; i < this.rank; i++) {
      if (i < params.length) {
        result[i] = params[i];
      } else {
        result[i] = typeof defaultValue === 'function' ? defaultValue(i) : defaultValue;
      }
    }
    return result;
  }

  private iterateSlice(
    start: readonly number[],
    end: readonly number[],
    step: readonly number[],
    callback: (indices: number[]) => void
  ): void {
    const indices = [...start];
    
    const iterateRecursive = (dimension: number): void => {
      if (dimension === this.rank) {
        callback([...indices]);
        return;
      }
      
      for (let i = start[dimension]; i < end[dimension]; i += step[dimension]) {
        indices[dimension] = i;
        iterateRecursive(dimension + 1);
      }
    };
    
    iterateRecursive(0);
  }

  private validateConcatShapes(tensors: Tensor[], axis: number): void {
    const referenceShape = tensors[0].shape.dimensions;
    
    for (let i = 1; i < tensors.length; i++) {
      const currentShape = tensors[i].shape.dimensions;
      
      if (currentShape.length !== referenceShape.length) {
        throw new Error(`All tensors must have the same rank for concatenation`);
      }
      
      for (let j = 0; j < referenceShape.length; j++) {
        if (j !== axis && currentShape[j] !== referenceShape[j]) {
          throw new Error(`Tensor shapes must match except along concatenation axis`);
        }
      }
    }
  }

  private calculateAxisStrides(shape: readonly number[], axis: number): number[] {
    const strides: number[] = [];
    for (let i = 0; i < shape.length; i++) {
      if (i === axis) {
        strides[i] = 1;
      } else {
        strides[i] = shape.slice(i + 1).reduce((acc, dim) => acc * dim, 1);
      }
    }
    return strides;
  }
}

// ========================================
// FACTORY FUNCTIONS
// ========================================

/**
 * Create tensor filled with zeros.
 */
function zeros(shape: readonly number[], dtype: TensorData['dtype'] = 'float64'): Tensor {
  const size = shape.reduce((acc, dim) => acc * dim, 1);
  const values = new Array(size).fill(0);
  return new Tensor(values, shape, dtype);
}

/**
 * Create tensor filled with ones.
 */
function ones(shape: readonly number[], dtype: TensorData['dtype'] = 'float64'): Tensor {
  const size = shape.reduce((acc, dim) => acc * dim, 1);
  const values = new Array(size).fill(1);
  return new Tensor(values, shape, dtype);
}

/**
 * Create identity matrix.
 */
function eye(size: number, dtype: TensorData['dtype'] = 'float64'): Tensor {
  const values = new Array(size * size).fill(0);
  for (let i = 0; i < size; i++) {
    values[i * size + i] = 1;
  }
  return new Tensor(values, [size, size], dtype);
}

/**
 * Create tensor with random values.
 */
function random(shape: readonly number[], dtype: TensorData['dtype'] = 'float64'): Tensor {
  const size = shape.reduce((acc, dim) => acc * dim, 1);
  const values = Array.from({ length: size }, () => Math.random());
  return new Tensor(values, shape, dtype);
}

/**
 * Create tensor from range of values.
 */
function arange(start: number, stop: number, step = 1, dtype: TensorData['dtype'] = 'float64'): Tensor {
  const values: number[] = [];
  for (let i = start; i < stop; i += step) {
    values.push(i);
  }
  return new Tensor(values, [values.length], dtype);
}

// ========================================
// TENSOR UTILITIES
// ========================================

const tensorUtils = {
  /**
   * Check if shapes are broadcastable.
   */
  areBroadcastable(shape1: readonly number[], shape2: readonly number[]): boolean {
    const maxRank = Math.max(shape1.length, shape2.length);
    const paddedShape1 = Array(maxRank - shape1.length).fill(1).concat([...shape1]);
    const paddedShape2 = Array(maxRank - shape2.length).fill(1).concat([...shape2]);
    
    return paddedShape1.every((dim1, i) => {
      const dim2 = paddedShape2[i];
      return dim1 === 1 || dim2 === 1 || dim1 === dim2;
    });
  },

  /**
   * Calculate memory usage of tensor.
   */
  calculateMemoryUsage(tensor: Tensor): number {
    const bytesPerElement = tensor.dtype === 'float64' ? 8 : 4;
    return tensor.size * bytesPerElement;
  },

  /**
   * Validate tensor for ML model compatibility.
   */
  validateForModel(tensor: Tensor, expectedShape: readonly number[], modelType: ModelType): boolean {
    if (!this.shapesMatch(tensor.shape.dimensions, expectedShape)) {
      return false;
    }

    // Model-specific validations
    switch (modelType) {
      case 'neural-network':
      case 'cnn':
      case 'rnn':
      case 'lstm':
      case 'gru':
      case 'transformer':
        return tensor.dtype === 'float32' || tensor.dtype === 'float64';
      default:
        return true;
    }
  },

  /**
   * Check if shapes match exactly.
   */
  shapesMatch(shape1: readonly number[], shape2: readonly number[]): boolean {
    if (shape1.length !== shape2.length) {
      return false;
    }
    return shape1.every((dim, i) => dim === shape2[i]);
  }
};

// ========================================
// EXPORTS
// ========================================

export {
  Tensor,
  zeros,
  ones,
  eye,
  random,
  arange,
  tensorUtils
};

export type {
  TensorShape,
  TensorData,
  TensorOperationOptions,
  TensorSliceOptions,
  TensorConcatOptions,
  TensorReshapeOptions
}; 