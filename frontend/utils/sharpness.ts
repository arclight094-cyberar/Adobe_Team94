// utils/filters/sharpen.ts

/**
 * Sharpen Filter
 * Converts slider value (-50 to 50) to sharpness factor
 * Uses quadratic scaling for more natural sharpening effect
 * -50 = blur (factor 0)
 * 0 = original (factor 1)
 * 50 = maximum sharpness (factor 4)
 */

/**
 * Calculate sharpness factor from slider value
 * Uses quadratic scale: ((value + 50) / 50)^2
 * @param value - Slider value from -50 to 50
 * @returns Sharpness factor from 0 to 4
 */
export const calculateSharpnessFactor = (value: number): number => {
    const normalized = (value + 50) / 50; // 0 to 2
    return normalized * normalized; // 0 to 4 (quadratic scale)
  };
  
  /**
   * Apply sharpening using convolution kernel
   * This is a 3x3 sharpening kernel applied to the image
   * @param data - Uint8ClampedArray of RGBA pixel data
   * @param width - Image width
   * @param height - Image height
   * @param value - Sharpen value from -50 to 50
   * @returns Modified pixel data
   */
  export const applySharpen = (
    data: Uint8ClampedArray,
    width: number,
    height: number,
    value: number
  ): Uint8ClampedArray => {
    if (value === 0) {
      return new Uint8ClampedArray(data);
    }
  
    const factor = calculateSharpnessFactor(value);
    const result = new Uint8ClampedArray(data.length);
    
    // Copy original data first
    result.set(data);
  
    // Sharpening kernel (Laplacian-based)
    // Center weight increases with factor, edges are negative
    const strength = (factor - 1) * 0.5; // Normalize strength
    
    if (strength === 0) {
      return result;
    }
  
    // Kernel weights based on strength
    // [  0, -s,  0 ]
    // [ -s, 1+4s, -s ]
    // [  0, -s,  0 ]
    const kernel = [
      0, -strength, 0,
      -strength, 1 + 4 * strength, -strength,
      0, -strength, 0,
    ];
  
    // Apply convolution (skip edge pixels)
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;
  
        for (let c = 0; c < 3; c++) { // RGB channels only
          let sum = 0;
          let kernelIdx = 0;
  
          for (let ky = -1; ky <= 1; ky++) {
            for (let kx = -1; kx <= 1; kx++) {
              const pixelIdx = ((y + ky) * width + (x + kx)) * 4 + c;
              sum += data[pixelIdx] * kernel[kernelIdx];
              kernelIdx++;
            }
          }
  
          result[idx + c] = Math.min(255, Math.max(0, Math.round(sum)));
        }
        // Alpha channel unchanged
        result[idx + 3] = data[idx + 3];
      }
    }
  
    return result;
  };
  
  /**
   * Apply sharpening in-place (mutates original data)
   * @param data - Uint8ClampedArray of RGBA pixel data
   * @param width - Image width
   * @param height - Image height
   * @param value - Sharpen value from -50 to 50
   */
  export const applySharpenInPlace = (
    data: Uint8ClampedArray,
    width: number,
    height: number,
    value: number
  ): void => {
    if (value === 0) return;
  
    const factor = calculateSharpnessFactor(value);
    const strength = (factor - 1) * 0.5;
    
    if (strength === 0) return;
  
    // Create a copy to read from
    const original = new Uint8ClampedArray(data);
  
    const kernel = [
      0, -strength, 0,
      -strength, 1 + 4 * strength, -strength,
      0, -strength, 0,
    ];
  
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;
  
        for (let c = 0; c < 3; c++) {
          let sum = 0;
          let kernelIdx = 0;
  
          for (let ky = -1; ky <= 1; ky++) {
            for (let kx = -1; kx <= 1; kx++) {
              const pixelIdx = ((y + ky) * width + (x + kx)) * 4 + c;
              sum += original[pixelIdx] * kernel[kernelIdx];
              kernelIdx++;
            }
          }
  
          data[idx + c] = Math.min(255, Math.max(0, Math.round(sum)));
        }
      }
    }
  };
  
  /**
   * Apply unsharp mask (alternative sharpening method)
   * Creates a blurred version and enhances edges by subtracting it
   * @param data - Uint8ClampedArray of RGBA pixel data
   * @param width - Image width
   * @param height - Image height
   * @param value - Sharpen value from -50 to 50
   * @returns Modified pixel data
   */
  export const applyUnsharpMask = (
    data: Uint8ClampedArray,
    width: number,
    height: number,
    value: number
  ): Uint8ClampedArray => {
    if (value === 0) {
      return new Uint8ClampedArray(data);
    }
  
    const factor = calculateSharpnessFactor(value);
    const amount = factor - 1; // How much to sharpen (0 = none, 3 = max)
    const result = new Uint8ClampedArray(data.length);
  
    // Simple 3x3 box blur kernel
    const blurKernel = [
      1/9, 1/9, 1/9,
      1/9, 1/9, 1/9,
      1/9, 1/9, 1/9,
    ];
  
    // First pass: create blurred version
    const blurred = new Uint8ClampedArray(data.length);
    blurred.set(data);
  
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;
  
        for (let c = 0; c < 3; c++) {
          let sum = 0;
          let kernelIdx = 0;
  
          for (let ky = -1; ky <= 1; ky++) {
            for (let kx = -1; kx <= 1; kx++) {
              const pixelIdx = ((y + ky) * width + (x + kx)) * 4 + c;
              sum += data[pixelIdx] * blurKernel[kernelIdx];
              kernelIdx++;
            }
          }
  
          blurred[idx + c] = Math.round(sum);
        }
        blurred[idx + 3] = data[idx + 3];
      }
    }
  
    // Second pass: unsharp mask = original + amount * (original - blurred)
    for (let i = 0; i < data.length; i += 4) {
      for (let c = 0; c < 3; c++) {
        const original = data[i + c];
        const blur = blurred[i + c];
        const sharpened = original + amount * (original - blur);
        result[i + c] = Math.min(255, Math.max(0, Math.round(sharpened)));
      }
      result[i + 3] = data[i + 3]; // Alpha unchanged
    }
  
    return result;
  };
  
  /**
   * Get CSS filter approximation for sharpness
   * Note: CSS doesn't have native sharpness filter
   * This uses contrast as a rough approximation
   * @param value - Sharpen value from -50 to 50
   * @returns CSS filter string (approximation only)
   */
  export const getSharpenCSSFilter = (value: number): string => {
    // CSS doesn't support sharpening directly
    // We can only approximate with slight contrast boost
    if (value === 0) return '';
    
    // Very subtle contrast adjustment as approximation
    const factor = 1 + (value / 200);
    return `contrast(${factor})`;
  };
  
  /**
   * Check if sharpening is supported
   * Canvas-based sharpening requires width/height
   * @returns boolean indicating if real sharpening is available
   */
  export const isRealSharpeningSupported = (): boolean => {
    // Real sharpening requires canvas or WebGL
    // In React Native, this would need gl-react or similar
    return typeof document !== 'undefined' && !!document.createElement;
  };