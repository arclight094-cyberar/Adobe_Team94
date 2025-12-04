// utils/filters/brightness.ts

/**
 * Brightness Filter
 * Converts slider value (-50 to 50) to brightness factor (0 to 2)
 * -50 = completely dark (factor 0)
 * 0 = original (factor 1)
 * 50 = double brightness (factor 2)
 */

/**
 * Calculate brightness factor from slider value
 * @param value - Slider value from -50 to 50
 * @returns Brightness factor from 0 to 2
 */
export const calculateBrightnessFactor = (value: number): number => {
    return (value + 50) / 50;
  };
  
  /**
   * Apply brightness adjustment to RGBA pixel data
   * @param data - Uint8ClampedArray of RGBA pixel data
   * @param value - Brightness value from -50 to 50
   * @returns Modified pixel data
   */
  export const applyBrightness = (
    data: Uint8ClampedArray,
    value: number
  ): Uint8ClampedArray => {
    const factor = calculateBrightnessFactor(value);
    const result = new Uint8ClampedArray(data.length);
  
    for (let i = 0; i < data.length; i += 4) {
      result[i] = Math.min(255, Math.max(0, data[i] * factor));         // Red
      result[i + 1] = Math.min(255, Math.max(0, data[i + 1] * factor)); // Green
      result[i + 2] = Math.min(255, Math.max(0, data[i + 2] * factor)); // Blue
      result[i + 3] = data[i + 3];                                       // Alpha (unchanged)
    }
  
    return result;
  };
  
  /**
   * Apply brightness in-place (mutates original data)
   * @param data - Uint8ClampedArray of RGBA pixel data
   * @param value - Brightness value from -50 to 50
   */
  export const applyBrightnessInPlace = (
    data: Uint8ClampedArray,
    value: number
  ): void => {
    const factor = calculateBrightnessFactor(value);
  
    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.min(255, Math.max(0, data[i] * factor));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] * factor));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] * factor));
      // Alpha unchanged
    }
  };
  
  /**
   * Get CSS filter string for brightness
   * @param value - Brightness value from -50 to 50
   * @returns CSS brightness filter string
   */
  export const getBrightnessCSSFilter = (value: number): string => {
    const factor = calculateBrightnessFactor(value);
    return `brightness(${factor})`;
  };