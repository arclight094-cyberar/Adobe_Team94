import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { X, ChevronLeft, ChevronRight, Sun, UserX, Trash2, Sparkles, User, Palette } from 'lucide-react-native';

interface LightingModalProps {
  visible: boolean;
  onClose: () => void;
  onRelight: (brightness?: number) => void;
  onEnhance: (mode: 'denoise' | 'deblur') => void;
  onFaceRestore: () => void;
  onSubjectRemoval: (mode?: 'subject' | 'background') => void;
  onObjectRemoval: () => void;
  onStyleTransfer: () => void;
}

type ModeType = 'natural-relighting' | 'subject-removal' | 'object-removal' | 'enhance' | 'face-restore' | 'style-transfer';

interface Mode {
  id: ModeType;
  label: string;
  badgeText: string;
  instruction: string;
  options: {
    id: string;
    icon: any;
    label: string;
  }[];
}

const modes: Mode[] = [
  {
    id: 'natural-relighting',
    label: 'Natural Relighting',
    badgeText: 'NATURAL RELIGHTING',
    instruction: 'Select the point where you want your light source to be positioned, and our AI will relight the entire scene to simulate natural lighting.',
    options: [
      { id: 'sun', icon: Sun, label: 'Natural Light' },
      { id: 'sparkle-1', icon: Sparkles, label: 'Ambient Light' },
      { id: 'sparkle-2', icon: Sparkles, label: 'Studio Light' },
      { id: 'sparkle-3', icon: Sparkles, label: 'Moonlight' },
    ],
  },
  {
    id: 'subject-removal',
    label: 'Subject Removal',
    badgeText: 'SUBJECT & BACKGROUND REMOVAL',
    instruction: 'Choose to remove the subject from the image or remove the background, creating a transparent image.',
    options: [
      { id: 'person', icon: UserX, label: 'Remove Person' },
      { id: 'animal', icon: UserX, label: 'Remove Animal' },
      { id: 'group', icon: UserX, label: 'Remove Group' },
      { id: 'silhouette', icon: UserX, label: 'Remove Silhouette' },
    ],
  },
  {
    id: 'object-removal',
    label: 'Object Removal',
    badgeText: 'OBJECT REMOVAL',
    instruction: 'Select any unwanted object in your photo, and our AI will remove it while preserving the natural look of the scene.',
    options: [
      { id: 'item', icon: Trash2, label: 'Remove Item' },
      { id: 'clutter', icon: Trash2, label: 'Remove Clutter' },
      { id: 'defect', icon: Trash2, label: 'Remove Defect' },
      { id: 'unwanted', icon: Trash2, label: 'Remove Unwanted' },
    ],
  },
  {
    id: 'enhance',
    label: 'Enhance',
    badgeText: 'ENHANCE',
    instruction: 'Choose an enhancement option to improve your image quality, colors, and overall appearance with AI-powered processing.',
    options: [
      { id: 'denoise', icon: Sparkles, label: 'Denoise' },
      { id: 'deblur', icon: Sparkles, label: 'Deblur' },
    ],
  },
  {
    id: 'face-restore',
    label: 'Face Restore',
    badgeText: 'FACE RESTORE',
    instruction: 'Restore and enhance facial details in your images using AI-powered face restoration technology.',
    options: [
      { id: 'restore', icon: User, label: 'Restore Face' },
    ],
  },
  {
    id: 'style-transfer',
    label: 'Style Transfer',
    badgeText: 'STYLE TRANSFER',
    instruction: 'Apply artistic styles to your image by transferring the style from a reference image.',
    options: [
      { id: 'transfer', icon: Palette, label: 'Transfer Style' },
    ],
  },
];

export default function LightingModal({ 
  visible, 
  onClose,
  onRelight,
  onEnhance,
  onFaceRestore,
  onSubjectRemoval,
  onObjectRemoval,
  onStyleTransfer,
}: LightingModalProps) {
  const [selectedModeIndex, setSelectedModeIndex] = useState(0);
  const [showEnhanceButtons, setShowEnhanceButtons] = useState(false);
  const [showSubjectRemovalButtons, setShowSubjectRemovalButtons] = useState(false);

  const currentMode = modes[selectedModeIndex];
  const selectedMode = currentMode.id;
  const currentOption = currentMode.options[0];
  const IconComponent = currentOption.icon;

  const handlePrevious = () => {
    const newIndex = selectedModeIndex === 0 ? modes.length - 1 : selectedModeIndex - 1;
    setSelectedModeIndex(newIndex);
    setShowEnhanceButtons(false);
    setShowSubjectRemovalButtons(false);
  };

  const handleNext = () => {
    const newIndex = selectedModeIndex === modes.length - 1 ? 0 : selectedModeIndex + 1;
    setSelectedModeIndex(newIndex);
    setShowEnhanceButtons(false);
    setShowSubjectRemovalButtons(false);
  };

  const handleOptionSelect = () => {
    if (selectedMode === 'enhance') {
      // For enhance mode, show the two buttons (denoise/deblur)
      setShowEnhanceButtons(true);
    } else if (selectedMode === 'subject-removal') {
      // For subject removal mode, show the two buttons (subject removal/background removal)
      setShowSubjectRemovalButtons(true);
    } else {
      // For other modes, directly call the handler
      onClose();
      switch (selectedMode) {
        case 'face-restore':
          onFaceRestore();
          break;
        case 'object-removal':
          onObjectRemoval();
          break;
        case 'natural-relighting':
          // Use default brightness of 1.5 (can be made configurable later)
          onRelight(1.5);
          break;
        case 'style-transfer':
          onStyleTransfer();
          break;
      }
    }
  };

  const handleEnhanceMode = (mode: 'denoise' | 'deblur') => {
    onClose();
    setShowEnhanceButtons(false);
    onEnhance(mode);
  };

  const handleSubjectRemovalMode = (mode: 'subject' | 'background') => {
    onClose();
    setShowSubjectRemovalButtons(false);
    // Pass mode to handler - 'subject' for human mode, 'background' for object mode
    onSubjectRemoval(mode);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity 
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={styles.modalContainer}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <X size={24} color="#333" strokeWidth={2} />
          </TouchableOpacity>

          <Text style={styles.instructionText}>
            {currentMode.instruction}
          </Text>

          <View style={styles.badgeContainer}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{currentMode.badgeText}</Text>
            </View>
          </View>

          {showEnhanceButtons ? (
            // Show denoise/deblur buttons for enhance mode
            <View style={styles.enhanceButtonsContainer}>
              <TouchableOpacity
                style={styles.enhanceButton}
                onPress={() => handleEnhanceMode('denoise')}
                activeOpacity={0.8}
              >
                <Text style={styles.enhanceButtonText}>Denoise</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.enhanceButton}
                onPress={() => handleEnhanceMode('deblur')}
                activeOpacity={0.8}
              >
                <Text style={styles.enhanceButtonText}>Deblur</Text>
              </TouchableOpacity>
            </View>
          ) : showSubjectRemovalButtons ? (
            // Show subject removal/background removal buttons
            <View style={styles.enhanceButtonsContainer}>
              <TouchableOpacity
                style={styles.enhanceButton}
                onPress={() => handleSubjectRemovalMode('subject')}
                activeOpacity={0.8}
              >
                <Text style={styles.enhanceButtonText}>Remove Subject</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.enhanceButton}
                onPress={() => handleSubjectRemovalMode('background')}
                activeOpacity={0.8}
              >
                <Text style={styles.enhanceButtonText}>Remove Background</Text>
              </TouchableOpacity>
            </View>
          ) : (
            // Show normal controls with icon circle
            <View style={styles.controlsContainer}>
              <TouchableOpacity
                style={styles.arrowButton}
                onPress={handlePrevious}
                activeOpacity={0.7}
              >
                <ChevronLeft size={40} color="#000" strokeWidth={3} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.iconCircle}
                activeOpacity={0.8}
                onPress={handleOptionSelect}
              >
                <IconComponent size={48} color="#FFF" strokeWidth={2.5} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.arrowButton}
                onPress={handleNext}
                activeOpacity={0.7}
              >
                <ChevronRight size={40} color="#000" strokeWidth={3} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalContainer: {
    width: '100%',
    backgroundColor: '#E8E8E8',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingBottom: 40,
    paddingHorizontal: 24,
    position: 'relative',
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
  instructionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
    paddingHorizontal: 8,
    fontFamily: 'geistmono',
  },
  badgeContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  badge: {
    backgroundColor: '#4A4A4A',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 16,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#E8E8E8',
    letterSpacing: 1.2,
    fontFamily: 'geistmono',
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 32,
  },
  arrowButton: {
    width: 56,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  enhanceButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  enhanceButton: {
    flex: 1,
    backgroundColor: '#000',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 60,
  },
  enhanceButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
    fontFamily: 'geistmono',
  },
});

