// app/_layout.tsx
// Root Layout: Global providers, fonts, splash - NO navigation logic
import { Stack } from "expo-router";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";

// ---- IMPORT CONTEXT PROVIDERS (must be OUTSIDE app/) ----
import { SidebarProvider } from "../context/SideBarContext";
import { ThemeProvider } from "../context/ThemeContext";
import { initializeApiUrl } from "../constants/api";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    grift: require("../assets/fonts/grift.otf"),
    geistmono: require("../assets/fonts/geistmono.ttf"),
    geistmono_bold: require("../assets/fonts/GeistMono-Bold.ttf"),
    DelaGothicOne: require("../assets/fonts/DelaGothicOne-Regular.ttf"),
  });

  // Initialize API URL on app start
  useEffect(() => {
    initializeApiUrl().catch((error) => {
      console.error('Failed to initialize API URL:', error);
    });
  }, []);

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <ThemeProvider>
      <SidebarProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(app)" options={{ headerShown: false }} />
        </Stack>
      </SidebarProvider>
    </ThemeProvider>
  );
}


// // app/_layout.tsx
// import { Stack } from 'expo-router';
// import { useFonts } from 'expo-font';
// import * as SplashScreen from 'expo-splash-screen';
// import { useEffect } from 'react';
// import { View, Button } from 'react-native';
// import { router } from 'expo-router';

// SplashScreen.preventAutoHideAsync();

// export default function RootLayout() {
//   const [fontsLoaded] = useFonts({
//     grift: require('../assets/fonts/grift.otf'),
//     geistmono: require('../assets/fonts/geistmono.ttf'),
//     geistmono_bold:require('../assets/fonts/GeistMono-Bold.ttf'),
//   });

//   useEffect(() => {
//     if (fontsLoaded) {
//       SplashScreen.hideAsync();
//     }
//   }, [fontsLoaded]);

//   if (!fontsLoaded) return null;

//   return (
//     <>
//       <Stack screenOptions={{ headerShown: false }}>
//         <Stack.Screen name="pages/homePage" options={{ headerShown: false }} />
//         {/* <Stack.Screen name="templates/template" options={{ headerShown: false }} /> */}
//         {/* <Stack.Screen name="landing/landingPage" options={{ headerShown: false }} /> */}
//         {/* <Stack.Screen name="index" options={{ headerShown: false }} /> */}
//         {/* <Stack.Screen name="auth/SignUp" options={{ headerShown: false }} /> */}
        
//       </Stack>

//       {/* DEBUG NAVIGATION - Remove in production */}
//       {/* <View style={{ 
//         position: 'absolute', 
//         top: 50, 
//         right: 10, 
//         gap: 10,
//         backgroundColor: 'rgba(0,0,0,0.7)',
//         padding: 10,
//         borderRadius: 8,
//         zIndex: 1000
//       }}>
//         <Button title="→ Home" onPress={() => router.push('/')} color="#fff" />
//         <Button title="→ Landing" onPress={() => router.push('/landing/landingPage')} color="#fff" />
//       </View> */}
//     </>
//   );
// }