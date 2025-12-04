// utils/filters/contrast.ts

/**
 * Contrast Filter
 * Converts slider value (-100 to 100) to contrast factor (0 to 3)
 * -100 = no contrast / gray (factor 0)
 * 0 = original (factor 1)
 * 100 = very high contrast (factor 3)
 */

/**
 * Calculate contrast factor from slider value
 * @param value - Slider value from -100 to 100
 * @returns Contrast factor from 0 to 3
 */
export const calculateContrastFactor = (value: number): number => {
    return (value + 100) / 66.67;
  };
  
  /**
   * Apply contrast adjustment to RGBA pixel data
   * @param data - Uint8ClampedArray of RGBA pixel data
   * @param value - Contrast value from -100 to 100
   * @returns Modified pixel data
   */
  export const applyContrast = (
    data: Uint8ClampedArray,
    value: number
  ): Uint8ClampedArray => {
    const factor = calculateContrastFactor(value);
    const intercept = 128 * (1 - factor);
    const result = new Uint8ClampedArray(data.length);
  
    for (let i = 0; i < data.length; i += 4) {
      result[i] = Math.min(255, Math.max(0, data[i] * factor + intercept));
      result[i + 1] = Math.min(255, Math.max(0, data[i + 1] * factor + intercept));
      result[i + 2] = Math.min(255, Math.max(0, data[i + 2] * factor + intercept));
      result[i + 3] = data[i + 3]; // Alpha unchanged
    }
  
    return result;
  };
  
  /**
   * Apply contrast in-place (mutates original data)
   * @param data - Uint8ClampedArray of RGBA pixel data
   * @param value - Contrast value from -100 to 100
   */
  export const applyContrastInPlace = (
    data: Uint8ClampedArray,
    value: number
  ): void => {
    const factor = calculateContrastFactor(value);
    const intercept = 128 * (1 - factor);
  
    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.min(255, Math.max(0, data[i] * factor + intercept));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] * factor + intercept));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] * factor + intercept));
    }
  };
  
  /**
   * Get CSS filter string for contrast
   * @param value - Contrast value from -100 to 100
   * @returns CSS contrast filter string
   */
  export const getContrastCSSFilter = (value: number): string => {
    const factor = calculateContrastFactor(value);
    return `contrast(${factor})`;
  };