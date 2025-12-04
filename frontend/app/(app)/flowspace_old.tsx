import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Platform,
  Keyboard,
  Animated,
  Dimensions,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  Share2, 
  Plus, 
  X, 
  Eye, 
  EyeOff, 
  MoreVertical,
  Layers as LayersIcon,
  ImageIcon,
  Settings
} from 'lucide-react-native';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';
import { useSidebar } from '../../context/SideBarContext';
import { useTheme } from '../../context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from '../../services/api';
import * as ImagePicker from 'expo-image-picker';
import { useAlert } from '../../hooks/useAlert';
import CustomAlert from '../../components/CustomAlert';
import Loader from '../../components/Loader';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;
const CANVAS_HEIGHT = SCREEN_HEIGHT * 0.5;

// Layer interface matching backend Layer model
interface Layer {
  _id?: string; // MongoDB ID
  id: string;
  name: string;
  type: string; // 'foreground', 'background', 'object', 'custom', etc.
  imageUrl: string;
  publicId: string;
  maskUrl?: string | null;
  maskPublicId?: string | null;
  order: number;
  visible: boolean;
  locked: boolean;
  opacity: number;
  blendMode: string; // 'normal', 'multiply', 'screen', 'overlay', etc.
  position: { x: number; y: number };
  dimensions: { width: number; height: number };
  transformations: {
    rotation: number;
    scaleX: number;
    scaleY: number;
    flipX: boolean;
    flipY: boolean;
  };
  metadata?: any;
  createdAt?: string;
  updatedAt?: string;
}

// Project interface
interface Project {
  projectId: string;
  title: string;
  canvas: {
    width: number;
    height: number;
    backgroundColor: string;
  };
  layers: Layer[];
  totalLayers: number;
  thumbnail?: {
    imageUrl: string;
    publicId: string;
  };
  createdAt: string;
  updatedAt: string;
}

export default function Flowspace() {
  // ============================================================
  // STATE MANAGEMENT
  // ============================================================
  const { colors, isDark } = useTheme();
  const { alertState, showAlert, hideAlert } = useAlert();
  
  // Project state
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectTitle, setProjectTitle] = useState<string>('Untitled Project');
  const [projectCreated, setProjectCreated] = useState(false);
  
  // Canvas state
  const [canvasWidth, setCanvasWidth] = useState<number>(1920);
  const [canvasHeight, setCanvasHeight] = useState<number>(1080);
  const [canvasBackgroundColor, setCanvasBackgroundColor] = useState<string>('#ffffff');
  
  // Layer state
  const [layers, setLayers] = useState<Layer[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  
  // Original image (before separation)
  const [originalImageUri, setOriginalImageUri] = useState<string | null>(null);
  
  // UI state
  const [layersModalVisible, setLayersModalVisible] = useState(false);
  const [addLayerModalVisible, setAddLayerModalVisible] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Processing...');
  
  const inputBottomOffset = useRef(new Animated.Value(0)).current;
  const layersSidebarTranslateX = useRef(new Animated.Value(SCREEN_WIDTH * 0.65)).current;

  // ============================================================
  // KEYBOARD EVENT LISTENERS
  // ============================================================
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (event) => {
        Animated.timing(inputBottomOffset, {
          toValue: event.endCoordinates.height,
          duration: Platform.OS === 'ios' ? event.duration || 250 : 100,
          useNativeDriver: false,
        }).start();
      }
    );

    const keyboardDidHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      (event) => {
        Animated.timing(inputBottomOffset, {
          toValue: 0,
          duration: Platform.OS === 'ios' ? event.duration || 250 : 100,
          useNativeDriver: false,
        }).start();
      }
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, [inputBottomOffset]);

  // ============================================================
  // ANIMATE LAYERS SIDEBAR (RIGHT TO LEFT)
  // ============================================================
  useEffect(() => {
    if (layersModalVisible) {
      // Reset position before animating in
      layersSidebarTranslateX.setValue(SCREEN_WIDTH * 0.65);
      Animated.spring(layersSidebarTranslateX, {
        toValue: 0,
        useNativeDriver: true,
        speed: 20,
        bounciness: 0,
      }).start();
    } else {
      Animated.timing(layersSidebarTranslateX, {
        toValue: SCREEN_WIDTH * 0.65,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [layersModalVisible]);

  // ============================================================
  // LOAD PROJECT DATA ON MOUNT
  // ============================================================
  useEffect(() => {
    const loadProject = async () => {
      try {
        const projectId = await AsyncStorage.getItem('current_project_id');
        const projectType = await AsyncStorage.getItem('project_type');
        
        // Only load if it's a layer-based project
        if (projectId && projectType === 'layer-based') {
          console.log('Loading layer-based project:', projectId);
          // TODO: Fetch project details and layers
          setProjectCreated(true);
        }
      } catch (error) {
        console.error('Error loading project:', error);
      }
    };
    
    loadProject();
  }, []);

  // ============================================================
  // HANDLE IMAGE SELECTION AND UPLOAD
  // ============================================================
  const handleImageSelected = async (uri: string, source: 'gallery' | 'camera') => {
    if (!projectCreated) {
      showAlert('warning', 'No Project', 'Please create a project first with canvas dimensions.');
      return;
    }

    try {
      setUploading(true);
      
      const projectId = await AsyncStorage.getItem('current_project_id');
      if (!projectId) {
        throw new Error('No project found. Please create a project first.');
      }

      console.log(`Uploading image from ${source}...`);
      
      // Upload image to backend
      const uploadResult = await ApiService.uploadImage(uri, projectId, 'layer-based');
      
      if (!uploadResult.response.ok || !uploadResult.data.success) {
        throw new Error(uploadResult.data.message || 'Failed to upload image');
      }

      const imageData = uploadResult.data.data.image;
      const { imageUrl } = imageData;
      
      setImageUri(imageUrl);
      await AsyncStorage.setItem('selected_image_uri', imageUrl);
      
      // TODO: Trigger AI layer separation
      // For now, create mock layers
      setProcessing(true);
      setTimeout(() => {
        createMockLayers(imageUrl);
        setProcessing(false);
      }, 2000);
      
    } catch (error: any) {
      console.error('Error uploading image:', error);
      showAlert('error', 'Upload Failed', error.message || 'Failed to upload image. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  // ============================================================
  // CREATE MOCK LAYERS (PLACEHOLDER FOR AI SEPARATION)
  // ============================================================
  const createMockLayers = (imageUrl: string) => {
    const mockLayers: Layer[] = [
      {
        id: '1',
        name: 'Background',
        thumbnail: imageUrl,
        visible: true,
        locked: false,
        opacity: 100,
        order: 0,
      },
      {
        id: '2',
        name: 'Foreground',
        thumbnail: imageUrl,
        visible: true,
        locked: false,
        opacity: 100,
        order: 1,
      },
      {
        id: '3',
        name: 'Subject',
        thumbnail: imageUrl,
        visible: true,
        locked: false,
        opacity: 100,
        order: 2,
      },
    ];
    setLayers(mockLayers);
  };

  // ============================================================
  // GALLERY AND CAMERA FUNCTIONS
  // ============================================================
  const openGallery = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showAlert('error', 'Permission Denied', 'Gallery access is required.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 1,
    });

    if (!result.canceled) {
      const uri = result.assets[0].uri;
      await handleImageSelected(uri, 'gallery');
    }
  };

  const openCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      showAlert('error', 'Permission Denied', 'Camera access is required.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 1,
    });

    if (!result.canceled) {
      const uri = result.assets[0].uri;
      await handleImageSelected(uri, 'camera');
    }
  };

  const showUploadOptions = () => {
    Alert.alert(
      "Add Image",
      "Choose an option",
      [
        { text: "Upload from Gallery", onPress: openGallery },
        { text: "Take from Camera", onPress: openCamera },
        { text: "Cancel", style: "cancel" },
      ]
    );
  };

  // ============================================================
  // LAYER MANAGEMENT FUNCTIONS
  // ============================================================
  const toggleLayerVisibility = (layerId: string) => {
    setLayers(prev => prev.map(layer => 
      layer.id === layerId ? { ...layer, visible: !layer.visible } : layer
    ));
  };

  const toggleLayerLock = (layerId: string) => {
    setLayers(prev => prev.map(layer => 
      layer.id === layerId ? { ...layer, locked: !layer.locked } : layer
    ));
  };

  const deleteLayer = (layerId: string) => {
    Alert.alert(
      "Delete Layer",
      "Are you sure you want to delete this layer?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => setLayers(prev => prev.filter(layer => layer.id !== layerId))
        }
      ]
    );
  };

  // ============================================================
  // CREATE PROJECT FUNCTION
  // ============================================================
  const handleCreateProject = async () => {
    try {
      setProcessing(true);
      
      // TODO: Call API to create project
      const projectId = 'mock_project_' + Date.now();
      await AsyncStorage.setItem('current_project_id', projectId);
      await AsyncStorage.setItem('project_type', 'layer-based');
      
      setProjectCreated(true);
      showAlert('success', 'Project Created', 'Your project has been created successfully!');
      
      setProcessing(false);
    } catch (error) {
      console.error('Error creating project:', error);
      showAlert('error', 'Error', 'Failed to create project. Please try again.');
      setProcessing(false);
    }
  };

  // ============================================================
  // RENDER FUNCTIONS
  // ============================================================
  const renderCanvas = () => {
    if (!imageUri) {
      return (
        <View style={[styles.emptyCanvas, { 
          backgroundColor: colors.background.secondary,
          borderColor: colors.border.primary 
        }]}>
          <Text style={[styles.emptyCanvasText, { color: colors.text.secondary }]}>
            {projectCreated ? 'Upload an image to start' : 'Create a project first'}
          </Text>
          {projectCreated && (
            <TouchableOpacity
              style={[styles.uploadButton, { backgroundColor: colors.button.arclight }]}
              onPress={showUploadOptions}
            >
              <Plus size={24} color="#FFFFFF" />
              <Text style={styles.uploadButtonText}>Upload Image</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    }

    return (
      <View style={styles.canvasImageContainer}>
        <Image
          source={{ uri: imageUri }}
          style={styles.canvasImage}
          resizeMode="contain"
        />
      </View>
    );
  };

  const renderLayersModal = () => (
    <Modal
      visible={layersModalVisible}
      animationType="none"
      transparent={true}
      onRequestClose={() => setLayersModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        {/* Backdrop */}
        <TouchableOpacity 
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setLayersModalVisible(false)}
        />
        
        {/* Layers Sidebar */}
        <Animated.View 
          style={[
            styles.layersSidebar, 
            { 
              backgroundColor: colors.background.primary,
              transform: [{ translateX: layersSidebarTranslateX }]
            }
          ]}
        >
          {/* Header */}
          <View style={[styles.modalHeader, { borderBottomColor: colors.border.primary }]}>
            <Text style={[styles.modalTitle, { color: colors.text.primary }]}>Layers</Text>
            <TouchableOpacity onPress={() => setLayersModalVisible(false)}>
              <X size={24} color={colors.text.primary} />
            </TouchableOpacity>
          </View>

          {/* Layers List */}
          <ScrollView style={styles.layersList} showsVerticalScrollIndicator={false}>
            {layers.length === 0 ? (
              <View style={styles.emptyLayersContainer}>
                <Text style={[styles.emptyLayersText, { color: colors.text.secondary }]}>
                  No layers yet. Upload an image to create layers.
                </Text>
              </View>
            ) : (
              layers.map((layer, index) => (
                <View
                  key={layer.id}
                  style={[styles.layerItem, { 
                    backgroundColor: colors.background.primary,
                    borderBottomColor: colors.border.primary 
                  }]}
                >
                  {/* Layer Number */}
                  <Text style={[styles.layerNumber, { color: colors.text.primary }]}>
                    {index + 1}
                  </Text>

                  {/* Layer Thumbnail */}
                  <Image
                    source={{ uri: layer.thumbnail }}
                    style={[styles.layerThumbnail, { borderColor: colors.border.primary }]}
                  />

                  {/* Layer Actions */}
                  <View style={styles.layerActions}>
                    <TouchableOpacity
                      onPress={() => toggleLayerVisibility(layer.id)}
                      style={styles.layerActionButton}
                    >
                      {layer.visible ? (
                        <Eye size={20} color={colors.text.primary} />
                      ) : (
                        <EyeOff size={20} color={colors.text.secondary} />
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => deleteLayer(layer.id)}
                      style={styles.layerActionButton}
                    >
                      <MoreVertical size={20} color={colors.text.primary} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </ScrollView>

          {/* Add Layer Button at Bottom */}
          <TouchableOpacity
            style={[styles.addLayerButton, { 
              backgroundColor: colors.background.primary,
              borderTopColor: colors.border.primary 
            }]}
            onPress={() => setAddLayerModalVisible(true)}
          >
            <Plus size={28} color={colors.text.primary} />
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );

  const renderAddLayerModal = () => (
    <Modal
      visible={addLayerModalVisible}
      animationType="fade"
      transparent={true}
      onRequestClose={() => setAddLayerModalVisible(false)}
    >
      <View style={styles.addLayerModalOverlay}>
        {/* Backdrop */}
        <TouchableOpacity 
          style={styles.addLayerBackdrop}
          activeOpacity={1}
          onPress={() => setAddLayerModalVisible(false)}
        />

        {/* Add Layer Options */}
        <View style={styles.addLayerModalContent}>
          {/* Image Layer Option */}
          <TouchableOpacity
            style={styles.addLayerOptionContainer}
            onPress={() => {
              setAddLayerModalVisible(false);
              showUploadOptions();
            }}
          >
            <View style={[styles.addLayerCircle, { backgroundColor: colors.background.primary }]}>
              <ImageIcon size={48} color={colors.text.primary} strokeWidth={1.5} />
            </View>
            <Text style={[styles.addLayerLabel, { color: '#FFFFFF' }]}>
              IMAGE{'\n'}LAYER
            </Text>
          </TouchableOpacity>

          {/* Adjustment Layer Option */}
          <TouchableOpacity
            style={styles.addLayerOptionContainer}
            onPress={() => {
              setAddLayerModalVisible(false);
              showAlert('warning', 'Coming Soon', 'Adjustment layers will be available soon!');
            }}
          >
            <View style={[styles.addLayerCircle, { backgroundColor: colors.background.primary }]}>
              <Settings size={48} color={colors.text.primary} strokeWidth={1.5} />
            </View>
            <Text style={[styles.addLayerLabel, { color: '#FFFFFF' }]}>
              ADJUSTMENT{'\n'}LAYER
            </Text>
          </TouchableOpacity>

          {/* Bottom Action Buttons */}
          <View style={styles.addLayerBottomActions}>
            {/* Left Button - Placeholder */}
            {/* <TouchableOpacity
              style={[styles.addLayerBottomButton, { backgroundColor: colors.background.secondary }]}
              onPress={() => setAddLayerModalVisible(false)}
            >
              <View style={styles.addLayerBottomIcon}>
                <View style={[styles.iconSquare, { backgroundColor: colors.text.primary }]} />
                <View style={[styles.iconSquare, { backgroundColor: colors.text.primary }]} />
              </View>
            </TouchableOpacity> */}

            {/* Close Button */}
            <TouchableOpacity
              style={[styles.addLayerCloseButton, { backgroundColor: colors.background.secondary }]}
              onPress={() => setAddLayerModalVisible(false)}
            >
              <X size={32} color={colors.text.primary} strokeWidth={2} />
            </TouchableOpacity>

            {/* Right Button - Layers */}
            {/* <TouchableOpacity
              style={[styles.addLayerBottomButton, { backgroundColor: colors.background.secondary }]}
              onPress={() => {
                setAddLayerModalVisible(false);
                setLayersModalVisible(true);
              }}
            >
              <LayersIcon size={28} color={colors.text.primary} strokeWidth={2} />
            </TouchableOpacity> */}
          </View>
        </View>
      </View>
    </Modal>
  );

  return (
    <SafeAreaView 
      style={[styles.container, { backgroundColor: isDark ? colors.background.dark : colors.background.cream }]} 
      edges={['top', 'bottom']}
    >
      {/* HEADER / NAVBAR */}
      <Navbar 
        screenName="Flowspace" 
        rightElement={
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={() => {}}
          >
            <Share2 size={28} color={colors.text.primary} strokeWidth={2.5} />
          </TouchableOpacity>
        }
      />

      {/* MAIN CONTENT */}
      <View style={styles.content}>
        {/* Canvas Area */}
        <View style={[styles.canvasContainer, { 
          height: CANVAS_HEIGHT,
          backgroundColor: colors.background.secondary,
          borderColor: colors.border.primary 
        }]}>
          {renderCanvas()}
        </View>

        {/* Project Info */}
        {!projectCreated && (
          <View style={styles.projectInfoContainer}>
            <Text style={[styles.projectInfoTitle, { color: colors.text.primary }]}>
              Canvas Dimensions
            </Text>
            <View style={styles.dimensionsContainer}>
              <View style={styles.dimensionInput}>
                <Text style={[styles.dimensionLabel, { color: colors.text.secondary }]}>Width</Text>
                <TextInput
                  style={[styles.dimensionTextInput, { 
                    backgroundColor: colors.input.background,
                    color: colors.text.primary,
                    borderColor: colors.border.primary
                  }]}
                  value={canvasWidth.toString()}
                  onChangeText={(text) => setCanvasWidth(parseInt(text) || 0)}
                  keyboardType="numeric"
                  placeholder="1920"
                  placeholderTextColor={colors.input.placeholder}
                />
              </View>
              <Text style={[styles.dimensionSeparator, { color: colors.text.secondary }]}>×</Text>
              <View style={styles.dimensionInput}>
                <Text style={[styles.dimensionLabel, { color: colors.text.secondary }]}>Height</Text>
                <TextInput
                  style={[styles.dimensionTextInput, { 
                    backgroundColor: colors.input.background,
                    color: colors.text.primary,
                    borderColor: colors.border.primary
                  }]}
                  value={canvasHeight.toString()}
                  onChangeText={(text) => setCanvasHeight(parseInt(text) || 0)}
                  keyboardType="numeric"
                  placeholder="1080"
                  placeholderTextColor={colors.input.placeholder}
                />
              </View>
            </View>
            <TouchableOpacity
              style={[styles.createProjectButton, { backgroundColor: colors.button.arclight }]}
              onPress={handleCreateProject}
              disabled={processing}
            >
              <Text style={styles.createProjectButtonText}>Create Project</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* BOTTOM ACTION BUTTONS */}
      <View style={[styles.bottomBar, { backgroundColor: isDark ? colors.background.dark : colors.background.cream }]}>
        {/* Layers Button */}
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.background.secondary }]}
          onPress={() => setLayersModalVisible(true)}
          disabled={!projectCreated}
        >
          <LayersIcon size={24} color={projectCreated ? colors.text.primary : colors.text.tertiary} />
        </TouchableOpacity>

        {/* Add Layer Button */}
        {/* <TouchableOpacity
          style={[styles.actionButton, { 
            backgroundColor: colors.background.secondary,
            opacity: projectCreated ? 1 : 0.5 
          }]}
          onPress={() => setAddLayerModalVisible(true)}
          disabled={!projectCreated}
        >
          <Plus size={24} color={projectCreated ? colors.text.primary : colors.text.tertiary} />
        </TouchableOpacity> */}

        {/* Settings Button */}
        {/* <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.background.secondary }]}
          onPress={() => showAlert('warning', 'Settings', 'Settings will be available soon!')}
          disabled={!projectCreated}
        >
          <Settings size={24} color={projectCreated ? colors.text.primary : colors.text.tertiary} />
        </TouchableOpacity> */}
      </View>

      <Sidebar />

      {/* Modals */}
      {renderLayersModal()}
      {renderAddLayerModal()}

      {/* LOADING OVERLAYS */}
      {uploading && (
        <View style={[styles.loadingOverlay, { backgroundColor: colors.background.overlayTransparent }]}>
          <Loader size={160} />
          <Text style={[styles.loadingText, { color: colors.text.light }]}>
            Uploading Image
          </Text>
        </View>
      )}

      {processing && (
        <View style={[styles.loadingOverlay, { backgroundColor: colors.background.overlayTransparent }]}>
          <Loader size={160} />
          <Text style={[styles.loadingText, { color: colors.text.light }]}>
            Processing Layers
          </Text>
          <Text style={[styles.loadingSubtext, { color: colors.text.secondary }]}>
            AI is separating your image into layers
          </Text>
        </View>
      )}

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

// ============================================================
// STYLES
// ============================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  canvasContainer: {
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 16,
  },
  emptyCanvas: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyCanvasText: {
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'center',
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
  },
  uploadButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  canvasImageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  canvasImage: {
    width: '100%',
    height: '100%',
  },
  projectInfoContainer: {
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
  },
  projectInfoTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  dimensionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  dimensionInput: {
    flex: 1,
  },
  dimensionLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  dimensionTextInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    textAlign: 'center',
  },
  dimensionSeparator: {
    fontSize: 24,
    fontWeight: '600',
    marginHorizontal: 16,
  },
  createProjectButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  createProjectButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  actionButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    flex: 1,
  },
  layersSidebar: {
    width: SCREEN_WIDTH * 0.65,
    height: '100%',
    shadowColor: '#000',
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  layersList: {
    flex: 1,
  },
  emptyLayersContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyLayersText: {
    fontSize: 12,
    textAlign: 'center',
  },
  layerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  layerNumber: {
    fontSize: 14,
    fontWeight: '600',
    marginRight: 8,
    width: 20,
    textAlign: 'center',
  },
  layerThumbnail: {
    width: 50,
    height: 50,
    borderRadius: 6,
    marginRight: 8,
    borderWidth: 1,
  },
  layerActions: {
    flexDirection: 'row',
    gap: 4,
    marginLeft: 'auto',
  },
  layerActionButton: {
    padding: 6,
  },
  addLayerButton: {
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderTopWidth: 1,
  },
  addLayerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addLayerBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  addLayerModalContent: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  addLayerOptionContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  addLayerCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  addLayerLabel: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 1.2,
    lineHeight: 22,
  },
  addLayerBottomActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginTop: 60,
  },
  addLayerBottomButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addLayerCloseButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addLayerBottomIcon: {
    flexDirection: 'row',
    gap: 6,
  },
  iconSquare: {
    width: 12,
    height: 12,
    borderRadius: 2,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2000,
  },
  loadingText: {
    marginTop: 24,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  loadingSubtext: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0.3,
    textAlign: 'center',
    opacity: 0.8,
  },
});
