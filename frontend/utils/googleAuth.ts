// Google Authentication Utility
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

// Complete the auth session for better UX
WebBrowser.maybeCompleteAuthSession();

// Google OAuth Configuration
// TODO: Replace with your actual Google OAuth Client ID
// Get it from: https://console.cloud.google.com/apis/credentials
// For Expo, you need:
// - Web client ID (for web)
// - iOS client ID (for iOS)
// - Android client ID (for Android)

// For development, you can use the same client ID for all platforms
// In production, use separate client IDs for each platform
export const GOOGLE_CLIENT_IDS = {
  // Replace these with your actual Google OAuth Client IDs
  ios: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '',
  android: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || '',
  web: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '',
};

// Get the appropriate client ID based on platform
export const getGoogleClientId = () => {
  if (Platform.OS === 'ios') {
    return GOOGLE_CLIENT_IDS.ios || GOOGLE_CLIENT_IDS.web;
  } else if (Platform.OS === 'android') {
    return GOOGLE_CLIENT_IDS.android || GOOGLE_CLIENT_IDS.web;
  } else {
    return GOOGLE_CLIENT_IDS.web;
  }
};

// Initialize Google Auth Request
export const useGoogleAuth = () => {
  const clientId = getGoogleClientId();

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId,
    // For web, you might need to add redirectUri
    ...(Platform.OS === 'web' && {
      redirectUri: `${window.location.origin}/auth/callback`,
    }),
  });

  return {
    request,
    response,
    promptAsync,
    isLoading: !request,
  };
};

