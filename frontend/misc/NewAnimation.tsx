// import React, { useEffect } from "react";
// import { View, Text, StyleSheet, Dimensions, ActivityIndicator } from "react-native";
// import Animated, {
//   useSharedValue,
//   withTiming,
//   withDelay,
//   Easing,
//   useAnimatedStyle,
// } from "react-native-reanimated";
// import Svg, { Path } from "react-native-svg";
// import { useFonts } from "expo-font";
// import * as SplashScreen from "expo-splash-screen";

// const { width: W, height: H } = Dimensions.get("window");

// // Prevent the system splash from hiding too early
// SplashScreen.preventAutoHideAsync();

// export default function SplashScreenUI() {
//   /**
//    * 🧩 1️⃣ Load your local custom fonts
//    * Make sure fonts are placed inside `assets/fonts/`
//    */
//   const [fontsLoaded] = useFonts({
//     grift: require("../assets/fonts/grift.otf"),
//     geistmono: require("../assets/fonts/geistmono.ttf"),
//   });

//   /**
//    * 🎬 2️⃣ Shared animation state values
//    */
//   const triangleOpacity = useSharedValue(0);
//   const triangleScale = useSharedValue(0.9);
//   const pencilProgress = useSharedValue(0);
//   const titleOpacity = useSharedValue(0);
//   const taglineOpacity = useSharedValue(0);

//   /**
//    * 🕓 3️⃣ Animation sequence — starts only once fonts are loaded
//    */
//   useEffect(() => {
//     if (fontsLoaded) {
//       // Hide native splash only after fonts are ready
//       SplashScreen.hideAsync();

//       // Step 1: Fade & scale in the triangle
//       triangleOpacity.value = withTiming(1, {
//         duration: 1000,
//         easing: Easing.out(Easing.cubic),
//       });
//       triangleScale.value = withTiming(1, {
//         duration: 1000,
//         easing: Easing.out(Easing.cubic),
//       });

//       // Step 2: Slide in the pencil from the top-right (diagonal)
//       pencilProgress.value = withDelay(
//         900, // 🕐 Adjust this delay to start pencil earlier/later
//         withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.cubic) })
//       );

//       // Step 3: Fade in the title text
//       titleOpacity.value = withDelay(
//         2400, // 🕐 Adjust to sync with end of pencil motion
//         withTiming(1, { duration: 800, easing: Easing.out(Easing.cubic) })
//       );

//       // Step 4: Fade in the tagline after title
//       taglineOpacity.value = withDelay(
//         2800, // 🕐 Slightly later than title
//         withTiming(1, { duration: 800, easing: Easing.out(Easing.cubic) })
//       );
//     }
//   }, [fontsLoaded]);

//   /**
//    * 🧭 4️⃣ Fallback loader (if fonts still loading)
//    */
//   if (!fontsLoaded) {
//     return (
//       <View style={styles.loadingContainer}>
//         <ActivityIndicator size="large" color="#6ee733" />
//       </View>
//     );
//   }

//   /**
//    * 🎨 5️⃣ Animated triangle appearance
//    */
//   const triangleStyle = useAnimatedStyle(() => ({
//     opacity: triangleOpacity.value,
//     transform: [{ scale: triangleScale.value }],
//   }));

//   /**
//    * ✏️ 6️⃣ Pencil motion (diagonal from top-right)
//    *    ➤ Adjust the constants to fine-tune the entry path
//    */
//   const pencilStyle = useAnimatedStyle(() => {
//     const endX = W * 0.07; // where it stops horizontally
//     const endY = H * 0.02; // where it stops vertically
//     const startX = endX + W * 0.9; // offscreen right
//     const startY = endY - H * 0.55; // offscreen top
//     const translateX = startX + (endX - startX) * pencilProgress.value;
//     const translateY = startY + (endY - startY) * pencilProgress.value;

//     return { transform: [{ translateX }, { translateY }], opacity: 1 };
//   });

//   /**
//    * 💬 7️⃣ Text animations (fade + slight upward motion)
//    */
//   const titleStyle = useAnimatedStyle(() => ({
//     opacity: titleOpacity.value,
//     transform: [{ translateY: (1 - titleOpacity.value) * 10 }],
//   }));

//   const taglineStyle = useAnimatedStyle(() => ({
//     opacity: taglineOpacity.value,
//     transform: [{ translateY: (1 - taglineOpacity.value) * 8 }],
//   }));

//   /**
//    * 📐 8️⃣ Triangle geometry — calculate where to place the text relative to it
//    */
//   const TRIANGLE_HEIGHT = W * 0.5;
//   const TRIANGLE_TOP = H / 2 - TRIANGLE_HEIGHT / 2;
//   const TRIANGLE_BASE_Y = TRIANGLE_TOP + TRIANGLE_HEIGHT * 0.82;
//   // ⬆ Adjust 0.82 ratio if your SVG triangle changes shape

//   /**
//    * 🖼️ 9️⃣ Final render — triangle, pencil, title, tagline
//    */
//   return (
//     <View style={styles.container}>
//       {/* 🔺 Triangle */}
//       <Animated.View style={[triangleStyle, styles.triangleWrapper]}>
//         <Svg
//           width={W * 0.55}
//           height={W * 0.5}
//           viewBox="0 0 707.9 631.64"
//           fill="none"
//         >
//           <Path
//             d="M451.36,228,167.54,719.56c-27,46.68,6.73,105,60.64,105H795.82c53.91,0,87.6-58.36,60.64-105L572.64,228C545.69,181.28,478.31,181.28,451.36,228Z"
//             transform="translate(-158.05 -192.95)"
//             fill="#ffffffff"
//           />
//         </Svg>
//       </Animated.View>

//       {/* ✏️ Pencil */}
//       <Animated.View style={[styles.pencilWrapper, pencilStyle]}>
//         <Svg width={W * 0.29} height={W * 0.45} viewBox="0 0 389.13 588.96">
//           <Path
//             d="M450.13,837.75l102.68-59.28a14.89,14.89,0,0,0,0-25.78L450.13,693.41A14.88,14.88,0,0,0,427.8,706.3V824.86A14.88,14.88,0,0,0,450.13,837.75Z"
//             transform="translate(-427.8 -250.81)"
//             fill="#141414ff"
//           />
//           <Path
//             d="M363.99,438.16h518.29v148.32H363.99Z"
//             transform="translate(-559.91 545) rotate(-60)"
//             fill="#141414ff"
//           />
//         </Svg>
//       </Animated.View>

//       {/* 🪶 Arclight Title */}
//       <Animated.View
//         style={[
//           styles.textContainer,
//           titleStyle,
//           { top: TRIANGLE_BASE_Y + 35 }, // adjust offset from triangle base
//         ]}
//       >
//         <Text style={[styles.titleText, { fontFamily: "grift" }]}>arclight</Text>
//       </Animated.View>

//       {/* 💬 Tagline */}
//       <Animated.View
//         style={[
//           styles.textContainer,
//           taglineStyle,
//           { top: TRIANGLE_BASE_Y + 77.5 }, // adjust distance below title
//         ]}
//       >
//         <Text style={[styles.tagText, { fontFamily: "geistmono" }]}>
//           Sharper. Brighter. Better.
//         </Text>
//       </Animated.View>
//     </View>
//   );
// }

// /**
//  * 🎨 10️⃣ Styling — keep it elegant & clean
//  */
// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     backgroundColor: "#141414ff",
//     alignItems: "center",
//     justifyContent: "center",
//   },
//   loadingContainer: {
//     flex: 1,
//     backgroundColor: "#141414ff",
//     justifyContent: "center",
//     alignItems: "center",
//   },
//   triangleWrapper: {
//     position: "absolute",
//     alignItems: "center",
//     justifyContent: "center",
//   },
//   pencilWrapper: { position: "absolute" },
//   textContainer: {
//     position: "absolute",
//     alignItems: "center",
//   },
//   titleText: {
//     color: "#ffffff",
//     fontSize: 40,
//     fontWeight: "600",
//     letterSpacing: 1,
//   },
//   tagText: {
//     color: "#cbeadf",
//     fontSize: 14,
//     fontWeight: "300",
//   },
// });
