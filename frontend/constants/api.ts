// API Configuration
// For React Native, use your computer's local IP address instead of localhost
// Find your IP: 
//   Windows: ipconfig (look for IPv4 Address)
//   Mac/Linux: ifconfig or ip addr
//   Or use: 10.0.2.2 for Android Emulator

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Default URLs - used as fallback
const DEFAULT_DEVELOPMENT_API_URL = 'http://192.168.0.164:4000/api/v1/adobe-ps'; // Android Emulator default
const PRODUCTION_API_URL = 'https://your-domain.com/api/v1/adobe-ps';
const ANDROID_EMULATOR_API_URL = 'http://192.168.0.164:4000/api/v1/adobe-ps';
const IOS_SIMULATOR_API_URL = 'http://localhost:4000/api/v1/adobe-ps';

// Storage key for custom API URL
const API_URL_STORAGE_KEY = 'custom_api_base_url';

// Get the appropriate API URL based on platform and stored preference
const getApiUrl = async (): Promise<string> => {
  // You can set this via environment variable or hardcode for now
  // @ts-ignore - __DEV__ is a global in React Native
  const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : true;
  
  if (!isDev) {
    return PRODUCTION_API_URL;
  }

  // For web, use localhost (browser runs on same machine)
  if (Platform.OS === 'web') {
    return 'http://localhost:4000/api/v1/adobe-ps';
  }

  // Try to get custom URL from storage first
  try {
    const customUrl = await AsyncStorage.getItem(API_URL_STORAGE_KEY);
    if (customUrl) {
      console.log('Using custom API URL from storage:', customUrl);
      return customUrl;
    }
  } catch (error) {
    console.warn('Failed to read custom API URL from storage:', error);
  }

  // Fallback to platform-specific defaults
  if (Platform.OS === 'android') {
    return ANDROID_EMULATOR_API_URL;
  } else if (Platform.OS === 'ios') {
    return IOS_SIMULATOR_API_URL;
  }

  return DEFAULT_DEVELOPMENT_API_URL;
};

// Synchronous version for initial load (will be updated after async load)
let cachedApiUrl: string | null = null;

// Initialize API URL (call this on app start)
export const initializeApiUrl = async (): Promise<string> => {
  const url = await getApiUrl();
  cachedApiUrl = url;
  console.log('API URL initialized:', url);
  return url;
};

// Get cached URL (synchronous, for immediate use)
export const getCachedApiUrl = (): string => {
  if (cachedApiUrl) {
    return cachedApiUrl;
  }
  // Fallback if not initialized yet
  if (Platform.OS === 'android') {
    return ANDROID_EMULATOR_API_URL;
  } else if (Platform.OS === 'ios') {
    return IOS_SIMULATOR_API_URL;
  }
  return DEFAULT_DEVELOPMENT_API_URL;
};

// Set custom API URL
export const setCustomApiUrl = async (url: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(API_URL_STORAGE_KEY, url);
    cachedApiUrl = url;
    console.log('Custom API URL saved:', url);
  } catch (error) {
    console.error('Failed to save custom API URL:', error);
    throw error;
  }
};

// Clear custom API URL (use defaults)
export const clearCustomApiUrl = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(API_URL_STORAGE_KEY);
    cachedApiUrl = null;
    console.log('Custom API URL cleared');
  } catch (error) {
    console.error('Failed to clear custom API URL:', error);
    throw error;
  }
};

// Get current API URL (async, always fresh)
export const getCurrentApiUrl = async (): Promise<string> => {
  return await getApiUrl();
};

// Export for use in ApiService (initial value, will be updated)
export const API_BASE_URL = getCachedApiUrl();

// Export individual URLs for manual configuration
export const API_URLS = {
  development: DEFAULT_DEVELOPMENT_API_URL,
  production: PRODUCTION_API_URL,
  androidEmulator: ANDROID_EMULATOR_API_URL,
  iosSimulator: IOS_SIMULATOR_API_URL,
};

// Export storage key for settings screen
export { API_URL_STORAGE_KEY };
