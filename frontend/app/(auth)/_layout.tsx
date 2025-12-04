// app/(auth)/_layout.tsx
// Auth Layout: No sidebar, centered design for authentication screens
import { Stack } from "expo-router";
import { useEffect } from "react";
import { router, useSegments } from "expo-router";
import apiService from "../../services/api";

export default function AuthLayout() {
  const segments = useSegments();

  useEffect(() => {
    const checkAuth = async () => {
      const isAuthenticated = await apiService.isAuthenticated();
      
      // If authenticated and trying to access auth routes, redirect to app
      if (isAuthenticated && segments[0] === "(auth)") {
        router.replace("/(app)/home");
      }
    };

    checkAuth();
  }, [segments]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="signup" />
      <Stack.Screen name="login" />
      <Stack.Screen name="verify-otp" />
    </Stack>
  );
}

