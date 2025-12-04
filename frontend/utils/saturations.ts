// utils/filters/saturation.ts

/**
 * Saturation Filter
 * Converts slider value (-50 to 50) to saturation factor (0 to 2)
 * -50 = grayscale (factor 0)
 * 0 = original (factor 1)
 * 50 = double saturation (factor 2)
 */

/**
 * Calculate saturation factor from slider value
 * @param value - Slider value from -50 to 50
 * @returns Saturation factor from 0 to 2
 */
export const calculateSaturationFactor = (value: number): number => {
    return (value + 50) / 50;
  };
  
  /**
   * Apply saturation adjustment to RGBA pixel data
   * Uses luminosity method for grayscale conversion
   * @param data - Uint8ClampedArray of RGBA pixel data
   * @param value - Saturation value from -50 to 50
   * @returns Modified pixel data
   */
  export const applySaturation = (
    data: Uint8ClampedArray,
    value: number
  ): Uint8ClampedArray => {
    const factor = calculateSaturationFactor(value);
    const result = new Uint8ClampedArray(data.length);
  
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
  
      // Calculate grayscale using luminosity method (matches human perception)
      const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  
      // Interpolate between grayscale and original color
      result[i] = Math.min(255, Math.max(0, gray + factor * (r - gray)));
      result[i + 1] = Math.min(255, Math.max(0, gray + factor * (g - gray)));
      result[i + 2] = Math.min(255, Math.max(0, gray + factor * (b - gray)));
      result[i + 3] = data[i + 3]; // Alpha unchanged
    }
  
    return result;
  };
  
  /**
   * Apply saturation in-place (mutates original data)
   * @param data - Uint8ClampedArray of RGBA pixel data
   * @param value - Saturation value from -50 to 50
   */
  export const applySaturationInPlace = (
    data: Uint8ClampedArray,
    value: number
  ): void => {
    const factor = calculateSaturationFactor(value);
  
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
  
      const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  
      data[i] = Math.min(255, Math.max(0, gray + factor * (r - gray)));
      data[i + 1] = Math.min(255, Math.max(0, gray + factor * (g - gray)));
      data[i + 2] = Math.min(255, Math.max(0, gray + factor * (b - gray)));
    }
  };
  
  /**
   * Get CSS filter string for saturation
   * @param value - Saturation value from -50 to 50
   * @returns CSS saturate filter string
   */
  export const getSaturationCSSFilter = (value: number): string => {
    const factor = calculateSaturationFactor(value);
    return `saturate(${factor})`;
  };