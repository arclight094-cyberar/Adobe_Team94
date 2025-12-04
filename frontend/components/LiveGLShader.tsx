/**
 * LiveGLShader Component
 * 
 * SIMPLIFIED VERSION: Uses CSS-style filters as fallback since gl-react is not compatible with React 19.
 * For true GPU acceleration, React would need to be downgraded to v18 or use a different GL library.
 * 
 * This component maintains the same API but uses optimized CSS approximations.
 * 
 * Filters implemented:
 * - Brightness: -50 to 50
 * - Contrast: -50 to 50
 * - Saturation: -50 to 50
 * - Temperature/White Balance: -50 to 50
 * - Sharpen: -50 to 50 (approximated)
 * - Noise/Grain: 0 to 50 (not implemented in CSS)
 * - Black Lift: -50 to 50
 */

import React, { useState } from 'react';
import { View, StyleSheet, Image } from 'react-native';

/**
 * CSS Filter approximations
 * These are optimized CSS implementations while we wait for React 19 compatible GL library
 */

/**
 * Filter values interface matching the UI sliders
 */
export interface GLFilterValues {
  brightness: number;    // -50 to 50
  contrast: number;      // -50 to 50
  saturation: number;    // -50 to 50
  temperature: number;   // -50 to 50 (warmth/white balance)
  sharpen: number;       // -50 to 50
  noise: number;         // 0 to 50
  blackLift: number;     // -50 to 50
  shadows: number;       // -50 to 50 (legacy, maps to blackLift)
  highlights: number;    // -50 to 50 (legacy, not implemented yet)
  warmth: number;        // -50 to 50 (legacy, maps to temperature)
}

interface LiveGLShaderProps {
  imageUri: string;
  filters: Partial<GLFilterValues>;
  width: number;
  height: number;
  style?: any;
}

/**
 * LiveGLShader Component - CSS Fallback Version
 * 
 * Note: Using CSS approximations since gl-react is not compatible with React 19.
 * For true GPU acceleration, consider downgrading to React 18 or waiting for
 * React 19 compatible GL libraries.
 * 
 * @param imageUri - URI of the image to filter
 * @param filters - Filter values from UI sliders (-50 to 50 range)
 * @param width - Surface width in pixels
 * @param height - Surface height in pixels
 * @param style - Additional React Native styles
 */
const LiveGLShader: React.FC<LiveGLShaderProps> = ({ 
  imageUri, 
  filters, 
  width, 
  height,
  style 
}) => {
  // Map UI filter values
  const brightness = filters.brightness || 0;
  const contrast = filters.contrast || 0;
  const saturation = filters.saturation || 0;
  const temperature = filters.temperature !== undefined ? filters.temperature : (filters.warmth || 0);
  const sharpen = filters.sharpen || 0;
  const blackLift = filters.blackLift !== undefined ? filters.blackLift : (filters.shadows || 0);
  
  // Calculate brightness multiplier
  const brightnessMultiplier = 1 + (brightness / 100);
  
  return (
    <View style={[styles.container, style, { width, height }]}>
      {/* Base Image */}
      <Image
        source={{ uri: imageUri }}
        style={[
          styles.baseImage,
          { opacity: Math.max(0.3, Math.min(1, brightnessMultiplier)) }
        ]}
        resizeMode="contain"
      />
      
      {/* Brightness overlays */}
      {brightness > 0 && (
        <View style={[styles.overlay, { backgroundColor: '#ffffff', opacity: brightness / 200 }]} />
      )}
      {brightness < 0 && (
        <View style={[styles.overlay, { backgroundColor: '#000000', opacity: Math.abs(brightness) / 100 }]} />
      )}
      
      {/* Contrast overlays */}
      {contrast > 0 && (
        <View style={[styles.overlay, { backgroundColor: '#000000', opacity: contrast / 400 }]} />
      )}
      {contrast < 0 && (
        <View style={[styles.overlay, { backgroundColor: '#808080', opacity: Math.abs(contrast) / 200 }]} />
      )}
      
      {/* Saturation overlays */}
      {saturation < 0 && (
        <View style={[styles.overlay, { backgroundColor: '#808080', opacity: Math.abs(saturation) / 50 }]} />
      )}
      {saturation > 0 && (
        <>
          <View style={[styles.overlay, { backgroundColor: '#000000', opacity: saturation / 300 }]} />
          <View style={[styles.overlay, { backgroundColor: '#FF4500', opacity: saturation / 600 }]} />
          <View style={[styles.overlay, { backgroundColor: '#00CED1', opacity: saturation / 800 }]} />
        </>
      )}
      
      {/* Temperature/Warmth overlays */}
      {temperature > 0 && (
        <View style={[styles.overlay, { backgroundColor: '#FFA500', opacity: temperature / 150 }]} />
      )}
      {temperature < 0 && (
        <View style={[styles.overlay, { backgroundColor: '#00BFFF', opacity: Math.abs(temperature) / 150 }]} />
      )}
      
      {/* Black Lift overlay */}
      {blackLift > 0 && (
        <View style={[styles.overlay, { backgroundColor: '#404040', opacity: blackLift / 100 }]} />
      )}
      {blackLift < 0 && (
        <View style={[styles.overlay, { backgroundColor: '#000000', opacity: Math.abs(blackLift) / 100 }]} />
      )}
      
      {/* Sharpen approximation */}
      {sharpen > 0 && (
        <View style={[styles.overlay, { backgroundColor: '#000000', opacity: sharpen / 400 }]} />
      )}
      {sharpen < 0 && (
        <View style={[styles.overlay, { backgroundColor: '#FFFFFF', opacity: Math.abs(sharpen) / 200 }]} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    position: 'relative',
  },
  baseImage: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});

export default LiveGLShader;
