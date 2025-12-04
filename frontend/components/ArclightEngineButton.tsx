import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Sparkles } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';

interface ArclightEngineButtonProps {
  onPress: () => void;
  disabled?: boolean;
}

export default function ArclightEngineButton({
  onPress,
  disabled = false,
}: ArclightEngineButtonProps) {
  const { colors } = useTheme();
  
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      disabled={disabled}
    >
      <LinearGradient
        colors={[colors.button.gradient1, colors.button.gradient2, colors.button.gradient3, colors.button.gradient1]}
        locations={[0, 0.3, 0.7, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.engineButton, { shadowColor: colors.lighting.shadow }]}
      >
        <View style={[styles.engineButtonOverlay, { backgroundColor: colors.background.buttonHover }]} />
        <View style={styles.engineButtonContent}>
          <Sparkles size={24} color={colors.icon.white} strokeWidth={2} />
          <View style={styles.engineButtonTextContainer}>
            <Text style={[styles.engineButtonText, { color: colors.text.light }]}>Arclight</Text>
            <Text style={[styles.engineButtonSubtext, { color: colors.text.light }]}>Engine</Text>
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  engineButton: {
    height: 64,
    borderRadius: 24,
    overflow: 'hidden',
    shadowOffset: {
      width: 0,
      height: -8,
    },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  engineButtonOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
  },
  engineButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    gap: 12,
  },
  engineButtonTextContainer: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 2,
  },
  engineButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    lineHeight: 20,
  },
  engineButtonSubtext: {
    fontSize: 14,
    fontWeight: 'bold',
    lineHeight: 16,
  },
});