import React, { useEffect } from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";
import {router} from "expo-router";
import Animated, {
  useSharedValue,
  withTiming,
  withDelay,
  withSequence,
  withRepeat,
  Easing,
  useAnimatedStyle,
  interpolate,
  Extrapolate,
} from "react-native-reanimated";
import Svg, { Path, G, Polygon } from "react-native-svg";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context"; // Updated import
import apiService from "../services/api";
import Loader from "../components/Loader";

const { width: W, height: H } = Dimensions.get("window");

SplashScreen.preventAutoHideAsync();

// ===== SNOW PARTICLE COMPONENT =====
// Individual floating particle that drifts downward with wobble motion
interface SnowParticleProps {
  delay: number;      // When particle should start appearing (ms)
  x: number;          // Horizontal starting position
  y: number;          // Vertical starting position
  duration: number;   // How long the animation takes
}

// ===== SNOW PARTICLE COMPONENT =====
// Individual floating particle that drifts downward with wobble motion
interface SnowParticleProps {
  delay: number; // When particle should start appearing (ms)
  x: number; // Horizontal starting position
  y: number; // Vertical starting position
  duration: number; // How long the animation takes
}

const SnowParticle = ({ delay, x, y, duration }: SnowParticleProps) => {
  // Move shared values and random calculations into single initialization
  const translateY = useSharedValue(0);
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(0);
  const size = useSharedValue(Math.random() * 3 + 2);
  const wobbleX1 = useSharedValue(Math.random() * 30 - 15);
  const wobbleX2 = useSharedValue(Math.random() * -30 + 15);

  // NEW: Values for Y wobble
  const wobbleY1 = useSharedValue(Math.random() * 30 - 15);
  const wobbleY2 = useSharedValue(Math.random() * -30 + 15);

  useEffect(() => {
    // Fade in the particle
    opacity.value = withDelay(
      delay,
      withTiming(Math.random() * 0.6 + 0.4, { duration: 500 })
    );
    
    // NEW: Vertical wobble motion
    translateY.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(wobbleY1.value, {
            duration: duration / 3,
            easing: Easing.inOut(Easing.sin),
          }),
          withTiming(wobbleY2.value, {
            duration: duration / 3,
            easing: Easing.inOut(Easing.sin),
          })
        ),
        -1,
        true
      )
    );

    // Horizontal wobble motion
    translateX.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(wobbleX1.value, {
            duration: duration / 3,
            easing: Easing.inOut(Easing.sin),
          }),
          withTiming(wobbleX2.value, {
            duration: duration / 3,
            easing: Easing.inOut(Easing.sin),
          })
        ),
        -1,
        true
      )
    );
  }, []); // ← Empty dependency array - only run once!  !

  // ===== FIX IS HERE =====
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: x + translateX.value },
      { translateY: y + translateY.value },
    ],
    // These properties were moved from the style array into the hook
    width: size.value,
    height: size.value,
    borderRadius: size.value / 2,
  }));

  return (
    <Animated.View
      style={[
        styles.particle,
        animatedStyle,
        // The properties using .value were removed from this array
      ]}
    />
  );
};

// ===== MAIN SPLASH SCREEN COMPONENT =====
export default function SplashScreenUI() {
  // Load custom fonts
  const [fontsLoaded] = useFonts({
    grift: require("../assets/fonts/grift.otf"),
    geistmono: require("../assets/fonts/geistmono.ttf"),
  });

  // ===== ANIMATION STATE VALUES =====
  const triangleOpacity = useSharedValue(0);       // Triangle fade in
  const triangleScale = useSharedValue(0.9);       // Triangle scale animation
  const pencilProgress = useSharedValue(0);        // Pencil slide animation (0 to 1)
  const titleOpacity = useSharedValue(0);          // Title text fade
  const taglineOpacity = useSharedValue(0);        // Tagline text fade
  const illuminationProgress = useSharedValue(0);  // Glow expansion (0 to 1)
  const gradientProgress = useSharedValue(0);      // Background gradient fade
  const logoOpacity = useSharedValue(0);           // Final logo fade in
  const snowOpacity = useSharedValue(0);           // Snow particles fade in

  // ===== ANIMATION SEQUENCE =====
  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();

      // STEP 1: Triangle fades in and scales up (0ms - 1000ms)
      triangleOpacity.value = withTiming(1, {
        duration: 500,
        easing: Easing.out(Easing.cubic),
      });
      triangleScale.value = withTiming(1, {
        duration: 500,
        easing: Easing.out(Easing.cubic),
      });

      // STEP 2: Pencil slides in diagonally (900ms - 2400ms)
      pencilProgress.value = withDelay(
        500,
        withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.cubic) })
      );

      // STEP 3: Powerful glow expands to fill entire screen (2300ms - 3100ms)
      // Change duration to adjust how long glow takes to expand
      illuminationProgress.value = withDelay(
        1500,
        withTiming(1, { duration: 1200, easing: Easing.out(Easing.quad) })  // ← CHANGE duration for glow speed
      );

      // STEP 4: Background gradient transition (optional, currently commented out)
      gradientProgress.value = withDelay(
        1400,
        withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.cubic) })
      );

      // STEP 5: Replace triangle+pencil with final logo (2300ms - 2700ms)
      logoOpacity.value = withDelay(
        1488,
        withTiming(1, { duration: 10, easing: Easing.out(Easing.cubic) })
      );

      // STEP 6: Snow particles start appearing (2300ms - 3100ms)
      snowOpacity.value = withDelay(
        1200,
        withTiming(1, { duration: 800, easing: Easing.out(Easing.cubic) })
      );

      // STEP 7: Title text fades in (2800ms - 3600ms)
      titleOpacity.value = withDelay(
        2000,
        withTiming(1, { duration: 800, easing: Easing.out(Easing.cubic) })
      );

      // STEP 8: Tagline fades in (3200ms - 4000ms)
      taglineOpacity.value = withDelay(
        2200,
        withTiming(1, { duration: 800, easing: Easing.out(Easing.cubic) })
      );

      // STEP 9: Check auth and redirect accordingly
      const checkAuthAndRedirect = async () => {
        //const isAuthenticated = true;
        const isAuthenticated = await apiService.isAuthenticated();
        setTimeout(() => {
          if (isAuthenticated) {
            router.replace('/(app)/home');
          } else {
            router.replace('/(auth)/signup');
          }
        }, 4500);
      };
      
      checkAuthAndRedirect();
    }
  }, [fontsLoaded]); // Ensure this is the only dependency

  // Show loading indicator while fonts load
  if (!fontsLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <Loader size={200} />
      </View>
    );
  }

  // ===== ANIMATED STYLES =====
  
  // Original triangle style (fades out when logo appears)
  const triangleStyle = useAnimatedStyle(() => ({
    opacity: triangleOpacity.value * (1 - logoOpacity.value),
    transform: [{ scale: triangleScale.value }],
  }));

  // Pencil animation (diagonal slide from top-right)
  const pencilStyle = useAnimatedStyle(() => {
    const endX = W * 0.077;     // Final X position
    const endY = H * 0.019;     // Final Y position
    const startX = endX + W * 0.9;   // Start off-screen right
    const startY = endY - H * 0.55;  // Start above screen
    const translateX = startX + (endX - startX) * pencilProgress.value; // Use shared value directly
    const translateY = startY + (endY - startY) * pencilProgress.value;

    return { 
      transform: [{ translateX }, { translateY }], 
      opacity: pencilProgress.value * (1 - logoOpacity.value) // Use shared value directly
    };
  });

  // Triangle dimensions for positioning
  const TRIANGLE_HEIGHT = W * 0.5;
  const TRIANGLE_TOP = H / 2 - TRIANGLE_HEIGHT / 2;
  const TRIANGLE_BASE_Y = TRIANGLE_TOP + TRIANGLE_HEIGHT * 0.82;

  // ===== POWERFUL GLOW ANIMATION =====
  // Expands from triangle size to fill entire screen
  const triangleGlowStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      illuminationProgress.value,
      [0, 1],
      [0.95, 10],
      Extrapolate.CLAMP
    );

    const opacity = interpolate(
      illuminationProgress.value,
      [0, 0.5, 1],
      [0, 0.95, 0.1],
      Extrapolate.CLAMP
    );

    return {
      opacity,
      transform: [{ scale }],
    };
  });

  // Background gradient style (optional)
  const gradientStyle = useAnimatedStyle(() => ({
    opacity: gradientProgress.value,
  }));

  // Final logo style (fades in after glow)
  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: triangleScale.value }],
  }));

  // Title text animation (slides up while fading in)
  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: (1 - titleOpacity.value) * 10 }],
  }));

  // Tagline text animation (slides up while fading in)
  const taglineStyle = useAnimatedStyle(() => ({
    opacity: taglineOpacity.value,
    transform: [{ translateY: (1 - taglineOpacity.value) * 8 }],
  }));

  // Snow container fade in
  const snowContainerStyle = useAnimatedStyle(() => ({
    opacity: snowOpacity.value,
  }));

  // ===== SNOW PARTICLES CONFIGURATION =====
  // Generate 75 particles with random positions
// ===== SNOW PARTICLES CONFIGURATION =====
  // Generate 100 particles with random positions
// ===== SNOW PARTICLES CONFIGURATION =====
  const snowParticles = Array.from({ length: 75 }, (_, i) => ({
    id: i,
    x: Math.random() * W, // Spawn ON-SCREEN horizontally
    y: Math.random() * H, // Spawn ON-SCREEN vertically
    delay: 2300 + Math.random() * 1000, 
    duration: 5000 + Math.random() * 4000,
  }));;

  // ===== RENDER =====
  return (
    <SafeAreaView style={styles.container}>
      

        {/* ===== SNOW PARTICLES LAYER ===== */}
        <Animated.View style={[StyleSheet.absoluteFill, snowContainerStyle, { pointerEvents: 'none' }]}>
          {snowParticles.map((particle) => (
            <SnowParticle
              key={particle.id}
              x={particle.x}
              y={particle.y}
              delay={particle.delay}
              duration={particle.duration}
            />
          ))}
        </Animated.View>

        {/* ===== POWERFUL TRIANGULAR GLOW BEAM ===== */}
        {/* Expands from triangle to fill entire screen */}
        <Animated.View style={[styles.triangleWrapper, triangleGlowStyle]}>
          <Svg
            width={W * 0.55}  // Base triangle size
            height={W * 0.5}
            viewBox="0 0 707.9 631.64"
            fill="none"
          >
            <Path
              d="M451.36,228,167.54,719.56c-27,46.68,6.73,105,60.64,105H795.82c53.91,0,87.6-58.36,60.64-105L572.64,228C545.69,181.28,478.31,181.28,451.36,228Z"
              transform="translate(-158.05 -192.95)"
              fill="rgba(255, 255, 255, 0.6)"      // ← CHANGE to adjust glow fill brightness
              stroke="rgba(255, 255, 255, 0.9)"    // ← CHANGE to adjust glow edge brightness
              strokeWidth="3"                       // ← CHANGE to adjust glow edge thickness
            />
          </Svg>
        </Animated.View>

        {/* ===== ORIGINAL TRIANGLE ===== */}
        {/* Fades out when logo appears */}
        <Animated.View style={[triangleStyle, styles.triangleWrapper]}>
          <Svg
            width={W * 0.55}
            height={W * 0.5}
            viewBox="0 0 707.9 631.64"
            fill="none"
          >
            <Path
              d="M451.36,228,167.54,719.56c-27,46.68,6.73,105,60.64,105H795.82c53.91,0,87.6-58.36,60.64-105L572.64,228C545.69,181.28,478.31,181.28,451.36,228Z"
              transform="translate(-158.05 -192.95)"
              fill="#ffffffff"
            />
          </Svg>
        </Animated.View>

        {/* ===== FINAL LOGO ===== */}
        {/* Split triangle design that fades in */}
        <Animated.View style={[logoStyle, styles.triangleWrapper]}>
          <Svg
            width={W * 0.55}
            height={W * 0.5}
            viewBox="0 0 707.9 631.64"
            fill="none"
          >
            <G>
              <Path
                d="M856.46,719.56,722.79,488,558.61,772.39a12.25,12.25,0,0,1-.78,1.36l0,.07h0a14.85,14.85,0,0,1-5,4.65l-79.9,46.13H795.82C849.73,824.6,883.42,766.24,856.46,719.56Z"
                transform="translate(-158.05 -192.95)"
                fill="#ffffffff"
              />
              <Path
                d="M427.8,706.3a14.71,14.71,0,0,1,1.54-6.63h0l0,0a13.16,13.16,0,0,1,.84-1.46l207-358.46L572.64,228c-26.95-46.69-94.33-46.69-121.28,0L167.54,719.56c-27,46.68,6.73,105,60.64,105H427.8Z"
                transform="translate(-158.05 -192.95)"
                fill="#ffffffff"
              />
            </G>
          </Svg>
        </Animated.View>

        {/* ===== PENCIL ===== */}
        {/* Slides in diagonally, fades out with triangle */}
        <Animated.View style={[styles.pencilWrapper, pencilStyle]}>
          <Svg width={W * 0.29} height={W * 0.45} viewBox="0 0 389.13 588.96">
            <Path
              d="M450.13,837.75l102.68-59.28a14.89,14.89,0,0,0,0-25.78L450.13,693.41A14.88,14.88,0,0,0,427.8,706.3V824.86A14.88,14.88,0,0,0,450.13,837.75Z"
              transform="translate(-427.8 -250.81)"
              fill="#141414ff"
            />
            <Path
              d="M363.99,438.16h518.29v148.32H363.99Z"
              transform="translate(-559.91 545) rotate(-60)"
              fill="#141414ff"
            />
          </Svg>
        </Animated.View>

        {/* ===== TITLE TEXT ===== */}
        <Animated.View
          style={[
            styles.textContainer,
            titleStyle,
            { top: TRIANGLE_BASE_Y + 35 },  // ← CHANGE to adjust vertical position
          ]}
        >
          <Text style={[styles.titleText, { fontFamily: "geistmono" }]}>
            arclight
          </Text>
        </Animated.View>

        {/* ===== TAGLINE TEXT ===== */}
        <Animated.View
          style={[
            styles.textContainer,
            taglineStyle,
            { top: TRIANGLE_BASE_Y + 80 },  // ← CHANGE to adjust vertical position
          ]}
        >
          {/* <Text style={[styles.tagText, { fontFamily: "geistmono" }]}>
            Ready to Render Reality
          </Text> */}
        </Animated.View>
      
    </SafeAreaView>
  );
}

// ===== STYLES =====
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#141414ff",  // ← CHANGE for background color
    alignItems: "center",
    justifyContent: "center",
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#141414ff",
    justifyContent: "center",
    alignItems: "center",
  },
  triangleWrapper: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  pencilWrapper: {
    position: "absolute",
  },
  particle: {
    position: "absolute",
    backgroundColor: "#ffffff",     // ← CHANGE for particle color
    shadowColor: "#ffffff",          // ← CHANGE for particle glow color
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,              // ← CHANGE for particle glow intensity
    shadowRadius: 6,                 // ← CHANGE for particle glow size
    elevation: 8,
  },
  textContainer: {
    position: "absolute",
    alignItems: "center",
  },
  titleText: {
    color: "#ffffff",                // ← CHANGE for title color
    fontSize: 40,                    // ← CHANGE for title size
    fontWeight: "600",
    letterSpacing: 1,
  },
  tagText: {
    color: "#ece7edff",                // ← CHANGE for tagline color
    fontSize: 14,                    // ← CHANGE for tagline size
    fontWeight: "300",
  },
});