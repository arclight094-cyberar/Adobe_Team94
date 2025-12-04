import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  Modal,
  TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronDown, Layers, Grid } from 'lucide-react-native';
import { router } from 'expo-router';
import Navbar from '../../components/Navbar';
import { useTheme } from '../../context/ThemeContext';
import ApiService from '../../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CustomAlert from '../../components/CustomAlert';
import { useAlert } from '../../hooks/useAlert';

const UNITS_OPTIONS = ['px', 'in', 'cm', 'mm', 'points'];
const BACKGROUND_OPTIONS = ['white', 'black', 'transparent'];

// Preset dimensions (in pixels)
const PRESET_DIMENSIONS = {
  instagram: { width: 1080, height: 1080, name: 'Instagram' },
  facebook: { width: 1200, height: 630, name: 'Facebook' },
  youtube: { width: 1280, height: 720, name: 'YouTube' },
};

// Unit conversion to pixels (approximate)
const convertToPixels = (value: number, unit: string): number => {
  const numValue = Number(value);
  if (isNaN(numValue)) return 1920; // Default fallback

  switch (unit) {
    case 'px':
      return Math.round(numValue);
    case 'in':
      return Math.round(numValue * 96); // 96 DPI standard
    case 'cm':
      return Math.round(numValue * 37.795); // 1cm = 37.795px
    case 'mm':
      return Math.round(numValue * 3.7795); // 1mm = 3.7795px
    case 'points':
      return Math.round(numValue * 1.333); // 1pt = 1.333px
    default:
      return Math.round(numValue);
  }
};

// Map background contents to hex color
const mapBackgroundColor = (backgroundContents: string): string => {
  switch (backgroundContents) {
    case 'white':
      return '#ffffff';
    case 'black':
      return '#000000';
    case 'transparent':
      return '#ffffff'; // Use white as fallback for transparent
    default:
      return '#ffffff';
  }
};

export default function Canvas() {
  const { colors, isDark } = useTheme();
  const { alertState, showAlert, hideAlert } = useAlert();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [units, setUnits] = useState('px');
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [backgroundContents, setBackgroundContents] = useState('white');
  const [workspaceType, setWorkspaceType] = useState<'layers' | 'grid'>('layers');
  const [unitsDropdownOpen, setUnitsDropdownOpen] = useState(false);
  const [backgroundDropdownOpen, setBackgroundDropdownOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);

  // Handle preset click
  const handlePresetClick = (presetKey: keyof typeof PRESET_DIMENSIONS) => {
    const preset = PRESET_DIMENSIONS[presetKey];
    
    // Convert preset dimensions from pixels to current unit
    const convertFromPixels = (px: number, targetUnit: string): string => {
      switch (targetUnit) {
        case 'px':
          return Math.round(px).toString();
        case 'in':
          return (px / 96).toFixed(2);
        case 'cm':
          return (px / 37.795).toFixed(2);
        case 'mm':
          return (px / 3.7795).toFixed(2);
        case 'points':
          return (px / 1.333).toFixed(2);
        default:
          return Math.round(px).toString();
      }
    };
    
    const convertedWidth = convertFromPixels(preset.width, units);
    const convertedHeight = convertFromPixels(preset.height, units);
    
    setWidth(convertedWidth);
    setHeight(convertedHeight);
    setSelectedPreset(presetKey);
  };

  // Update selected preset when dimensions change
  React.useEffect(() => {
    if (!width || !height) {
      setSelectedPreset(null);
      return;
    }
    
    const widthNum = Number(width);
    const heightNum = Number(height);
    
    if (isNaN(widthNum) || isNaN(heightNum)) {
      setSelectedPreset(null);
      return;
    }
    
    // Convert to pixels for comparison
    const widthPx = convertToPixels(widthNum, units);
    const heightPx = convertToPixels(heightNum, units);
    
    let matchingPreset = null;
    for (const [key, preset] of Object.entries(PRESET_DIMENSIONS)) {
      if (preset.width === widthPx && preset.height === heightPx) {
        matchingPreset = key;
        break;
      }
    }
    
    setSelectedPreset(matchingPreset);
  }, [width, height, units]);

  // Handle create button press
  const handleCreateProject = async () => {
    // Validation
    if (!name.trim()) {
      showAlert('error', 'Validation Error', 'Please enter a project name');
      return;
    }

    // Only validate width, height, units for layers workspace
    if (workspaceType === 'layers') {
      if (!width || !height) {
        showAlert('error', 'Validation Error', 'Please enter width and height');
        return;
      }

      if (!units) {
        showAlert('error', 'Validation Error', 'Please select units');
        return;
      }

      if (!backgroundContents) {
        showAlert('error', 'Validation Error', 'Please select background contents');
        return;
      }
    }

    setIsCreating(true);

    try {
      let projectResult;

      // Create project based on workspace type
      if (workspaceType === 'layers') {
        // Convert dimensions to pixels
        const canvasWidth = convertToPixels(Number(width), units);
        const canvasHeight = convertToPixels(Number(height), units);
        const backgroundColor = mapBackgroundColor(backgroundContents);

        // Layer-based project (workspace)
        console.log('Creating layer-based project...');
        projectResult = await ApiService.createLayerProject(
          name.trim(),
          canvasWidth,
          canvasHeight,
          backgroundColor
        );
      } else {
        // AI Sequential project (labspace) - default canvas size to 0x0
        // Canvas will be set to uploaded image dimensions
        console.log('Creating AI sequential project with default 0x0 canvas...');
        projectResult = await ApiService.createAIProject(
          name.trim(),
          0, // Default canvas width to 0
          0, // Default canvas height to 0
          '#ffffff' // Default background color
        );
      }

      if (!projectResult.response.ok || !projectResult.data.success) {
        throw new Error(projectResult.data.message || 'Failed to create project');
      }

      const projectId = projectResult.data.data.projectId;
      console.log('Project created successfully. ProjectId:', projectId);

      // Store project ID in AsyncStorage
      await AsyncStorage.setItem('current_project_id', projectId);
      await AsyncStorage.setItem('project_type', workspaceType === 'layers' ? 'layer-based' : 'ai-sequential');

      // Navigate to appropriate workspace
      if (workspaceType === 'layers') {
        router.push('/(app)/flowspace');
      } else {
        router.push('/(app)/labspace');
      }
    } catch (error: any) {
      console.error('Error creating project:', error);
      
      // Handle authentication errors - redirect to login
      if (error.name === 'AuthenticationError' || 
          error.message?.toLowerCase().includes('invalid signature') ||
          error.message?.toLowerCase().includes('session has expired')) {
        showAlert(
          'error',
          'Session Expired',
          'Your session has expired. Please login again.'
        );
        // Redirect to login after a short delay
        setTimeout(() => {
          router.replace('/(auth)/login');
        }, 2000);
      } else {
        showAlert(
          'error',
          'Creation Failed',
          error.message || 'Failed to create project. Please try again.'
        );
      }
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background.primary }]} edges={['top', 'bottom']}>
      <Navbar screenName="" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.formCard, { 
          backgroundColor: colors.card.background,
          borderColor: colors.card.border
        }]}>
          <Text style={[styles.cardTitle, { color: colors.text.primary }]}>New canvas</Text>

          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: colors.text.secondary }]}>Name</Text>
            <TextInput
              style={[styles.input, { 
                color: colors.text.primary, 
                borderBottomColor: colors.border.primary 
              }]}
              value={name}
              onChangeText={setName}
              placeholder="Enter name"
              placeholderTextColor={colors.input.placeholder}
            />
          </View>
          <View style={styles.formGroup}>
            <View style={styles.multiLineLabel}>
              <Text style={[styles.label, { color: colors.text.secondary }]}>Workspace</Text>
              <Text style={[styles.label, { color: colors.text.secondary }]}>type</Text>
            </View>
            <View style={styles.workspaceTypeContainer}>
              <TouchableOpacity
                style={[
                  styles.workspaceTypeButton,
                  { 
                    backgroundColor: colors.input.background, 
                    borderColor: colors.input.border 
                  },
                  workspaceType === 'layers' && { 
                    backgroundColor: colors.button.primary, 
                    borderColor: colors.button.primary 
                  },
                ]}
                onPress={() => setWorkspaceType('layers')}
                activeOpacity={0.7}
              >
                <Layers
                  size={24}
                  color={
                    workspaceType === 'layers'
                      ? isDark
                        ? '#000000'
                        : colors.text.light
                      : colors.icon.default
                  }
                  strokeWidth={2}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.workspaceTypeButton,
                  { 
                    backgroundColor: colors.input.background, 
                    borderColor: colors.input.border 
                  },
                  workspaceType === 'grid' && { 
                    backgroundColor: colors.button.primary, 
                    borderColor: colors.button.primary 
                  },
                ]}
                onPress={() => setWorkspaceType('grid')}
                activeOpacity={0.7}
              >
                <Grid
                  size={24}
                  color={
                    workspaceType === 'grid'
                      ? isDark
                        ? '#000000'
                        : colors.text.light
                      : colors.icon.default
                  }
                  strokeWidth={2}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Show note for grid workspace type */}
          {workspaceType === 'grid' && (
            <View style={styles.noteContainer}>
              <Text style={[styles.noteText, { color: colors.text.secondary }]}>
                Note: Default canvas size will be the original dimensions of the image
              </Text>
            </View>
          )}

          {/* Show additional options only for layers workspace type */}
          {workspaceType === 'layers' && (
            <>
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.text.secondary }]}>Units</Text>
                <TouchableOpacity 
                  style={[styles.dropdown, { 
                    backgroundColor: colors.input.background, 
                    borderColor: colors.input.border 
                  }]}
                  onPress={() => {
                    setBackgroundDropdownOpen(false);
                    setUnitsDropdownOpen(!unitsDropdownOpen);
                  }}
                >
                  <Text style={[
                    styles.dropdownText, 
                    { color: colors.text.primary },
                    !units && { color: colors.input.placeholder }
                  ]}>
                    {units || 'Select'}
                  </Text>
                  <ChevronDown size={20} color={colors.icon.default} strokeWidth={2} />
                </TouchableOpacity>
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.text.secondary }]}>Width</Text>
                <TextInput
                  style={[styles.input, { 
                    color: colors.text.primary, 
                    borderBottomColor: colors.border.primary 
                  }]}
                  value={width}
                  onChangeText={setWidth}
                  placeholder="Enter width"
                  placeholderTextColor={colors.input.placeholder}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.text.secondary }]}>Height</Text>
                <TextInput
                  style={[styles.input, { 
                    color: colors.text.primary, 
                    borderBottomColor: colors.border.primary 
                  }]}
                  value={height}
                  onChangeText={setHeight}
                  placeholder="Enter height"
                  placeholderTextColor={colors.input.placeholder}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.formGroup}>
                <View style={styles.multiLineLabel}>
                  <Text style={[styles.label, { color: colors.text.secondary }]}>Background</Text>
                  <Text style={[styles.label, { color: colors.text.secondary }]}>contents</Text>
                </View>
                <TouchableOpacity 
                  style={[styles.dropdown, { 
                    backgroundColor: colors.input.background, 
                    borderColor: colors.input.border 
                  }]}
                  onPress={() => {
                    setUnitsDropdownOpen(false);
                    setBackgroundDropdownOpen(!backgroundDropdownOpen);
                  }}
                >
                  <Text style={[
                    styles.dropdownText, 
                    { color: colors.text.primary },
                    !backgroundContents && { color: colors.input.placeholder }
                  ]}>
                    {backgroundContents || 'Select '}
                  </Text>
                  <ChevronDown size={20} color={colors.icon.default} strokeWidth={2} />
                </TouchableOpacity>
              </View>

              <View style={[styles.divider, { backgroundColor: colors.border.primary }]} />

              <Text style={[styles.presetsTitle, { color: colors.text.primary }]}>Presets</Text>

              <View style={styles.presetsContainer}>
                <TouchableOpacity 
                  style={styles.presetButton} 
                  activeOpacity={0.8}
                  onPress={() => handlePresetClick('instagram')}
                >
                  <View style={[
                    styles.presetIcon, 
                    styles.presetInstagram,
                    selectedPreset === 'instagram' && styles.presetSelected
                  ]}>
                    <Image
                      source={require('../icons/instagram.png')}
                      style={styles.presetLogo}
                      resizeMode="contain"
                    />
                  </View>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.presetButton} 
                  activeOpacity={0.8}
                  onPress={() => handlePresetClick('facebook')}
                >
                  <View style={[
                    styles.presetIcon, 
                    styles.presetFacebook,
                    selectedPreset === 'facebook' && styles.presetSelected
                  ]}>
                    <Image
                      source={require('../icons/facebook.png')}
                      style={styles.presetLogo}
                      resizeMode="contain"
                    />
                  </View>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.presetButton} 
                  activeOpacity={0.8}
                  onPress={() => handlePresetClick('youtube')}
                >
                  <View style={[
                    styles.presetIcon, 
                    styles.presetYoutube,
                    selectedPreset === 'youtube' && styles.presetSelected
                  ]}>
                    <Image
                      source={require('../icons/youtube.png')}
                      style={styles.presetLogo}
                      resizeMode="contain"
                    />
                  </View>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </ScrollView>

      {/* Create Button */}
      <TouchableOpacity
        style={[
          styles.createButton, 
          { 
            bottom: 20 + insets.bottom,
            backgroundColor: colors.auth.button,
            borderColor: colors.border.primary,
            opacity: isCreating ? 0.6 : 1
          }
        ]}
        onPress={handleCreateProject}
        activeOpacity={0.8}
        disabled={isCreating}
      >
        <Text style={[styles.createButtonText, { color: colors.text.light }]}>
          {isCreating ? 'Creating...' : 'Create'}
        </Text>
      </TouchableOpacity>

      {/* Units Dropdown Modal */}
      <Modal
        visible={unitsDropdownOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setUnitsDropdownOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setUnitsDropdownOpen(false)}>
          <View style={[styles.modalOverlay, { backgroundColor: colors.background.overlay }]}>
            <TouchableWithoutFeedback>
              <View style={[
                styles.dropdownMenu, 
                { 
                  backgroundColor: colors.card.background, 
                  borderColor: colors.card.border 
                }
              ]}>
                {UNITS_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.dropdownOption,
                      { borderBottomColor: colors.border.primary },
                      units === option && { backgroundColor: colors.input.background },
                    ]}
                    onPress={() => {
                      setUnits(option);
                      setUnitsDropdownOpen(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.dropdownOptionText,
                        { color: colors.text.primary },
                        units === option && { 
                          color: colors.text.primary, 
                          fontWeight: '600' 
                        },
                      ]}
                    >
                      {option}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Background Contents Dropdown Modal */}
      <Modal
        visible={backgroundDropdownOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setBackgroundDropdownOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setBackgroundDropdownOpen(false)}>
          <View style={[styles.modalOverlay, { backgroundColor: colors.background.overlay }]}>
            <TouchableWithoutFeedback>
              <View style={[
                styles.dropdownMenu, 
                { 
                  backgroundColor: colors.card.background, 
                  borderColor: colors.card.border 
                }
              ]}>
                {BACKGROUND_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.dropdownOption,
                      { borderBottomColor: colors.border.primary },
                      backgroundContents === option && { backgroundColor: colors.input.background },
                    ]}
                    onPress={() => {
                      setBackgroundContents(option);
                      setBackgroundDropdownOpen(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.dropdownOptionText,
                        { color: colors.text.primary },
                        backgroundContents === option && { 
                          color: colors.text.primary, 
                          fontWeight: '600' 
                        },
                      ]}
                    >
                      {option}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <CustomAlert
        visible={alertState.visible}
        type={alertState.type}
        title={alertState.title}
        message={alertState.message}
        onClose={hideAlert}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 1,
    paddingBottom: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formCard: {
    borderRadius: 16,
    padding: 20,
    width: '90%',
    marginBottom: -10,
    maxWidth: 400,
    borderWidth: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 20,
    textDecorationLine: 'underline',
    fontFamily: 'geistmono',
  },
  formGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'geistmono',
    minWidth: 120,
  },
  multiLineLabel: {
    minWidth: 120,
  },
  input: {
    flex: 1,
    backgroundColor: 'transparent',
    borderBottomWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 0,
    fontSize: 14,
    fontFamily: 'geistmono',
  },
  dropdown: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
  },
  dropdownText: {
    fontSize: 14,
    fontFamily: 'geistmono',
  },
  placeholderText: {
    // Color applied inline
  },
  workspaceTypeContainer: {
    flex: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
  },
  workspaceTypeButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
  },
  workspaceTypeButtonActive: {
    // Colors applied inline
  },
  divider: {
    height: 1,
    marginVertical: 16,
  },
  presetsTitle: {
    fontSize: 18,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 16,
    textDecorationLine: 'underline',
    fontFamily: 'geistmono',
  },
  presetsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
  },
  presetButton: {
    width: 56,
    height: 56,
  },
  presetIcon: {
    width: '100%',
    height: '100%',
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  presetInstagram: {
    backgroundColor: 'transparent',
  },
  presetFacebook: {
    backgroundColor: 'transparent',
  },
  presetYoutube: {
    backgroundColor: 'transparent',
  },
  presetLogo: {
    width: 32,
    height: 32,
  },
  presetSelected: {
    borderWidth: 3,
    borderColor: '#4A90E2',
    shadowColor: '#4A90E2',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownMenu: {
    borderRadius: 12,
    minWidth: 200,
    maxWidth: 300,
    borderWidth: 1,
    overflow: 'hidden',
  },
  dropdownOption: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  dropdownOptionSelected: {
    // Colors applied inline
  },
  dropdownOptionText: {
    fontSize: 16,
    fontFamily: 'geistmono',
    textTransform: 'capitalize',
  },
  dropdownOptionTextSelected: {
    // Colors applied inline
  },
  createButton: {
    position: 'absolute',
    right: 20,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderWidth: 1,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'geistmono',
  },
  noteContainer: {
    marginTop: 8,
    marginBottom: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
  },
  noteText: {
    fontSize: 13,
    fontFamily: 'geistmono',
    lineHeight: 18,
    fontStyle: 'italic',
    textAlign: 'center',
  },
});
