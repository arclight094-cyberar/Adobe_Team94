// utils/filters.ts

export interface FilterValues {
  brightness: number;
  contrast: number;
  saturation: number;
  warmth: number;        // Legacy name for temperature/white balance
  shadows: number;       // Legacy name for black lift
  highlights: number;
  sharpen: number;
  temperature: number;   // White balance (-50 to 50)
  noise: number;         // Grain/noise (0 to 50)
  blackLift: number;     // Black point lift (-50 to 50)
}

export const defaultFilterValues: FilterValues = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  warmth: 0,
  shadows: 0,
  highlights: 0,
  sharpen: 0,
  temperature: 0,
  noise: 0,
  blackLift: 0,
};

/**
 * Convert slider value (-50 to 50) to brightness factor (0 to 2)
 */
export const calculateBrightnessFactor = (value: number): number => {
  return (value + 50) / 50;
};

/**
 * Convert slider value (-100 to 100) to contrast factor (0 to 3)
 */
export const calculateContrastFactor = (value: number): number => {
  return (value + 100) / 66.67;
};

/**
 * Convert slider value (-50 to 50) to saturation factor (0 to 2)
 */
export const calculateSaturationFactor = (value: number): number => {
  return (value + 50) / 50;
};