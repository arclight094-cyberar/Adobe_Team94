import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
  ScrollView,
} from 'react-native';
import { 
  X, 
  ChevronLeft, 
  Sparkles, 
  Wand2, 
  Eraser, 
  Image as ImageIcon,
  Zap,
  Sparkle,
} from 'lucide-react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ============================================================
// ARCLIGHT ENGINE MODAL PROPS
// ============================================================
interface ArclightEngineModalProps {
  visible: boolean;
  onClose: () => void;
  onEnhance: (mode: 'denoise' | 'deblur') => void; // Callback for enhance with mode
  onSubjectRemoval: () => void; // Callback for subject removal
  onObjectRemoval: () => void; // Callback for object removal
  onStyleTransfer: () => void; // Callback for style transfer
}

// ============================================================
// MAIN OPTIONS
// 4 main AI features available in Arclight Engine
// ============================================================
const mainOptions = [
  { 
    id: 'enhance', 
    icon: Zap, 
    label: 'Enhance',
    description: 'Improve image quality',
    color: '#4A90E2',
  },
  { 
    id: 'subject-removal', 
    icon: Eraser, 
    label: 'Subject Removal',
    description: 'Remove human subjects',
    color: '#E24A4A',
  },
  { 
    id: 'object-removal', 
    icon: Wand2, 
    label: 'Object Removal',
    description: 'Remove objects from image',
    color: '#E2A84A',
  },
  { 
    id: 'style-transfer', 
    icon: ImageIcon, 
    label: 'Style Transfer',
    description: 'Apply artistic styles',
    color: '#9B4AE2',
  },
];

// ============================================================
// ENHANCE SUB-OPTIONS
// Shown when "Enhance" is selected
// ============================================================
const enhanceOptions = [
  { 
    id: 'denoise', 
    icon: Sparkle, 
    label: 'Denoise',
    description: 'Remove noise from image',
  },
  { 
    id: 'deblur', 
    icon: Sparkles, 
    label: 'Deblur',
    description: 'Remove blur from image',
  },
];

export default function ArclightEngineModal({ 
  visible, 
  onClose,
  onEnhance,
  onSubjectRemoval,
  onObjectRemoval,
  onStyleTransfer,
}: ArclightEngineModalProps) {
  // ============================================================
  // STATE MANAGEMENT
  // ============================================================
  const [selectedMainOption, setSelectedMainOption] = useState<string | null>(null);

  // ============================================================
  // HANDLE MAIN OPTION SELECTION
  // When user selects one of the 4 main options
  // ============================================================
  const handleMainOptionSelect = (optionId: string) => {
    if (optionId === 'enhance') {
      // Show enhance sub-menu
      setSelectedMainOption('enhance');
    } else {
      // Directly call the respective handler
      setSelectedMainOption(null);
      onClose();
      
      switch (optionId) {
        case 'subject-removal':
          onSubjectRemoval();
          break;
        case 'object-removal':
          onObjectRemoval();
          break;
        case 'style-transfer':
          onStyleTransfer();
          break;
      }
    }
  };

  // ============================================================
  // HANDLE ENHANCE SUB-OPTION SELECTION
  // When user selects denoise or deblur from enhance sub-menu
  // ============================================================
  const handleEnhanceOptionSelect = (mode: 'denoise' | 'deblur') => {
    setSelectedMainOption(null);
    onClose();
    onEnhance(mode);
  };

  // ============================================================
  // HANDLE BACK BUTTON
  // Go back from enhance sub-menu to main menu
  // ============================================================
  const handleBack = () => {
    setSelectedMainOption(null);
  };

  // ============================================================
  // HANDLE CLOSE
  // Reset state and close modal
  // ============================================================
  const handleClose = () => {
    setSelectedMainOption(null);
    onClose();
  };

  // ============================================================
  // RENDER MAIN MENU
  // Shows 4 main options in a grid
  // ============================================================
  const renderMainMenu = () => (
    <View style={styles.contentContainer}>
      <Text style={styles.title}>Arclight Engine</Text>
      <Text style={styles.subtitle}>Select an AI feature</Text>

      <View style={styles.optionsGrid}>
        {mainOptions.map((option) => {
          const IconComponent = option.icon;
          return (
            <TouchableOpacity
              key={option.id}
              style={styles.optionCard}
              onPress={() => handleMainOptionSelect(option.id)}
              activeOpacity={0.7}
            >
              <View style={[styles.optionIconContainer, { backgroundColor: `${option.color}20` }]}>
                <IconComponent size={32} color={option.color} strokeWidth={2} />
              </View>
              <Text style={styles.optionLabel}>{option.label}</Text>
              <Text style={styles.optionDescription}>{option.description}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  // ============================================================
  // RENDER ENHANCE SUB-MENU
  // Shows denoise and deblur options when "Enhance" is selected
  // ============================================================
  const renderEnhanceSubMenu = () => (
    <View style={styles.contentContainer}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={handleBack}
        activeOpacity={0.7}
      >
        <ChevronLeft size={24} color="#333" strokeWidth={2} />
        <Text style={styles.backButtonText}>Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Enhance Image</Text>
      <Text style={styles.subtitle}>Choose enhancement type</Text>

      <View style={styles.enhanceOptionsContainer}>
        {enhanceOptions.map((option) => {
          const IconComponent = option.icon;
          return (
            <TouchableOpacity
              key={option.id}
              style={styles.enhanceOptionCard}
              onPress={() => handleEnhanceOptionSelect(option.id as 'denoise' | 'deblur')}
              activeOpacity={0.7}
            >
              <View style={styles.enhanceIconContainer}>
                <IconComponent size={40} color="#4A90E2" strokeWidth={2} />
              </View>
              <View style={styles.enhanceTextContainer}>
                <Text style={styles.enhanceOptionLabel}>{option.label}</Text>
                <Text style={styles.enhanceOptionDescription}>{option.description}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity 
          style={styles.backdrop}
          activeOpacity={1}
          onPress={handleClose}
        />
        <View style={styles.modalContainer}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <X size={24} color="#333" strokeWidth={2} />
          </TouchableOpacity>

          {/* Show main menu or enhance sub-menu based on state */}
          {selectedMainOption === 'enhance' ? renderEnhanceSubMenu() : renderMainMenu()}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  modalContainer: {
    width: '100%',
    maxWidth: 500,
    backgroundColor: '#D8D8D8',
    borderRadius: 24,
    paddingVertical: 32,
    paddingHorizontal: 24,
    position: 'relative',
    zIndex: 10,
    maxHeight: '80%',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  contentContainer: {
    width: '100%',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
    fontFamily: 'geistmono',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
    fontFamily: 'geistmono',
  },
  // Main menu styles
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 16,
  },
  optionCard: {
    width: '48%',
    backgroundColor: '#F5F5F5',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  optionIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
    textAlign: 'center',
    fontFamily: 'geistmono',
  },
  optionDescription: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    fontFamily: 'geistmono',
  },
  // Enhance sub-menu styles
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 4,
    fontFamily: 'geistmono',
  },
  enhanceOptionsContainer: {
    gap: 16,
  },
  enhanceOptionCard: {
    backgroundColor: '#F5F5F5',
    borderRadius: 16,
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  enhanceIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4A90E220',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  enhanceTextContainer: {
    flex: 1,
  },
  enhanceOptionLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
    fontFamily: 'geistmono',
  },
  enhanceOptionDescription: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'geistmono',
  },
});
