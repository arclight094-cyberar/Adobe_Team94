import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  withRepeat,
  Easing,
  interpolate,
} from 'react-native-reanimated';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const SIZE = 118;
const DURATION = 2000;

interface RingProps {
  r: number;
  cx: number;
  cy: number;
  stroke: string;
  keyframes: {
    time: number;
    dasharray: [number, number];
    dashoffset: number;
    strokeWidth: number;
  }[];
}

const AnimatedRing: React.FC<RingProps> = ({ r, cx, cy, stroke, keyframes }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: DURATION, easing: Easing.linear }),
      -1,
      false
    );
  }, []);

  const animatedProps = useAnimatedProps(() => {
    const times = keyframes.map((k) => k.time);
    const dasharrays0 = keyframes.map((k) => k.dasharray[0]);
    const dasharrays1 = keyframes.map((k) => k.dasharray[1]);
    const dashoffsets = keyframes.map((k) => k.dashoffset);
    const strokeWidths = keyframes.map((k) => k.strokeWidth);

    const dasharray0 = interpolate(progress.value, times, dasharrays0);
    const dasharray1 = interpolate(progress.value, times, dasharrays1);
    const dashoffset = interpolate(progress.value, times, dashoffsets);
    const strokeWidth = interpolate(progress.value, times, strokeWidths);

    return {
      strokeDasharray: [dasharray0, dasharray1],
      strokeDashoffset: dashoffset,
      strokeWidth: strokeWidth,
    };
  });

  return (
    <AnimatedCircle
      cx={cx}
      cy={cy}
      r={r}
      fill="none"
      stroke={stroke}
      strokeLinecap="round"
      animatedProps={animatedProps}
    />
  );
};

interface LoaderProps {
  size?: number;
}

const Loader: React.FC<LoaderProps> = ({ size = SIZE }) => {
  const scale = size / SIZE;
  const { colors } = useTheme();

  // Keyframes for Ring A (large outer ring)
  const ringAKeyframes = [
    { time: 0, dasharray: [0, 660] as [number, number], dashoffset: -330, strokeWidth: 20 },
    { time: 0.04, dasharray: [0, 660] as [number, number], dashoffset: -330, strokeWidth: 20 },
    { time: 0.12, dasharray: [60, 600] as [number, number], dashoffset: -335, strokeWidth: 30 },
    { time: 0.32, dasharray: [60, 600] as [number, number], dashoffset: -595, strokeWidth: 30 },
    { time: 0.4, dasharray: [0, 660] as [number, number], dashoffset: -660, strokeWidth: 20 },
    { time: 0.54, dasharray: [0, 660] as [number, number], dashoffset: -660, strokeWidth: 20 },
    { time: 0.62, dasharray: [60, 600] as [number, number], dashoffset: -665, strokeWidth: 30 },
    { time: 0.82, dasharray: [60, 600] as [number, number], dashoffset: -925, strokeWidth: 30 },
    { time: 0.9, dasharray: [0, 660] as [number, number], dashoffset: -990, strokeWidth: 20 },
    { time: 1, dasharray: [0, 660] as [number, number], dashoffset: -990, strokeWidth: 20 },
  ];

  // Keyframes for Ring B (small center ring)
  const ringBKeyframes = [
    { time: 0, dasharray: [0, 220] as [number, number], dashoffset: -110, strokeWidth: 20 },
    { time: 0.12, dasharray: [0, 220] as [number, number], dashoffset: -110, strokeWidth: 20 },
    { time: 0.2, dasharray: [20, 200] as [number, number], dashoffset: -115, strokeWidth: 30 },
    { time: 0.4, dasharray: [20, 200] as [number, number], dashoffset: -195, strokeWidth: 30 },
    { time: 0.48, dasharray: [0, 220] as [number, number], dashoffset: -220, strokeWidth: 20 },
    { time: 0.62, dasharray: [0, 220] as [number, number], dashoffset: -220, strokeWidth: 20 },
    { time: 0.7, dasharray: [20, 200] as [number, number], dashoffset: -225, strokeWidth: 30 },
    { time: 0.9, dasharray: [20, 200] as [number, number], dashoffset: -305, strokeWidth: 30 },
    { time: 0.98, dasharray: [0, 220] as [number, number], dashoffset: -330, strokeWidth: 20 },
    { time: 1, dasharray: [0, 220] as [number, number], dashoffset: -330, strokeWidth: 20 },
  ];

  // Keyframes for Ring C (left ring)
  const ringCKeyframes = [
    { time: 0, dasharray: [0, 440] as [number, number], dashoffset: 0, strokeWidth: 20 },
    { time: 0.08, dasharray: [40, 400] as [number, number], dashoffset: -5, strokeWidth: 30 },
    { time: 0.28, dasharray: [40, 400] as [number, number], dashoffset: -175, strokeWidth: 30 },
    { time: 0.36, dasharray: [0, 440] as [number, number], dashoffset: -220, strokeWidth: 20 },
    { time: 0.58, dasharray: [0, 440] as [number, number], dashoffset: -220, strokeWidth: 20 },
    { time: 0.66, dasharray: [40, 400] as [number, number], dashoffset: -225, strokeWidth: 30 },
    { time: 0.86, dasharray: [40, 400] as [number, number], dashoffset: -395, strokeWidth: 30 },
    { time: 0.94, dasharray: [0, 440] as [number, number], dashoffset: -440, strokeWidth: 20 },
    { time: 1, dasharray: [0, 440] as [number, number], dashoffset: -440, strokeWidth: 20 },
  ];

  // Keyframes for Ring D (right ring)
  const ringDKeyframes = [
    { time: 0, dasharray: [0, 440] as [number, number], dashoffset: 0, strokeWidth: 20 },
    { time: 0.08, dasharray: [0, 440] as [number, number], dashoffset: 0, strokeWidth: 20 },
    { time: 0.16, dasharray: [40, 400] as [number, number], dashoffset: -5, strokeWidth: 30 },
    { time: 0.36, dasharray: [40, 400] as [number, number], dashoffset: -175, strokeWidth: 30 },
    { time: 0.44, dasharray: [0, 440] as [number, number], dashoffset: -220, strokeWidth: 20 },
    { time: 0.5, dasharray: [0, 440] as [number, number], dashoffset: -220, strokeWidth: 20 },
    { time: 0.58, dasharray: [40, 400] as [number, number], dashoffset: -225, strokeWidth: 30 },
    { time: 0.78, dasharray: [40, 400] as [number, number], dashoffset: -395, strokeWidth: 30 },
    { time: 0.86, dasharray: [0, 440] as [number, number], dashoffset: -440, strokeWidth: 20 },
    { time: 1, dasharray: [0, 440] as [number, number], dashoffset: -440, strokeWidth: 20 },
  ];

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox="0 0 240 240">
        {/* Ring A - Large outer ring */}
        <AnimatedRing
          cx={120}
          cy={120}
          r={105}
          stroke={colors.loader.stroke1}
          keyframes={ringAKeyframes}
        />
        {/* Ring B - Small center ring */}
        <AnimatedRing
          cx={120}
          cy={120}
          r={35}
          stroke={colors.loader.stroke2}
          keyframes={ringBKeyframes}
        />
        {/* Ring C - Left ring */}
        <AnimatedRing
          cx={85}
          cy={120}
          r={70}
          stroke={colors.loader.stroke3}
          keyframes={ringCKeyframes}
        />
        {/* Ring D - Right ring */}
        <AnimatedRing
          cx={155}
          cy={120}
          r={70}
          stroke={colors.loader.stroke1}
          keyframes={ringDKeyframes}
        />
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default Loader;