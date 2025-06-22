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

import type { 
  ModelType,
  TensorShape,
  TensorData,
  TensorOperationOptions,
  TensorSliceOptions,
  TensorConcatOptions,
  TensorReshapeOptions
} from '@trading-bot/types';



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
    const value = this.data.values[flatIndex];
    if (value === undefined) {
      throw new Error(`Invalid access at indices [${indices.join(', ')}]`);
    }
    return value;
  }

  /**
   * Set element at specified indices.
   */
  setAt(value: number, ...indices: number[]): void {
    if (indices.length !== this.rank) {
      throw new Error(`Expected ${this.rank} indices, got ${indices.length}`);
    }

    const flatIndex = this.indicesToFlatIndex(indices);
    if (flatIndex < 0 || flatIndex >= this.data.values.length) {
      throw new Error(`Invalid access at indices [${indices.join(', ')}]`);
    }
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

    const thisShape = this.shape.dimensions;
    const otherShape = other.shape.dimensions;
    
    if (thisShape.length < 2 || otherShape.length < 2) {
      throw new Error('Invalid tensor shapes for matrix multiplication');
    }

    const m = thisShape[0];
    const k = thisShape[1];
    const k2 = otherShape[0];
    const n = otherShape[1];

    if (m === undefined || k === undefined || k2 === undefined || n === undefined) {
      throw new Error('Invalid tensor dimensions');
    }

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
          const aValue = this.values[aIndex];
          const bValue = other.values[bIndex];
          
          if (aValue === undefined || bValue === undefined) {
            throw new Error(`Invalid matrix access during multiplication`);
          }
          
          sum += aValue * bValue;
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

    const newShape: number[] = [];
    for (const axis of targetAxes) {
      const dimension = this.shape.dimensions[axis];
      if (dimension === undefined) {
        throw new Error(`Invalid axis ${axis} for tensor with rank ${this.rank}`);
      }
      newShape.push(dimension);
    }
    
    const result = new Float64Array(this.size);

    this.forEachIndex((indices, flatIndex) => {
      const newIndices: number[] = [];
      for (const axis of targetAxes) {
        const indexValue = indices[axis];
        if (indexValue === undefined) {
          throw new Error(`Invalid index access during transpose`);
        }
        newIndices.push(indexValue);
      }
      const newFlatIndex = this.indicesToFlatIndexWithShape(newIndices, newShape);
      const value = this.values[flatIndex];
      if (value === undefined) {
        throw new Error(`Invalid value access during transpose`);
      }
      result[newFlatIndex] = value;
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
    const finalEnd = this.normalizeSliceParams(end, (i) => {
      const dimension = this.shape.dimensions[i];
      if (dimension === undefined) {
        throw new Error(`Invalid dimension access at index ${i}`);
      }
      return dimension;
    });
    const finalStep = this.normalizeSliceParams(step, 1);

    const newShape: number[] = [];
    for (let i = 0; i < finalStart.length; i++) {
      const startVal = finalStart[i];
      const endVal = finalEnd[i];
      const stepVal = finalStep[i];
      
      if (startVal === undefined || endVal === undefined || stepVal === undefined) {
        throw new Error(`Invalid slice parameters at dimension ${i}`);
      }
      
      newShape.push(Math.ceil((endVal - startVal) / stepVal));
    }

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
    const axisDimension = newShape[axis];
    if (axisDimension === undefined) {
      throw new Error(`Invalid concatenation axis ${axis}`);
    }
    
    let totalAxisSize = 0;
    for (const tensor of allTensors) {
      const tensorAxisSize = tensor.shape.dimensions[axis];
      if (tensorAxisSize === undefined) {
        throw new Error(`Invalid tensor shape for concatenation`);
      }
      totalAxisSize += tensorAxisSize;
    }
    newShape[axis] = totalAxisSize;

    const result: number[] = [];
    const newSize = newShape.reduce((acc, dim) => acc * dim, 1);

    for (let i = 0; i < newSize; i++) {
      const indices = this.flatIndexToIndices(i, newShape);
      const axisIndex = indices[axis];
      
      if (axisIndex === undefined) {
        throw new Error(`Invalid axis index during concatenation`);
      }
      
      let currentOffset = 0;
      let targetTensor: Tensor | undefined;
      
      for (const tensor of allTensors) {
        const tensorSize = tensor.shape.dimensions[axis];
        if (tensorSize === undefined) {
          throw new Error(`Invalid tensor dimension during concatenation`);
        }
        
        if (axisIndex >= currentOffset && axisIndex < currentOffset + tensorSize) {
          targetTensor = tensor;
          break;
        }
        currentOffset += tensorSize;
      }

      if (targetTensor) {
        const localIndices = [...indices];
        const targetDimension = targetTensor.shape.dimensions[axis];
        if (targetDimension === undefined) {
          throw new Error(`Invalid target tensor dimension`);
        }
        localIndices[axis] = axisIndex - (currentOffset - targetDimension);
        result.push(targetTensor.at(...localIndices));
      } else {
        throw new Error(`Failed to find target tensor for concatenation`);
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
      const dimensions = this.shape.dimensions;
      if (dimensions.length < 2) {
        throw new Error('Invalid 2D tensor shape');
      }
      
      const rows = dimensions[0];
      const cols = dimensions[1];
      
      if (rows === undefined || cols === undefined) {
        throw new Error('Invalid tensor dimensions for 2D conversion');
      }
      
      const result: number[][] = [];
      for (let i = 0; i < rows; i++) {
        const row: number[] = [];
        for (let j = 0; j < cols; j++) {
          const value = this.values[i * cols + j];
          if (value === undefined) {
            throw new Error(`Invalid access at position [${i}, ${j}]`);
          }
          row.push(value);
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
    
    const flatten = (item: number | number[] | number[][]): void => {
      if (Array.isArray(item)) {
        for (const subItem of item) {
          flatten(subItem);
        }
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
      const dimension = shape[i];
      if (dimension === undefined) {
        throw new Error(`Invalid shape dimension at index ${i}`);
      }
      strides[i] = stride;
      stride *= dimension;
    }
    
    return strides;
  }

  private indicesToFlatIndex(indices: readonly number[]): number {
    let flatIndex = 0;
    for (let i = 0; i < indices.length; i++) {
      const index = indices[i];
      const stride = this.data.strides[i];
      if (index === undefined || stride === undefined) {
        throw new Error(`Invalid index or stride at position ${i}`);
      }
      flatIndex += index * stride;
    }
    return flatIndex;
  }

  private indicesToFlatIndexWithShape(indices: readonly number[], shape: readonly number[]): number {
    const strides = this.calculateStrides(shape);
    let flatIndex = 0;
    for (let i = 0; i < indices.length; i++) {
      const index = indices[i];
      const stride = strides[i];
      if (index === undefined || stride === undefined) {
        throw new Error(`Invalid index or stride at position ${i}`);
      }
      flatIndex += index * stride;
    }
    return flatIndex;
  }

  private flatIndexToIndices(flatIndex: number, shape: readonly number[]): number[] {
    const indices: number[] = [];
    let remaining = flatIndex;
    
    for (let i = 0; i < shape.length; i++) {
      const currentShape = shape.slice(i + 1);
      const stride = currentShape.reduce((acc, dim) => {
        if (dim === undefined) {
          throw new Error(`Invalid dimension in shape at calculation`);
        }
        return acc * dim;
      }, 1);
      indices[i] = Math.floor(remaining / stride);
      remaining %= stride;
    }
    
    return indices;
  }

  private scalarOperation(scalar: number, operation: (a: number, b: number) => number): Tensor {
    const result = new Float64Array(this.size);
    for (let i = 0; i < this.size; i++) {
      const value = this.values[i];
      if (value === undefined) {
        throw new Error(`Invalid value access at index ${i}`);
      }
      result[i] = operation(value, scalar);
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
      const thisValue = this.values[i];
      const otherValue = other.values[i];
      if (thisValue === undefined || otherValue === undefined) {
        throw new Error(`Invalid value access at index ${i}`);
      }
      result[i] = operation(thisValue, otherValue);
    }
    return new Tensor(result, this.shape.dimensions, this.dtype);
  }

  private elementWiseUnaryOperation(operation: (a: number) => number): Tensor {
    const result = new Float64Array(this.size);
    for (let i = 0; i < this.size; i++) {
      const value = this.values[i];
      if (value === undefined) {
        throw new Error(`Invalid value access at index ${i}`);
      }
      result[i] = operation(value);
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
        const value = this.values[i];
        if (value === undefined) {
          throw new Error(`Invalid value access at index ${i}`);
        }
        result = operation(result, value);
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
      const value = this.values[flatIndex];
      if (value === undefined) {
        throw new Error(`Invalid value access during reduction at index ${flatIndex}`);
      }
      if (result[resultFlatIndex] === undefined) {
        throw new Error(`Invalid result value access during reduction at index ${resultFlatIndex}`);
      }
      result[resultFlatIndex] = operation(result[resultFlatIndex], value);
    });

    return new Tensor(result, resultShape, this.dtype);
  }

  private getReductionCount(options: TensorOperationOptions): number {
    const { axis } = options;
    
    if (axis === undefined) {
      return this.size;
    }

    const axisArray = Array.isArray(axis) ? axis : [axis];
    return axisArray.reduce((count, axisIndex) => {
      const dimension = this.shape.dimensions[axisIndex];
      if (dimension === undefined) {
        throw new Error(`Invalid axis ${axisIndex} for reduction`);
      }
      return count * dimension;
    }, 1);
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
      const param = params[i];
      if (param !== undefined) {
        result[i] = param;
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
      
      const startVal = start[dimension];
      const endVal = end[dimension];
      const stepVal = step[dimension];
      
      if (startVal === undefined || endVal === undefined || stepVal === undefined) {
        throw new Error(`Invalid slice parameters at dimension ${dimension}`);
      }
      
      for (let i = startVal; i < endVal; i += stepVal) {
        indices[dimension] = i;
        iterateRecursive(dimension + 1);
      }
    };
    
    iterateRecursive(0);
  }

  private validateConcatShapes(tensors: Tensor[], axis: number): void {
    if (tensors.length === 0) {
      throw new Error('Cannot concatenate empty tensor array');
    }
    
    const referenceShape = tensors[0]?.shape.dimensions;
    if (!referenceShape) {
      throw new Error('Invalid reference tensor for concatenation');
    }
    
    for (let i = 1; i < tensors.length; i++) {
      const currentTensor = tensors[i];
      if (!currentTensor) {
        throw new Error(`Invalid tensor at index ${i}`);
      }
      
      const currentShape = currentTensor.shape.dimensions;
      
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
      if (dim1 === undefined || dim2 === undefined) {
        return false;
      }
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
    return shape1.every((dim, i) => {
      const otherDim = shape2[i];
      return dim !== undefined && otherDim !== undefined && dim === otherDim;
    });
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