// context/ThemeContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import colorThemes from '../constants/colors.json';

// ============================================================
// TYPES
// ============================================================
type ThemeMode = 'light' | 'dark' | 'system';

// Dynamic theme type based on JSON structure
type ColorTheme = typeof colorThemes.light;

type ThemeContextType = {
  colors: ColorTheme;
  themeMode: ThemeMode;
  isDark: boolean;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  toggleTheme: () => Promise<void>;
};

// ============================================================
// CREATE CONTEXT
// ============================================================
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// ============================================================
// THEME PROVIDER COMPONENT
// ============================================================
export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const deviceColorScheme = useColorScheme(); // Get device theme ('light' | 'dark')
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const [isLoading, setIsLoading] = useState(true);

  // ============================================================
  // DETERMINE CURRENT THEME
  // If mode is 'system', use device theme, otherwise use selected mode
  // ============================================================
  const isDark = themeMode === 'system' 
    ? deviceColorScheme === 'dark' 
    : themeMode === 'dark';

  const colors = isDark ? colorThemes.dark : colorThemes.light;

  // ============================================================
  // LOAD SAVED THEME PREFERENCE ON APP START
  // ============================================================
  useEffect(() => {
    loadThemePreference();
  }, []);

  const loadThemePreference = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem('theme_preference');
      if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system')) {
        setThemeModeState(savedTheme as ThemeMode);
      }
    } catch (error) {
      console.error('Error loading theme preference:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================================
  // SET THEME MODE AND SAVE TO ASYNC STORAGE
  // ============================================================
  const setThemeMode = async (mode: ThemeMode) => {
    try {
      setThemeModeState(mode);
      await AsyncStorage.setItem('theme_preference', mode);
    } catch (error) {
      console.error('Error saving theme preference:', error);
    }
  };

  // ============================================================
  // TOGGLE BETWEEN LIGHT AND DARK (IGNORES SYSTEM)
  // ============================================================
  const toggleTheme = async () => {
    const newMode = isDark ? 'light' : 'dark';
    await setThemeMode(newMode);
  };

  // Don't render children until theme is loaded
  if (isLoading) {
    return null;
  }

  return (
    <ThemeContext.Provider 
      value={{ 
        colors, 
        themeMode, 
        isDark, 
        setThemeMode, 
        toggleTheme 
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

// ============================================================
// CUSTOM HOOK TO USE THEME
// ============================================================
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

// ============================================================
// EXPORT THEME TYPE FOR TYPESCRIPT 
// ============================================================
export type { ColorTheme, ThemeMode };