import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  PanResponder,
  Dimensions,
} from 'react-native';
import { Sun, Contrast, Droplet, Palette, Moon, CircleHelp, Aperture, Thermometer, Film, MoveVertical } from 'lucide-react-native';
import { FilterValues } from '../utils/filters';
import { useTheme } from '../context/ThemeContext';

const SCREEN_WIDTH = Dimensions.get('window').width;
const ICON_WIDTH = 90;

interface Tool {
  id: keyof FilterValues;
  icon: any;
  label: string;
  min?: number;  // Optional custom min value (default -50)
  max?: number;  // Optional custom max value (default 50)
}

const filterTools: Tool[] = [
  { id: 'brightness', icon: Sun, label: 'Brightness' },
  { id: 'contrast', icon: Contrast, label: 'Contrast', min: -100, max: 100 },
  { id: 'saturation', icon: Droplet, label: 'Saturation' },
  { id: 'temperature', icon: Thermometer, label: 'Temperature' },
  { id: 'sharpen', icon: Aperture, label: 'Sharpen' },
  { id: 'noise', icon: Film, label: 'Grain' },
  { id: 'blackLift', icon: MoveVertical, label: 'Black Lift' },
  { id: 'warmth', icon: Palette, label: 'Warmth' },
  { id: 'shadows', icon: Moon, label: 'Shadows' },
  { id: 'highlights', icon: CircleHelp, label: 'Highlights' },
];

interface FilterToolsMenuProps {
  visible: boolean;
  onClose: () => void;
  filterValues: FilterValues;
  onFilterChange: (filterId: keyof FilterValues, value: number) => void;
  imageUri: string | null;
}

export default function FilterToolsMenu({
  visible,
  onClose,
  filterValues,
  onFilterChange,
  imageUri,
}: FilterToolsMenuProps) {
  const [selectedToolIndex, setSelectedToolIndex] = useState(0);
  const [sliderValue, setSliderValue] = useState(0);
  const { colors, isDark } = useTheme();

  // ⭐ KEY FIX: Use ref to track current selected index for PanResponder
  const selectedToolIndexRef = useRef(0);
  const filterValuesRef = useRef(filterValues);

  // Slider refs
  const sliderTrackWidth = useRef(0);
  const sliderThumbPos = useRef(new Animated.Value(0)).current;
  const sliderThumbPosAtDragStart = useRef(0);
  const currentThumbPosition = useRef(0);
  const isInitialized = useRef(false);

  // Carousel refs
  const carouselOffset = useRef(new Animated.Value(0)).current;
  const carouselDragStart = useRef(0);
  const selectedIndexAtDragStart = useRef(0);
  const currentCarouselOffset = useRef(0);
  const carouselInitialized = useRef(false);

  // Get current tool's min/max range
  const getCurrentToolRange = () => {
    const currentTool = filterTools[selectedToolIndex];
    return {
      min: currentTool?.min ?? -50,
      max: currentTool?.max ?? 50,
    };
  };

  // ⭐ Keep refs in sync with state
  useEffect(() => {
    selectedToolIndexRef.current = selectedToolIndex;
  }, [selectedToolIndex]);

  useEffect(() => {
    filterValuesRef.current = filterValues;
  }, [filterValues]);

  // Track carousel position in real-time
  useEffect(() => {
    const listenerId = carouselOffset.addListener(({ value }) => {
      currentCarouselOffset.current = value;
    });
    return () => {
      carouselOffset.removeListener(listenerId);
    };
  }, []);

  // Track slider thumb position in real-time
  useEffect(() => {
    const listenerId = sliderThumbPos.addListener(({ value }) => {
      currentThumbPosition.current = value;
    });
    return () => {
      sliderThumbPos.removeListener(listenerId);
    };
  }, []);

  // Load saved filter value when tool changes
  useEffect(() => {
    const currentFilterId = filterTools[selectedToolIndex]?.id;
    if (!currentFilterId) return;

    const savedValue = filterValues[currentFilterId] || 0;
    const displayValue = Math.abs(savedValue) < 4 ? 0 : savedValue;
    setSliderValue(displayValue);

    if (sliderTrackWidth.current > 0) {
      const position = valueToPosition(savedValue);
      sliderThumbPos.setValue(position);
      currentThumbPosition.current = position;
      isInitialized.current = true;
    }
  }, [selectedToolIndex]);

  // Update carousel position when selected index changes
  useEffect(() => {
    if (!carouselInitialized.current) {
      const targetOffset = -selectedToolIndex * ICON_WIDTH;
      carouselOffset.setValue(targetOffset);
      currentCarouselOffset.current = targetOffset;
    }
  }, [selectedToolIndex]);

  // Slider value to position & vice versa
  const valueToPosition = (val: number): number => {
    const trackWidth = sliderTrackWidth.current;
    const { min, max } = getCurrentToolRange();
    const range = max - min;
    return ((val - min) / range) * trackWidth;
  };

  const positionToValue = (pos: number): number => {
    const trackWidth = sliderTrackWidth.current;
    const clampedPos = Math.max(0, Math.min(trackWidth, pos));
    const { min, max } = getCurrentToolRange();
    const range = max - min;
    return ((clampedPos / trackWidth) * range) + min;
  };

  // ⭐ FIX: Create PanResponder that reads from refs instead of stale closure
  const sliderPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 5 || Math.abs(gesture.dy) > 5,
      onPanResponderGrant: () => {
        sliderThumbPosAtDragStart.current = currentThumbPosition.current;
      },
      onPanResponderMove: (_, gesture) => {
        const newPos = sliderThumbPosAtDragStart.current + gesture.dx;
        let newValue = positionToValue(newPos);

        const inSnapZone = Math.abs(newValue) < 4;

        if (inSnapZone) {
          newValue = 0;
        }

        const { min, max } = getCurrentToolRange();
        newValue = Math.max(min, Math.min(max, newValue));
        const clampedPos = valueToPosition(newValue);

        sliderThumbPos.setValue(clampedPos);
        currentThumbPosition.current = clampedPos;
        const roundedValue = Math.round(newValue);

        const displayValue = inSnapZone ? 0 : roundedValue;
        setSliderValue(displayValue);

        // ⭐ FIX: Use ref to get current selected tool index
        const currentIndex = selectedToolIndexRef.current;
        const currentFilterId = filterTools[currentIndex]?.id;
        
        if (currentFilterId) {
          const currentValue = filterValuesRef.current[currentFilterId] || 0;
          if (currentValue !== roundedValue) {
            onFilterChange(currentFilterId, roundedValue);
          }
        }
      },
      onPanResponderRelease: () => {},
    })
  ).current;

  // Carousel Pan Responder
  const carouselPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        carouselDragStart.current = currentCarouselOffset.current;
        selectedIndexAtDragStart.current = selectedToolIndexRef.current;
        carouselInitialized.current = true;
      },
      onPanResponderMove: (_, gesture) => {
        const newOffset = carouselDragStart.current + gesture.dx;
        const minOffset = -(filterTools.length - 1) * ICON_WIDTH;
        const maxOffset = 0;
        
        let clampedOffset = newOffset;
        if (newOffset > maxOffset) {
          clampedOffset = maxOffset + (newOffset - maxOffset) * 0.3;
        } else if (newOffset < minOffset) {
          clampedOffset = minOffset + (newOffset - minOffset) * 0.3;
        }
        carouselOffset.setValue(clampedOffset);
      },
      onPanResponderRelease: (_, gesture) => {
        const dragDistance = Math.abs(gesture.dx);
        const velocity = Math.abs(gesture.vx);

        const currentOffset = currentCarouselOffset.current;
        const iconWidth = ICON_WIDTH;

        let targetIndex = Math.round(-currentOffset / iconWidth);
        targetIndex = Math.max(0, Math.min(filterTools.length - 1, targetIndex));

        if (dragDistance > 30 || velocity > 0.5) {
          if (gesture.dx > 0) {
            targetIndex = Math.max(0, targetIndex - 1);
          } else if (gesture.dx < 0) {
            targetIndex = Math.min(filterTools.length - 1, targetIndex + 1);
          }
        }

        if (velocity > 1.0) {
          const velocityMultiplier = Math.min(3, Math.floor(velocity));
          if (gesture.dx > 0) {
            targetIndex = Math.max(0, targetIndex - velocityMultiplier);
          } else if (gesture.dx < 0) {
            targetIndex = Math.min(filterTools.length - 1, targetIndex + velocityMultiplier);
          }
        }

        setSelectedToolIndex(targetIndex);

        const targetOffset = -targetIndex * ICON_WIDTH;
        carouselInitialized.current = true;

        Animated.spring(carouselOffset, {
          toValue: targetOffset,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
          velocity: gesture.vx || 0,
        }).start();
      },
    })
  ).current;

  // Render filter icon
  const renderFilterIcon = (tool: Tool, index: number) => {
    const IconComponent = tool.icon;
    const isActive = index === selectedToolIndex;
    const filterValue = filterValues[tool.id];
    const hasValue = filterValue !== 0 && filterValue !== undefined && !isNaN(filterValue);

    return (
      <View style={styles.filterIconWrapper}>
        <View style={[
          [styles.filterIconCircle, { backgroundColor: isDark ? colors.background.dark : colors.background.button }],
          hasValue && [styles.filterIconCircleActive, { backgroundColor: colors.special.filter }],
        ]}>
          <IconComponent
            size={36}
            color={isDark ? colors.icon.dark : colors.icon.white}
            strokeWidth={1.8}
          />
        </View>
        {!isActive && (
          <View style={[styles.filterIconBlurOverlay, { backgroundColor: colors.special.filterOverlay }]} />
        )}
        {hasValue && (
          <View style={[styles.filterValueIndicator, { backgroundColor: colors.button.arclight, borderColor: isDark ? colors.background.primary : colors.lighting.background }]} />
        )}
      </View>
    );
  };

  if (!visible) return null;

  return (
    <>
      {/* Transparent tap area */}
      <TouchableOpacity
        style={styles.filterCloseArea}
        activeOpacity={1}
        onPress={onClose}
      />

      {/* Bottom Sheet */}
      <View style={[styles.filterMenuContainer, { backgroundColor: isDark ? '#FFFFFF' : colors.background.primary }]}>
        {/* SLIDER SECTION */}
        <View style={styles.filterSliderSection}>
          <View style={styles.sliderRow}>
            <Text style={[styles.sliderMinLabel, { color: isDark ? colors.text.dark : colors.text.primary }]}>{getCurrentToolRange().min}</Text>

            <View
              style={styles.sliderTrackWrapper}
              onLayout={(e) => {
                sliderTrackWidth.current = e.nativeEvent.layout.width;
                const currentFilterId = filterTools[selectedToolIndex]?.id;
                if (currentFilterId) {
                  const currentValue = filterValues[currentFilterId] || 0;
                  const { min, max } = getCurrentToolRange();
                  const range = max - min;
                  const position = ((currentValue - min) / range) * e.nativeEvent.layout.width;
                  sliderThumbPos.setValue(position);
                  currentThumbPosition.current = position;
                  isInitialized.current = true;
                }
              }}
              {...sliderPanResponder.panHandlers}
            >
              <View style={[styles.sliderTrack, { backgroundColor: isDark ? colors.text.dark : colors.text.primary }]} />
              <View style={[styles.sliderCenterTick, { backgroundColor: isDark ? colors.text.grayMedium : colors.text.secondary }]} />

              <Animated.View
                style={[
                  styles.sliderThumbWrapper,
                  { transform: [{ translateX: Animated.subtract(sliderThumbPos, 30) }] }
                ]}
              >
                <Text style={[styles.sliderValueText, { color: isDark ? colors.text.dark : colors.text.primary }]}>{sliderValue}</Text>
                <View style={[styles.sliderThumb, { backgroundColor: colors.special.filter }]} />
              </Animated.View>
            </View>

            <Text style={[styles.sliderMaxLabel, { color: isDark ? colors.text.dark : colors.text.primary }]}>{getCurrentToolRange().max}</Text>
          </View>

          <Text style={[styles.filterToolLabel, { color: isDark ? colors.text.dark : colors.text.primary }]}>
            {filterTools[selectedToolIndex]?.label.toUpperCase()}
          </Text>
        </View>

        {/* ICON CAROUSEL */}
        <View
          style={styles.filterCarouselSection}
          {...carouselPanResponder.panHandlers}
        >
          <Animated.View
            style={[
              styles.filterCarouselInner,
              { transform: [{ translateX: carouselOffset }] }
            ]}
          >
            {filterTools.map((tool, index) => (
              <View key={`${tool.id}-${filterValues[tool.id]}`}>
                {renderFilterIcon(tool, index)}
              </View>
            ))}
          </Animated.View>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  filterCloseArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 290,
    backgroundColor: 'transparent',
    zIndex: 999,
  },
  filterMenuContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 20,
    paddingBottom: 44,
    zIndex: 1000,
  },
  filterSliderSection: {
    paddingHorizontal: 24,
    marginBottom: 28,
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 80,
  },
  sliderMinLabel: {
    fontSize: 16,
    fontWeight: '600',
    width: 40,
    textAlign: 'center',
  },
  sliderMaxLabel: {
    fontSize: 16,
    fontWeight: '600',
    width: 40,
    textAlign: 'center',
  },
  sliderTrackWrapper: {
    flex: 1,
    height: 80,
    justifyContent: 'center',
    position: 'relative',
    marginHorizontal: 8,
  },
  sliderTrack: {
    height: 2,
    borderRadius: 1,
  },
  sliderCenterTick: {
    position: 'absolute',
    left: '50%',
    marginLeft: -1,
    top: '50%',
    marginTop: -6,
    width: 2,
    height: 12,
  },
  sliderThumbWrapper: {
    position: 'absolute',
    bottom: 10,
    alignItems: 'center',
    width: 60,
  },
  sliderValueText: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
  },
  sliderThumb: {
    width: 6,
    height: 48,
    borderRadius: 3,
  },
  filterToolLabel: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 12,
    letterSpacing: 1,
  },
  filterCarouselSection: {
    height: 100,
    overflow: 'hidden',
  },
  filterCarouselInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: SCREEN_WIDTH / 2 - 45,
  },
  filterIconWrapper: {
    width: 80,
    height: 80,
    marginHorizontal: 5,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterIconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterIconCircleActive: {
  },
  filterIconBlurOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 38,
  },
  filterValueIndicator: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
});