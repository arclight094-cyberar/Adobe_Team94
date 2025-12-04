// app/(app)/_layout.tsx
// App Layout: Sidebar + Auth Guard for protected routes
import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { router, useSegments } from "expo-router";
import { View, StyleSheet } from "react-native";
import Sidebar from "../../components/Sidebar";
import apiService from "../../services/api";
import Loader from "../../components/Loader";

export default function AppLayout() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const segments = useSegments();

  useEffect(() => {
    const checkAuth = async () => {
      // DEBUG: Temporarily set to true for debugging
      //const authStatus = true;
      const authStatus = await apiService.isAuthenticated();
      setIsAuthenticated(authStatus);

      // If not authenticated and trying to access app routes, redirect to auth
      if (!authStatus && segments[0] === "(app)") {
        router.replace("/(auth)/signup");
      }
    };

    checkAuth();
  }, [segments]);

  // Show loading while checking auth
  if (isAuthenticated === null) {
    return (
      <View style={styles.loadingContainer}>
        <Loader size={150} />
      </View>
    );
  }

  // Don't render if not authenticated (will redirect)
  if (!isAuthenticated) {
    return null;
  }

  return (
    <>
      <Sidebar />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="workspace" />
        <Stack.Screen name="projects" />
        <Stack.Screen name="templates" />
        <Stack.Screen name="home" />
        <Stack.Screen name="settings" />
      </Stack>
    </>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
  },
});

