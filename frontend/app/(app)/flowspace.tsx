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
import { 
  Share2, 
  Plus, 
  X, 
  Eye, 
  EyeOff, 
  Layers as LayersIcon,
  ImageIcon,
  Settings,
  Trash2,
  MoreVertical,
  Sparkles,
  Palette,
  Upload,
  Camera
} from 'lucide-react-native';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';

import { useTheme } from '../../context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from '../../services/api';
import * as ImagePicker from 'expo-image-picker';
import { useAlert } from '../../hooks/useAlert';
import CustomAlert from '../../components/CustomAlert';
import Loader from '../../components/Loader';
import { getRandomFunFact } from '../../utils/funFacts';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;
const CANVAS_HEIGHT = SCREEN_HEIGHT * 0.5;

// Layer interface matching backend Layer model
interface Layer {
  _id?: string; // MongoDB ID
  id: string;
  name: string;
  type: string; // 'foreground', 'background', 'object', 'custom', 'adjustment', etc.
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
  // Adjustment layer properties
  isAdjustmentLayer?: boolean;
  adjustments?: {
    brightness: number; // -100 to 100
    contrast: number; // -100 to 100
    saturation: number; // -100 to 100
    hue: number; // -180 to 180
    temperature: number; // -100 to 100 (warmth/coolness)
    tint: number; // -100 to 100 (green/magenta)
  };
  metadata?: any;
  createdAt?: string;
  updatedAt?: string;
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
  const [canvasBackgroundColor] = useState<string>('#ffffff');
  
  // Layer state
  const [layers, setLayers] = useState<Layer[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  
  // UI state
  const [layersModalVisible, setLayersModalVisible] = useState(false);
  const [addLayerModalVisible, setAddLayerModalVisible] = useState(false);
  const [propertiesModalVisible, setPropertiesModalVisible] = useState(false);
  const [adjustmentLayerModalVisible, setAdjustmentLayerModalVisible] = useState(false);
  const [uploadOptionsVisible, setUploadOptionsVisible] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Processing...');
  
  // Auto-enhancement state
  const [autoEnhanceModalVisible, setAutoEnhanceModalVisible] = useState(false);
  const [enhancementAnalysis, setEnhancementAnalysis] = useState<any>(null);
  const [applyingEnhancements, setApplyingEnhancements] = useState(false);
  
  // Background harmonization state
  const [harmonizingBackground, setHarmonizingBackground] = useState(false);
  
  // Adjustment layer temporary state (before creation)
  const [tempAdjustments, setTempAdjustments] = useState({
    brightness: 0,
    contrast: 0,
    saturation: 0,
    hue: 0,
    temperature: 0,
    tint: 0
  });
  const [activeAdjustment, setActiveAdjustment] = useState<'brightness' | 'saturation' | 'contrast'>('saturation');
  
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
  }, [layersModalVisible, layersSidebarTranslateX]);

  // ============================================================
  // LOAD PROJECT DATA ON MOUNT
  // ============================================================
  useEffect(() => {
    const loadProject = async () => {
      try {
        const storedProjectId = await AsyncStorage.getItem('current_project_id');
        const projectType = await AsyncStorage.getItem('project_type');
        
        if (storedProjectId && projectType === 'layer-based') {
          console.log('Loading layer-based project:', storedProjectId);
          await loadExistingProject(storedProjectId);
        }
      } catch (error) {
        console.error('Error loading project:', error);
      }
    };
    
    loadProject();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ============================================================
  // PROJECT MANAGEMENT FUNCTIONS
  // ============================================================
  const handleCreateProject = async () => {
    try {
      setProcessing(true);
      setLoadingMessage('Creating project...');
      
      console.log('Creating layer-based project...');
      const result = await ApiService.createLayerProject(
        projectTitle || 'Untitled Project',
        canvasWidth,
        canvasHeight,
        canvasBackgroundColor
      );
      
      if (!result.response.ok || !result.data.success) {
        throw new Error(result.data.message || 'Failed to create project');
      }
      
      const newProjectId = result.data.data.projectId;
      setProjectId(newProjectId);
      setProjectTitle(result.data.data.title);
      
      await AsyncStorage.setItem('current_project_id', newProjectId);
      await AsyncStorage.setItem('project_type', 'layer-based');
      
      setProjectCreated(true);
      showAlert('success', 'Project Created', 'Your layer-based project has been created successfully!');
      
    } catch (error: any) {
      console.error('Error creating project:', error);
      showAlert('error', 'Error', error.message || 'Failed to create project. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const loadExistingProject = async (loadProjectId: string) => {
    try {
      setProcessing(true);
      setLoadingMessage('Loading project...');
      
      const result = await ApiService.getProjectDetails(loadProjectId);
      
      if (!result.response.ok || !result.data.success) {
        throw new Error('Failed to load project');
      }
      
      const projectData = result.data.data;
      setProjectId(projectData.projectId);
      setProjectTitle(projectData.title);
      setCanvasWidth(projectData.canvas.width);
      setCanvasHeight(projectData.canvas.height);
      
      // Map layers with proper ID field (only backend layers)
      const mappedLayers = projectData.layers.map((layer: any) => ({
        ...layer,
        id: layer._id || layer.id,
      }));
      
      // Load client-side adjustment layers from AsyncStorage
      const adjustmentLayers = await loadAdjustmentLayers(loadProjectId);
      
      // Combine backend layers with client-side adjustment layers
      const allLayers = [...mappedLayers, ...adjustmentLayers];
      
      setLayers(allLayers);
      setProjectCreated(true);
      
      console.log('[loadExistingProject] Loaded', mappedLayers.length, 'backend layers and', adjustmentLayers.length, 'adjustment layers');
      
    } catch (error) {
      console.error('Error loading project:', error);
      showAlert('error', 'Error', 'Failed to load project');
    } finally {
      setProcessing(false);
    }
  };

  // ============================================================
  // IMAGE UPLOAD AND LAYER CREATION
  // ============================================================
  const handleImageSelected = async (uri: string, source: 'gallery' | 'camera') => {
    if (!projectCreated || !projectId) {
      showAlert('warning', 'No Project', 'Please create a project first.');
      return;
    }

    try {
      setUploading(true);
      setLoadingMessage('Connecting to server...');
      
      console.log(`Uploading image from ${source} to project ${projectId}...`);
      
      // Pass callback to update loading message during retries
      setLoadingMessage('Uploading image...');
      const uploadResult = await ApiService.uploadImage(uri, projectId, 'layer-based', (attempt, maxRetries, message) => {
        if (attempt < maxRetries) {
          setLoadingMessage(`Uploading image `);
        } else {
          setLoadingMessage(message || 'Uploading image...');
        }
      });
      
      if (!uploadResult.response.ok || !uploadResult.data.success) {
        throw new Error(uploadResult.data.message || 'Failed to upload image');
      }

      const responseData = uploadResult.data.data;
      
      // Check if this was the first image (auto-separated)
      if (responseData.layers && Array.isArray(responseData.layers)) {
        // First image - multiple layers created
        setLoadingMessage('Separating layers...');
        
        const mappedLayers = responseData.layers.map((layerData: any) => ({
          id: layerData.id || layerData._id,
          _id: layerData._id || layerData.id,
          name: layerData.name,
          type: layerData.type,
          imageUrl: layerData.imageUrl,
          publicId: layerData.publicId,
          order: layerData.order,
          visible: true,
          locked: false,
          opacity: 100,
          blendMode: 'normal',
          position: { x: 0, y: 0 },
          dimensions: { width: 0, height: 0 },
          transformations: {
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
            flipX: false,
            flipY: false
          }
        }));
        
        setLayers(mappedLayers);
        showAlert('success', 'Layers Created', `Image separated into ${mappedLayers.length} layers!`);
      } else if (responseData.layer) {
        // Subsequent image - single layer
        // If there's only 1 layer (layer 1, order 0), add new image as layer 2 (order 1)
        // Otherwise, use the order from backend
        setLayers(prev => {
          const sortedLayers = [...prev].sort((a, b) => a.order - b.order);
          const maxOrder = sortedLayers.length > 0 
            ? Math.max(...sortedLayers.map(l => l.order))
            : -1;
          
          // If we have exactly 1 layer (order 0), assign order 1 to new layer (layer 2)
          // Otherwise, assign maxOrder + 1
          const newOrder = (sortedLayers.length === 1 && sortedLayers[0].order === 0) 
            ? 1 
            : (maxOrder + 1);
          
          const newLayer: Layer = {
            id: responseData.layer.id || responseData.layer._id,
            _id: responseData.layer._id || responseData.layer.id,
            name: responseData.layer.name,
            type: responseData.layer.type,
            imageUrl: responseData.layer.imageUrl || responseData.image.imageUrl,
            publicId: responseData.layer.publicId || responseData.image.publicId,
            order: newOrder,
            visible: responseData.layer.visible !== undefined ? responseData.layer.visible : true,
            locked: false,
            opacity: responseData.layer.opacity || 100,
            blendMode: 'normal',
            position: { x: 0, y: 0 },
            dimensions: { width: 0, height: 0 },
            transformations: {
              rotation: 0,
              scaleX: 1,
              scaleY: 1,
              flipX: false,
              flipY: false
            }
          };
          
          return [...prev, newLayer];
        });
        showAlert('success', 'Layer Added', 'Image added as new layer!');
      }
      
    } catch (error: any) {
      console.error('Error uploading image:', error);
      showAlert('error', 'Upload Failed', error.message || 'Failed to upload image. Please try again.');
    } finally {
      setUploading(false);
    }
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
    setUploadOptionsVisible(true);
  };

  // ===================== HANDLE GALLERY FROM MODAL =====================
  const handleGalleryFromModal = async () => {
    setUploadOptionsVisible(false);
    await openGallery();
  };

  // ===================== HANDLE CAMERA FROM MODAL =====================
  const handleCameraFromModal = async () => {
    setUploadOptionsVisible(false);
    await openCamera();
  };

  // ============================================================
  // AUTO-ENHANCEMENT FUNCTIONS
  // ============================================================
  const handleAutoEnhance = async () => {
    if (!projectCreated || !projectId) {
      showAlert('warning', 'No Project', 'Please create a project first.');
      return;
    }

    if (layers.length === 0 || layers.filter(l => l.visible).length === 0) {
      showAlert('warning', 'No Visible Layers', 'Please add at least one visible layer.');
      return;
    }

    try {
      setProcessing(true);
      setLoadingMessage('Analyzing image quality...');
      
      console.log('[handleAutoEnhance] Analyzing project:', projectId);
      const result = await ApiService.autoEnhanceAnalysis(projectId);
      
      if (!result.response.ok || !result.data.success) {
        throw new Error(result.data.message || 'Analysis failed');
      }

      const analysis = result.data.data;
      setEnhancementAnalysis(analysis);
      
      console.log('[handleAutoEnhance] Analysis complete:', analysis);
      
      if (analysis.analysis.needs_enhancement) {
        setAutoEnhanceModalVisible(true);
        showAlert('success', 'Analysis Complete', `Found ${analysis.recommendations.total_steps} enhancements to apply`);
      } else {
        showAlert('success', 'Image Quality Good', 'No enhancements needed! Your image looks great.');
      }
      
    } catch (error: any) {
      console.error('[handleAutoEnhance] Error:', error);
      showAlert('error', 'Analysis Failed', error.message || 'Failed to analyze image quality');
    } finally {
      setProcessing(false);
    }
  };

  const handleApplyEnhancements = async () => {
    if (!enhancementAnalysis || !enhancementAnalysis.analysis.priority_order) {
      showAlert('error', 'No Enhancements', 'No enhancements to apply.');
      return;
    }

    if (!projectId) {
      showAlert('error', 'No Project', 'Project ID not found.');
      return;
    }

    const enhancementOrder = enhancementAnalysis.analysis.priority_order;
    
    if (!enhancementOrder || enhancementOrder.length === 0) {
      showAlert('warning', 'No Enhancements', 'No enhancements needed.');
      return;
    }

    try {
      setApplyingEnhancements(true);
      setProcessing(true);
      setLoadingMessage(`Applying ${enhancementOrder.length} enhancement(s)...`);
      
      console.log('[handleApplyEnhancements] Applying enhancements:', enhancementOrder);
      const result = await ApiService.applyEnhancements(projectId, enhancementOrder);
      
      if (!result.response.ok || !result.data.success) {
        throw new Error(result.data.message || 'Failed to apply enhancements');
      }

      const applyResult = result.data.data;
      console.log('[handleApplyEnhancements] Enhancements applied:', applyResult);
      
      // Close the modal
      setAutoEnhanceModalVisible(false);
      
      // Show success message
      showAlert(
        'success',
        'Enhancements Applied',
        `Successfully applied ${applyResult.successfulSteps || applyResult.totalSteps} enhancement(s) in ${applyResult.totalProcessingTime || 'N/A'}.`
      );

      // Optionally refresh layers or update the canvas
      // You might want to reload the project or update layers here
      if (applyResult.finalImageUrl) {
        // The backend has applied enhancements to the composite
        // You may want to create a new layer with the enhanced result
        console.log('Enhanced image URL:', applyResult.finalImageUrl);
      }
      
    } catch (error: any) {
      console.error('[handleApplyEnhancements] Error:', error);
      showAlert('error', 'Application Failed', error.message || 'Failed to apply enhancements');
    } finally {
      setApplyingEnhancements(false);
      setProcessing(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'severe': return '#EF4444';
      case 'moderate': return '#F59E0B';
      case 'mild': return '#FCD34D';
      default: return colors.text.secondary;
    }
  };

  const formatEnhancementName = (type: string) => {
    return type.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  // ============================================================
  // BACKGROUND HARMONIZATION FUNCTIONS
  // ============================================================
  const handleBackgroundHarmonization = async () => {
    if (!projectCreated || !projectId) {
      showAlert('warning', 'No Project', 'Please create a project first.');
      return;
    }

    if (layers.length < 2) {
      showAlert('warning', 'Insufficient Layers', 'Background harmonization requires at least 2 layers. Use the 1st layer as foreground and 2nd layer as background.');
      return;
    }

    // Sort layers by order to ensure correct layer selection
    const sortedLayers = [...layers].sort((a, b) => a.order - b.order);
    
    // Use 1st layer (lowest order) as foreground and 2nd layer (second lowest order) as background
    const foregroundLayer = sortedLayers[0];
    const backgroundLayer = sortedLayers[1];

    if (!foregroundLayer) {
      showAlert('warning', 'No Foreground Layer', 'Please add a first layer (foreground/subject) to harmonize.');
      return;
    }

    if (!backgroundLayer) {
      showAlert('warning', 'No Background Layer', 'Please add a second layer (background) to harmonize with.');
      return;
    }

    if (!foregroundLayer.visible) {
      showAlert('warning', 'Foreground Layer Hidden', 'The first layer (foreground) must be visible.');
      return;
    }

    if (!backgroundLayer.visible) {
      showAlert('warning', 'Background Layer Hidden', 'The second layer (background) must be visible.');
      return;
    }

    if (!foregroundLayer.imageUrl || !backgroundLayer.imageUrl) {
      showAlert('error', 'Missing Image URLs', 'Foreground or background layer is missing image URL.');
      return;
    }

    try {
      setHarmonizingBackground(true);
      setProcessing(true);
      setLoadingMessage('Harmonizing background...');
      
      console.log('[handleBackgroundHarmonization] Starting harmonization');
      console.log('Subject Image URL:', foregroundLayer.imageUrl);
      console.log('Background Image URL:', backgroundLayer.imageUrl);
      
      const result = await ApiService.replaceBackground(
        foregroundLayer.imageUrl,
        backgroundLayer.imageUrl
      );
      
      if (!result.response.ok || !result.data.success) {
        throw new Error(result.data.message || 'Background harmonization failed');
      }

      const harmonizedData = result.data.data;
      console.log('[handleBackgroundHarmonization] Harmonization complete:', harmonizedData);
      
      // The backend returns outputImage with imageUrl and publicId
      const outputImage = harmonizedData.outputImage;
      
      if (!outputImage || !outputImage.imageUrl) {
        throw new Error('Invalid response: missing harmonized image URL');
      }

      // Add the harmonized layer directly to state
      // The image is already uploaded to Cloudinary by the backend
      const newLayer: Layer = {
        id: `harmonized_${Date.now()}`,
        _id: `harmonized_${Date.now()}`,
        name: 'Harmonized Background',
        type: 'custom',
        imageUrl: outputImage.imageUrl,
        publicId: outputImage.publicId || '',
        order: layers.length,
        visible: true,
        locked: false,
        opacity: 100,
        blendMode: 'normal',
        position: { x: 0, y: 0 },
        dimensions: {
          width: outputImage.width || canvasWidth,
          height: outputImage.height || canvasHeight
        },
        transformations: {
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          flipX: false,
          flipY: false
        }
      };
      
      setLayers(prev => [...prev, newLayer]);
      
      showAlert(
        'success',
        'Background Harmonized',
        `Background harmonization completed successfully in ${harmonizedData.processingTime?.harmonization || 'N/A'}!`
      );
      
    } catch (error: any) {
      console.error('[handleBackgroundHarmonization] Error:', error);
      showAlert('error', 'Harmonization Failed', error.message || 'Failed to harmonize background');
    } finally {
      setHarmonizingBackground(false);
      setProcessing(false);
    }
  };

  // ============================================================
  // LAYER MANAGEMENT FUNCTIONS
  // ============================================================
  const toggleLayerVisibility = async (layerId: string) => {
    console.log('[toggleLayerVisibility] Function called with layerId:', layerId);
    console.log('[toggleLayerVisibility] Current layers state:', layers);
    
    const layer = layers.find(l => l.id === layerId);
    if (!layer) {
      console.warn('[toggleLayerVisibility] Layer not found with id:', layerId);
      return;
    }
    
    console.log('[toggleLayerVisibility] Found layer:', layer);
    console.log('[toggleLayerVisibility] Current visibility:', layer.visible);
    console.log('[toggleLayerVisibility] Will toggle to:', !layer.visible);
    
    try {
      if (layer.isAdjustmentLayer) {
        // Client-side only update for adjustment layers
        console.log('[toggleLayerVisibility] Updating client-side adjustment layer');
        setLayers(prev => {
          const updated = prev.map(l => 
            l.id === layerId ? { ...l, visible: !l.visible } : l
          );
          console.log('[toggleLayerVisibility] Updated layers state:', updated);
          return updated;
        });
        
        // Save to AsyncStorage
        if (projectId) {
          const updatedLayers = layers.map(l => 
            l.id === layerId ? { ...l, visible: !l.visible } : l
          );
          await saveAdjustmentLayers(projectId, updatedLayers.filter(l => l.isAdjustmentLayer));
        }
        
        console.log('[toggleLayerVisibility] Adjustment layer visibility toggled successfully');
      } else {
        // Backend layer update via API
        console.log('[toggleLayerVisibility] Calling ApiService.updateLayer...');
        const result = await ApiService.updateLayer(layerId, { visible: !layer.visible });
        console.log('[toggleLayerVisibility] API response:', result);
        
        if (result.response.ok && result.data.success) {
          console.log('[toggleLayerVisibility] API call successful, updating state');
          setLayers(prev => {
            const updated = prev.map(l => 
              l.id === layerId ? { ...l, visible: !l.visible } : l
            );
            console.log('[toggleLayerVisibility] Updated layers state:', updated);
            return updated;
          });
          console.log('[toggleLayerVisibility] Layer visibility toggled successfully');
        } else {
          console.error('[toggleLayerVisibility] API call failed:', result);
          showAlert('error', 'Error', 'Failed to update layer visibility');
        }
      }
    } catch (error) {
      console.error('[toggleLayerVisibility] Error caught:', error);
      showAlert('error', 'Error', 'Failed to update layer visibility');
    }
  };

  const updateLayerOpacity = async (layerId: string, opacity: number) => {
    console.log('[updateLayerOpacity] Function called with layerId:', layerId, 'opacity:', opacity);
    try {
      console.log('[updateLayerOpacity] Calling ApiService.updateLayer...');
      const result = await ApiService.updateLayer(layerId, { opacity });
      console.log('[updateLayerOpacity] API response:', result);
      
      if (result.response.ok && result.data.success) {
        console.log('[updateLayerOpacity] API call successful, updating state');
        setLayers(prev => {
          const updated = prev.map(l => 
            l.id === layerId ? { ...l, opacity } : l
          );
          console.log('[updateLayerOpacity] Updated layers:', updated);
          return updated;
        });
      } else {
        console.error('[updateLayerOpacity] API call failed:', result);
      }
    } catch (error) {
      console.error('[updateLayerOpacity] Error caught:', error);
    }
  };

  const updateLayerPosition = async (layerId: string, x: number, y: number) => {
    console.log('[updateLayerPosition] Function called with layerId:', layerId, 'position:', { x, y });
    try {
      console.log('[updateLayerPosition] Calling ApiService.updateLayer...');
      const result = await ApiService.updateLayer(layerId, {
        position: { x, y }
      });
      console.log('[updateLayerPosition] API response:', result);
      
      if (result.response.ok && result.data.success) {
        console.log('[updateLayerPosition] API call successful, updating state');
        setLayers(prev => {
          const updated = prev.map(l => 
            l.id === layerId ? { ...l, position: { x, y } } : l
          );
          console.log('[updateLayerPosition] Updated layers:', updated);
          return updated;
        });
        showAlert('success', 'Updated', 'Layer position updated');
      } else {
        console.error('[updateLayerPosition] API call failed:', result);
        showAlert('error', 'Error', 'Failed to update layer position');
      }
    } catch (error) {
      console.error('[updateLayerPosition] Error caught:', error);
      showAlert('error', 'Error', 'Failed to update layer position');
    }
  };

  const updateLayerTransform = async (
    layerId: string,
    rotation: number,
    scaleX: number,
    scaleY: number,
    flipX: boolean = false,
    flipY: boolean = false
  ) => {
    console.log('[updateLayerTransform] Function called with:', {
      layerId,
      rotation,
      scaleX,
      scaleY,
      flipX,
      flipY
    });
    
    try {
      console.log('[updateLayerTransform] Calling ApiService.updateLayer...');
      const result = await ApiService.updateLayer(layerId, {
        transformations: {
          rotation,
          scaleX,
          scaleY,
          flipX,
          flipY
        }
      });
      console.log('[updateLayerTransform] API response:', result);
      
      if (result.response.ok && result.data.success) {
        console.log('[updateLayerTransform] API call successful, updating state');
        setLayers(prev => {
          const updated = prev.map(l => 
            l.id === layerId ? {
              ...l,
              transformations: { rotation, scaleX, scaleY, flipX, flipY }
            } : l
          );
          console.log('[updateLayerTransform] Updated layers:', updated);
          return updated;
        });
        showAlert('success', 'Updated', 'Layer transformation updated');
      } else {
        console.error('[updateLayerTransform] API call failed:', result);
        showAlert('error', 'Error', 'Failed to update layer transformation');
      }
    } catch (error) {
      console.error('[updateLayerTransform] Error caught:', error);
      showAlert('error', 'Error', 'Failed to update layer transformation');
    }
  };

  const moveLayerUp = async (layerId: string) => {
    console.log('[moveLayerUp] Function called with layerId:', layerId);
    console.log('[moveLayerUp] Current layers:', layers);
    
    // Find the layer that needs to move up (increase order)
    const layerIndex = layers.findIndex(l => l.id === layerId);
    if (layerIndex === -1) {
      console.warn('[moveLayerUp] Layer not found');
      return;
    }
    
    const layer = layers[layerIndex];
    console.log('[moveLayerUp] Current layer order:', layer.order);
    
    // Sort layers by order to find adjacent layer
    const sortedLayers = [...layers].sort((a, b) => a.order - b.order);
    const currentIndex = sortedLayers.findIndex(l => l.id === layerId);
    
    console.log('[moveLayerUp] Current position in stack:', currentIndex, 'of', sortedLayers.length);
    
    // Check if already at top
    if (currentIndex >= sortedLayers.length - 1) {
      console.warn('[moveLayerUp] Cannot move up - already at top');
      return;
    }
    
    // Swap order values with the layer above
    const layerAbove = sortedLayers[currentIndex + 1];
    console.log('[moveLayerUp] Swapping order with layer above:', layerAbove.name);
    
    // Create new layers array with swapped orders
    const updatedLayers = layers.map(l => {
      if (l.id === layer.id) {
        return { ...l, order: layerAbove.order };
      } else if (l.id === layerAbove.id) {
        return { ...l, order: layer.order };
      }
      return l;
    });
    
    console.log('[moveLayerUp] Updated layers:', updatedLayers.map(l => `${l.name}(${l.order})`));
    
    // Update state immediately for smooth UI
    setLayers(updatedLayers);
    
    // Save adjustment layers to AsyncStorage if this was an adjustment layer
    if (layer.isAdjustmentLayer || layerAbove.isAdjustmentLayer) {
      if (projectId) {
        await saveAdjustmentLayers(projectId, updatedLayers.filter(l => l.isAdjustmentLayer));
      }
    }
    
    // Send to backend (will filter out adjustment layers automatically)
    const sortedIds = [...updatedLayers].sort((a, b) => a.order - b.order).map(l => l.id);
    console.log('[moveLayerUp] New layer order:', sortedIds);
    await reorderLayers(sortedIds);
  };

  const moveLayerDown = async (layerId: string) => {
    console.log('[moveLayerDown] Function called with layerId:', layerId);
    console.log('[moveLayerDown] Current layers:', layers);
    
    // Find the layer that needs to move down (decrease order)
    const layerIndex = layers.findIndex(l => l.id === layerId);
    if (layerIndex === -1) {
      console.warn('[moveLayerDown] Layer not found');
      return;
    }
    
    const layer = layers[layerIndex];
    console.log('[moveLayerDown] Current layer order:', layer.order);
    
    // Sort layers by order to find adjacent layer
    const sortedLayers = [...layers].sort((a, b) => a.order - b.order);
    const currentIndex = sortedLayers.findIndex(l => l.id === layerId);
    
    console.log('[moveLayerDown] Current position in stack:', currentIndex, 'of', sortedLayers.length);
    
    // Check if already at bottom
    if (currentIndex <= 0) {
      console.warn('[moveLayerDown] Cannot move down - already at bottom');
      return;
    }
    
    // Swap order values with the layer below
    const layerBelow = sortedLayers[currentIndex - 1];
    console.log('[moveLayerDown] Swapping order with layer below:', layerBelow.name);
    
    // Create new layers array with swapped orders
    const updatedLayers = layers.map(l => {
      if (l.id === layer.id) {
        return { ...l, order: layerBelow.order };
      } else if (l.id === layerBelow.id) {
        return { ...l, order: layer.order };
      }
      return l;
    });
    
    console.log('[moveLayerDown] Updated layers:', updatedLayers.map(l => `${l.name}(${l.order})`));
    
    // Update state immediately for smooth UI
    setLayers(updatedLayers);
    
    // Save adjustment layers to AsyncStorage if this was an adjustment layer
    if (layer.isAdjustmentLayer || layerBelow.isAdjustmentLayer) {
      if (projectId) {
        await saveAdjustmentLayers(projectId, updatedLayers.filter(l => l.isAdjustmentLayer));
      }
    }
    
    // Send to backend (will filter out adjustment layers automatically)
    const sortedIds = [...updatedLayers].sort((a, b) => a.order - b.order).map(l => l.id);
    console.log('[moveLayerDown] New layer order:', sortedIds);
    await reorderLayers(sortedIds);
  };

  const reorderLayers = async (layerIds: string[]) => {
    console.log('[reorderLayers] Function called with layerIds:', layerIds);
    console.log('[reorderLayers] Current projectId:', projectId);
    
    if (!projectId) {
      console.warn('[reorderLayers] No projectId - cannot reorder');
      return;
    }
    
    // If there are no backend layers to update, just return
    const backendLayerIds = layerIds.filter(id => {
      const layer = layers.find(l => l.id === id);
      return layer && !layer.isAdjustmentLayer;
    });
    
    if (backendLayerIds.length === 0) {
      console.log('[reorderLayers] No backend layers to reorder, skipping API call');
      return;
    }
    
    try {
      console.log('[reorderLayers] Backend layer IDs to send:', backendLayerIds);
      
      // Only send backend layers to API
      console.log('[reorderLayers] Calling ApiService.reorderLayers with backend layers only...');
      const result = await ApiService.reorderLayers(projectId, backendLayerIds);
      console.log('[reorderLayers] API response:', result);
      
      if (result.response.ok && result.data.success) {
        console.log('[reorderLayers] API call successful');
        // Don't update state here - it's already been updated by moveLayerUp/Down
        console.log('[reorderLayers] Backend layers synced successfully');
      } else {
        console.error('[reorderLayers] API call failed:', result);
        showAlert('error', 'Error', 'Failed to reorder layers');
      }
    } catch (error) {
      console.error('[reorderLayers] Error caught:', error);
      showAlert('error', 'Error', 'Failed to reorder layers');
    }
  };

  const deleteLayer = async (layerId: string) => {
    console.log('[deleteLayer] Function called with layerId:', layerId);
    console.log('[deleteLayer] Current layers:', layers);
    
    const layer = layers.find(l => l.id === layerId);
    console.log('[deleteLayer] Layer to delete:', layer);
    
    Alert.alert(
      "Delete Layer",
      "Are you sure you want to delete this layer?",
      [
        { 
          text: "Cancel", 
          style: "cancel",
          onPress: () => console.log('[deleteLayer] User cancelled deletion')
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            console.log('[deleteLayer] User confirmed deletion');
            try {
              if (layer?.isAdjustmentLayer) {
                // Client-side only deletion for adjustment layers
                console.log('[deleteLayer] Deleting client-side adjustment layer');
                setLayers(prev => {
                  const filtered = prev.filter(l => l.id !== layerId);
                  console.log('[deleteLayer] Updated layers after deletion:', filtered);
                  return filtered;
                });
                
                // Update AsyncStorage
                if (projectId) {
                  const remainingAdjustmentLayers = layers.filter(l => l.isAdjustmentLayer && l.id !== layerId);
                  await saveAdjustmentLayers(projectId, remainingAdjustmentLayers);
                }
                
                showAlert('success', 'Deleted', 'Adjustment layer deleted successfully');
                console.log('[deleteLayer] Adjustment layer deleted successfully');
              } else {
                // Backend layer deletion via API
                console.log('[deleteLayer] Calling ApiService.deleteLayer...');
                const result = await ApiService.deleteLayer(layerId);
                console.log('[deleteLayer] API response:', result);
                
                if (result.response.ok && result.data.success) {
                  console.log('[deleteLayer] API call successful, updating state');
                  setLayers(prev => {
                    const filtered = prev.filter(layer => layer.id !== layerId);
                    console.log('[deleteLayer] Updated layers after deletion:', filtered);
                    return filtered;
                  });
                  showAlert('success', 'Deleted', 'Layer deleted successfully');
                  console.log('[deleteLayer] Layer deleted successfully');
                } else {
                  console.error('[deleteLayer] API call failed:', result);
                  showAlert('error', 'Error', 'Failed to delete layer');
                }
              }
            } catch (error) {
              console.error('[deleteLayer] Error caught:', error);
              showAlert('error', 'Error', 'Failed to delete layer');
            }
          }
        }
      ]
    );
  };

  const duplicateLayer = async (layerId: string) => {
    try {
      setProcessing(true);
      setLoadingMessage('Duplicating layer...');
      
      const result = await ApiService.duplicateLayer(layerId);
      
      if (result.response.ok && result.data.success) {
        const newLayer: Layer = {
          ...result.data.data.layer,
          id: result.data.data.layer._id || result.data.data.layer.id,
        };
        
        setLayers(prev => [...prev, newLayer]);
        showAlert('success', 'Duplicated', 'Layer duplicated successfully');
      }
    } catch (error) {
      console.error('Error duplicating layer:', error);
      showAlert('error', 'Error', 'Failed to duplicate layer');
    } finally {
      setProcessing(false);
    }
  };

  // ============================================================
  // ADJUSTMENT LAYER FUNCTIONS
  // ============================================================
  // ============================================================
  // ADJUSTMENT LAYERS (CLIENT-SIDE ONLY)
  // ============================================================
  const saveAdjustmentLayers = async (projId: string, adjustmentLayers: Layer[]) => {
    try {
      const key = `adjustment_layers_${projId}`;
      await AsyncStorage.setItem(key, JSON.stringify(adjustmentLayers));
      console.log('[saveAdjustmentLayers] Saved adjustment layers to AsyncStorage:', adjustmentLayers.length);
    } catch (error) {
      console.error('[saveAdjustmentLayers] Error:', error);
    }
  };

  const loadAdjustmentLayers = async (projId: string): Promise<Layer[]> => {
    try {
      const key = `adjustment_layers_${projId}`;
      const stored = await AsyncStorage.getItem(key);
      if (stored) {
        const adjustmentLayers = JSON.parse(stored);
        console.log('[loadAdjustmentLayers] Loaded adjustment layers from AsyncStorage:', adjustmentLayers.length);
        return adjustmentLayers;
      }
    } catch (error) {
      console.error('[loadAdjustmentLayers] Error:', error);
    }
    return [];
  };

  const createAdjustmentLayer = async () => {
    console.log('[createAdjustmentLayer] Creating adjustment layer with:', tempAdjustments);
    
    if (!projectId) {
      showAlert('error', 'Error', 'No project selected');
      return;
    }

    try {
      setProcessing(true);
      setLoadingMessage('Creating adjustment layer...');
      
      // Find the highest order number
      const maxOrder = layers.length > 0 ? Math.max(...layers.map(l => l.order)) : -1;
      
      // Create adjustment layer as CLIENT-SIDE ONLY (not saved to backend)
      const adjustmentLayer: Layer = {
        id: `adjustment_${Date.now()}`,
        name: 'Adjustment Layer',
        type: 'adjustment',
        imageUrl: '', // No image for adjustment layers
        publicId: '',
        order: maxOrder + 1,
        visible: true,
        locked: false,
        opacity: 100,
        blendMode: 'normal',
        position: { x: 0, y: 0 },
        dimensions: { width: canvasWidth, height: canvasHeight },
        transformations: {
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          flipX: false,
          flipY: false
        },
        isAdjustmentLayer: true,
        adjustments: { ...tempAdjustments }
      };

      console.log('[createAdjustmentLayer] New client-side adjustment layer:', adjustmentLayer);
      
      const newLayers = [...layers, adjustmentLayer];
      setLayers(newLayers);
      
      // Save adjustment layers to AsyncStorage for persistence
      await saveAdjustmentLayers(projectId, newLayers.filter(l => l.isAdjustmentLayer));
      
      // Reset temp adjustments
      setTempAdjustments({
        brightness: 0,
        contrast: 0,
        saturation: 0,
        hue: 0,
        temperature: 0,
        tint: 0
      });
      
      setAdjustmentLayerModalVisible(false);
      showAlert('success', 'Created', 'Adjustment layer created successfully');
      
    } catch (error) {
      console.error('[createAdjustmentLayer] Error:', error);
      showAlert('error', 'Error', 'Failed to create adjustment layer');
    } finally {
      setProcessing(false);
    }
  };

  const updateAdjustmentLayer = (layerId: string, adjustments: typeof tempAdjustments) => {
    console.log('[updateAdjustmentLayer] Updating layer:', layerId, 'with:', adjustments);
    
    setLayers(prev => prev.map(layer => 
      layer.id === layerId && layer.isAdjustmentLayer
        ? { ...layer, adjustments: { ...adjustments } }
        : layer
    ));
  };

  // ============================================================
  // RENDER FUNCTIONS
  // ============================================================
  const renderCanvas = () => {
    if (layers.length === 0) {
      return (
        projectCreated ? (
          <TouchableOpacity
            style={[
              styles.blankCanvas,
              { 
                borderColor: colors.border.primary,
                backgroundColor: colors.background.secondary
              }
            ]}
            onPress={showUploadOptions}
            activeOpacity={0.8}
            disabled={uploading}
          >
            <Plus size={64} color={colors.icon.default} strokeWidth={2} />
            {uploading && (
              <View style={styles.uploadingIndicator}>
                <Loader size={40} />
                <Text style={[styles.uploadingText, { color: colors.button.arclight }]}>
                  {loadingMessage || 'Uploading...'}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        ) : (
          <View style={[styles.emptyCanvas, { 
            backgroundColor: colors.background.secondary,
            borderColor: colors.border.primary 
          }]}>
            <Text style={[styles.emptyCanvasText, { color: colors.text.secondary }]}>
              Create a project first
            </Text>
          </View>
        )
      );
    }

    // Calculate cumulative adjustments for each layer based on adjustment layers above it
    const getAdjustmentsForLayer = (layerOrder: number) => {
      const adjustments = {
        brightness: 0,
        contrast: 0,
        saturation: 0,
        hue: 0,
        temperature: 0,
        tint: 0
      };

      // Find all adjustment layers with order > current layer order
      layers
        .filter(l => l.isAdjustmentLayer && l.order > layerOrder && l.visible)
        .forEach(adjLayer => {
          if (adjLayer.adjustments) {
            adjustments.brightness += adjLayer.adjustments.brightness;
            adjustments.contrast += adjLayer.adjustments.contrast;
            adjustments.saturation += adjLayer.adjustments.saturation;
            adjustments.hue += adjLayer.adjustments.hue;
            adjustments.temperature += adjLayer.adjustments.temperature;
            adjustments.tint += adjLayer.adjustments.tint;
          }
        });

      return adjustments;
    };

    // Build CSS filter string from adjustments
    const buildFilterString = (adjustments: ReturnType<typeof getAdjustmentsForLayer>) => {
      const filters: string[] = [];
      
      // Brightness: -100 to 100 -> 0 to 2
      if (adjustments.brightness !== 0) {
        const brightness = 1 + (adjustments.brightness / 100);
        filters.push(`brightness(${brightness})`);
      }
      
      // Contrast: -100 to 100 -> 0 to 2
      if (adjustments.contrast !== 0) {
        const contrast = 1 + (adjustments.contrast / 100);
        filters.push(`contrast(${contrast})`);
      }
      
      // Saturation: -100 to 100 -> 0 to 2
      if (adjustments.saturation !== 0) {
        const saturation = 1 + (adjustments.saturation / 100);
        filters.push(`saturate(${saturation})`);
      }
      
      // Hue: -180 to 180
      if (adjustments.hue !== 0) {
        filters.push(`hue-rotate(${adjustments.hue}deg))`);
      }

      return filters.length > 0 ? filters.join(' ') : undefined;
    };

    // NOTE: React Native doesn't support CSS filters natively.
    // To apply actual visual filters (brightness, contrast, saturation, hue),
    // you would need to use a library like:
    // - react-native-color-matrix-image-filters
    // - react-native-image-filter-kit
    // OR process filters on the backend
    
    const hasActiveAdjustmentLayers = layers.some(l => l.isAdjustmentLayer && l.visible);
    
    return (
      <View style={{ flex: 1 }}>
        {/* {hasActiveAdjustmentLayers && (
          <View style={[styles.adjustmentBanner, { 
            backgroundColor: colors.button.arclight + '20',
            borderBottomColor: colors.button.arclight
          }]}>
            <Settings size={16} color={colors.button.arclight} />
            <Text style={[styles.adjustmentBannerText, { color: colors.button.arclight }]}>
              Adjustment layers active (brightness shown as overlay)
            </Text>
          </View>
        )} */}
        <View style={styles.canvasImageContainer}>
        {layers
          .sort((a, b) => a.order - b.order)
          .filter(layer => layer.visible)
          .map(layer => {
            // Skip rendering adjustment layers (they're invisible)
            if (layer.isAdjustmentLayer) {
              return null;
            }

            const adjustments = getAdjustmentsForLayer(layer.order);
            
            // Calculate approximate brightness adjustment using opacity and overlay
            // Note: This is a LIMITED approximation - for full filter support, use:
            // 1. Backend image processing (recommended for production)
            // 2. react-native-color-matrix-image-filters library
            // 3. expo-image-manipulator for preprocessing
            
            const contrastAdjusted = adjustments.contrast !== 0;
            
            return (
              <View key={layer.id} style={styles.canvasLayerImage}>
                {/* Base image */}
                <Image
                  source={{ uri: layer.imageUrl }}
                  style={[
                    styles.canvasLayerImage,
                    {
                      opacity: layer.opacity / 100,
                    }
                  ]}
                  resizeMode="contain"
                />
                
                {/* Brightness overlay - approximate effect */}
                {adjustments.brightness > 0 && (
                  <View
                    style={[
                      StyleSheet.absoluteFill,
                      {
                        backgroundColor: 'white',
                        opacity: (adjustments.brightness / 100) * 0.5, // Scaled down for subtle effect
                      }
                    ]}
                    pointerEvents="none"
                  />
                )}
                
                {adjustments.brightness < 0 && (
                  <View
                    style={[
                      StyleSheet.absoluteFill,
                      {
                        backgroundColor: 'black',
                        opacity: Math.abs(adjustments.brightness / 100) * 0.5, // Scaled down for subtle effect
                      }
                    ]}
                    pointerEvents="none"
                  />
                )}
                
                {/* Contrast indicator - visual feedback that adjustment is active */}
                {contrastAdjusted && (
                  <View
                    style={[
                      StyleSheet.absoluteFill,
                      {
                        backgroundColor: adjustments.contrast > 0 ? 'white' : 'gray',
                        opacity: Math.abs(adjustments.contrast / 100) * 0.1,
                      }
                    ]}
                    pointerEvents="none"
                  />
                )}
              </View>
            );
          })}
      </View>
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
        <TouchableOpacity 
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setLayersModalVisible(false)}
        />
        
        <Animated.View 
          style={[
            styles.layersSidebar, 
            { 
              backgroundColor: colors.background.primary,
              transform: [{ translateX: layersSidebarTranslateX }]
            }
          ]}
        >
          <View style={[styles.modalHeader, { borderBottomColor: colors.border.primary }]}>
            <View style={styles.modalHeaderLeft}>
              <View style={[styles.layersIconContainer, { backgroundColor: colors.background.secondary }]}>
                <LayersIcon size={20} color={colors.text.primary} />
              </View>
              <Text style={[styles.modalTitle, { color: colors.text.primary }]}>Layers</Text>
            </View>
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={() => setLayersModalVisible(false)}
            >
              <X size={24} color={colors.text.primary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.layersList} showsVerticalScrollIndicator={false}>
            {layers.length === 0 ? (
              <View style={styles.emptyLayersContainer}>
                <Text style={[styles.emptyLayersText, { color: colors.text.secondary }]}>
                  No layers yet. Upload an image to create layers.
                </Text>
              </View>
            ) : (
              layers
                .sort((a, b) => b.order - a.order)
                .map((layer, index) => (
                  <TouchableOpacity
                    key={layer.id}
                    style={[styles.layerItem, { 
                      backgroundColor: selectedLayerId === layer.id ? colors.background.secondary : 'transparent',
                      borderBottomColor: colors.border.primary,
                    }]}
                    onPress={() => {
                      if (selectedLayerId === layer.id) {
                        // If already selected, open settings
                        if (layer.isAdjustmentLayer) {
                          setTempAdjustments(layer.adjustments || {
                            brightness: 0,
                            contrast: 0,
                            saturation: 0,
                            hue: 0,
                            temperature: 0,
                            tint: 0
                          });
                          setAdjustmentLayerModalVisible(true);
                        } else {
                          setPropertiesModalVisible(true);
                        }
                      } else {
                        // First tap selects the layer
                        setSelectedLayerId(layer.id);
                      }
                    }}
                    onLongPress={() => {
                      const buttons: any[] = [
                        { text: "Move Up", onPress: () => moveLayerUp(layer.id) },
                        { text: "Move Down", onPress: () => moveLayerDown(layer.id) },
                      ];
                      
                      if (!layer.isAdjustmentLayer) {
                        buttons.push({ text: "Duplicate", onPress: () => duplicateLayer(layer.id) });
                      }
                      
                      buttons.push(
                        { text: "Delete", onPress: () => deleteLayer(layer.id), style: "destructive" },
                        { text: "Cancel", style: "cancel" }
                      );
                      
                      Alert.alert(
                        "Layer Actions",
                        `What would you like to do with ${layer.name}?`,
                        buttons
                      );
                    }}
                  >
                    <View style={styles.layerRowNumber}>
                      <Text style={[styles.layerNumber, { color: colors.text.primary }]}>
                        {index + 1}
                      </Text>
                    </View>
                    
                    {layer.isAdjustmentLayer ? (
                      <View style={[styles.layerThumbnail, { 
                        borderColor: colors.border.primary,
                        backgroundColor: colors.background.secondary,
                        justifyContent: 'center',
                        alignItems: 'center'
                      }]}>
                        <Settings size={24} color={colors.button.arclight} />
                      </View>
                    ) : (
                      <Image
                        source={{ uri: layer.imageUrl }}
                        style={[styles.layerThumbnail, { borderColor: colors.border.primary }]}
                        resizeMode="cover"
                      />
                    )}

                    <View style={styles.layerSpacer} />

                    <TouchableOpacity
                      onPress={() => toggleLayerVisibility(layer.id)}
                      style={styles.layerVisibilityButton}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      {layer.visible ? (
                        <Eye size={22} color={colors.text.primary} strokeWidth={2} />
                      ) : (
                        <EyeOff size={22} color={colors.text.secondary} strokeWidth={2} />
                      )}
                    </TouchableOpacity>

                    {selectedLayerId === layer.id && (
                      <TouchableOpacity
                        onPress={() => deleteLayer(layer.id)}
                        style={[styles.layerDeleteButton, { backgroundColor: colors.background.secondary }]}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Trash2 size={20} color="#EF4444" strokeWidth={2} />
                      </TouchableOpacity>
                    )}
                  </TouchableOpacity>
                ))
            )}
          </ScrollView>

          <TouchableOpacity
            style={[styles.addLayerButton, { 
              backgroundColor: colors.background.primary,
              borderTopColor: colors.border.primary 
            }]}
            onPress={() => {
              setLayersModalVisible(false);
              setAddLayerModalVisible(true);
            }}
          >
            <Plus size={32} color={colors.text.primary} strokeWidth={2.5} />
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
        <TouchableOpacity 
          style={styles.addLayerBackdrop}
          activeOpacity={1}
          onPress={() => setAddLayerModalVisible(false)}
        />

        <View style={styles.addLayerModalContent}>
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

          <TouchableOpacity
            style={styles.addLayerOptionContainer}
            onPress={() => {
              setAddLayerModalVisible(false);
              setAdjustmentLayerModalVisible(true);
            }}
          >
            <View style={[styles.addLayerCircle, { backgroundColor: colors.background.primary }]}>
              <Settings size={48} color={colors.text.primary} strokeWidth={1.5} />
            </View>
            <Text style={[styles.addLayerLabel, { color: '#FFFFFF' }]}>
              ADJUSTMENT{'\n'}LAYER
            </Text>
          </TouchableOpacity>

          <View style={styles.addLayerBottomActions}>
            <TouchableOpacity
              style={[styles.addLayerCloseButton, { backgroundColor: colors.background.secondary }]}
              onPress={() => setAddLayerModalVisible(false)}
            >
              <X size={32} color={colors.text.primary} strokeWidth={2} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const renderAdjustmentLayerModal = () => {
    const getAdjustmentValue = () => {
      return tempAdjustments[activeAdjustment];
    };
    
    const setAdjustmentValue = (value: number) => {
      setTempAdjustments(prev => ({ ...prev, [activeAdjustment]: value }));
    };
    
    const getAdjustmentLabel = () => {
      return activeAdjustment.toUpperCase();
    };
    
    return (
      <Modal
        visible={adjustmentLayerModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setAdjustmentLayerModalVisible(false)}
      >
        <View style={styles.propertiesModalOverlay}>
          <TouchableOpacity 
            style={styles.propertiesBackdrop}
            activeOpacity={1}
            onPress={() => setAdjustmentLayerModalVisible(false)}
          />
          
          <View style={[styles.adjustmentModalPanel, { backgroundColor: colors.background.primary }]}>
            {/* Top Action Buttons */}
            <View style={styles.adjustmentTopActions}>
              <TouchableOpacity
                style={styles.adjustmentTopButton}
                onPress={() => {
                  setTempAdjustments({
                    brightness: 0,
                    contrast: 0,
                    saturation: 0,
                    hue: 0,
                    temperature: 0,
                    tint: 0
                  });
                  setSelectedLayerId(null);
                  setAdjustmentLayerModalVisible(false);
                }}
              >
                <X size={28} color={colors.text.primary} strokeWidth={2.5} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.adjustmentTopButton}
                onPress={async () => {
                  if (selectedLayerId && layers.find(l => l.id === selectedLayerId && l.isAdjustmentLayer)) {
                    // Update existing adjustment layer
                    const updatedLayers = layers.map(l => 
                      l.id === selectedLayerId ? { ...l, adjustments: { ...tempAdjustments } } : l
                    );
                    setLayers(updatedLayers);
                    
                    // Save to AsyncStorage
                    if (projectId) {
                      await saveAdjustmentLayers(projectId, updatedLayers.filter(l => l.isAdjustmentLayer));
                    }
                    
                    setTempAdjustments({
                      brightness: 0,
                      contrast: 0,
                      saturation: 0,
                      hue: 0,
                      temperature: 0,
                      tint: 0
                    });
                    setSelectedLayerId(null);
                    setAdjustmentLayerModalVisible(false);
                    showAlert('success', 'Updated', 'Adjustment layer updated successfully');
                  } else {
                    // Create new adjustment layer
                    await createAdjustmentLayer();
                  }
                }}
                disabled={processing}
              >
                <Text style={[styles.checkmarkIcon, { color: colors.text.primary }]}>✓</Text>
              </TouchableOpacity>
            </View>

            {/* Slider Section */}
            <View style={styles.adjustmentSliderSection}>
              <Text style={[styles.adjustmentLabel, { color: colors.text.primary }]}>
                {getAdjustmentLabel()}
              </Text>
              
              <View style={styles.adjustmentSliderContainer}>
                <Text style={[styles.adjustmentRangeLabel, { color: colors.text.secondary }]}>-50</Text>
                
                <View style={styles.adjustmentSliderTrack}>
                  <View style={[styles.adjustmentSliderTrackBg, { backgroundColor: colors.border.primary }]} />
                  <View 
                    style={[
                      styles.adjustmentSliderFill,
                      { 
                        width: `${((getAdjustmentValue() + 50) / 100) * 100}%`,
                        backgroundColor: colors.text.primary
                      }
                    ]}
                  />
                  <View 
                    style={[
                      styles.adjustmentSliderThumb,
                      {
                        left: `${((getAdjustmentValue() + 50) / 100) * 100}%`,
                        backgroundColor: colors.text.primary
                      }
                    ]}
                  />
                </View>
                
                <Text style={[styles.adjustmentRangeLabel, { color: colors.text.secondary }]}>50</Text>
              </View>
              
              {/* Slider Controls */}
              <View style={styles.sliderControls}>
                <TouchableOpacity
                  style={[styles.sliderControlButton, { backgroundColor: colors.background.secondary }]}
                  onPress={() => setAdjustmentValue(Math.max(-50, getAdjustmentValue() - 5))}
                >
                  <Text style={{ color: colors.text.primary, fontSize: 20, fontWeight: '700' }}>-</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.sliderControlButton, { backgroundColor: colors.background.secondary }]}
                  onPress={() => setAdjustmentValue(Math.min(50, getAdjustmentValue() + 5))}
                >
                  <Text style={{ color: colors.text.primary, fontSize: 20, fontWeight: '700' }}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Bottom Action Buttons */}
            <View style={styles.adjustmentBottomActions}>
              <TouchableOpacity
                style={[
                  styles.adjustmentCircleButton,
                  { backgroundColor: activeAdjustment === 'brightness' ? colors.text.primary : colors.background.secondary },
                ]}
                onPress={() => setActiveAdjustment('brightness')}
              >
                <View style={[
                  styles.brightnessIcon,
                  { borderColor: activeAdjustment === 'brightness' ? colors.background.primary : colors.text.primary }
                ]} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.adjustmentCircleButton,
                  { backgroundColor: activeAdjustment === 'saturation' ? colors.text.primary : colors.background.secondary },
                ]}
                onPress={() => setActiveAdjustment('saturation')}
              >
                <View style={[
                  styles.saturationIcon,
                  { backgroundColor: activeAdjustment === 'saturation' ? colors.background.primary : colors.text.primary }
                ]} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.adjustmentCircleButton,
                  { backgroundColor: activeAdjustment === 'contrast' ? colors.text.primary : colors.background.secondary },
                ]}
                onPress={() => setActiveAdjustment('contrast')}
              >
                <View style={styles.contrastIcon}>
                  <View style={[
                    styles.contrastHalf,
                    { backgroundColor: activeAdjustment === 'contrast' ? colors.background.primary : colors.text.primary }
                  ]} />
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  const renderPropertiesPanel = () => {
    const selectedLayer = layers.find(l => l.id === selectedLayerId);
    if (!selectedLayer || !propertiesModalVisible) return null;

    return (
      <Modal
        visible={propertiesModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setPropertiesModalVisible(false)}
      >
        <View style={styles.propertiesModalOverlay}>
          <TouchableOpacity 
            style={styles.propertiesBackdrop}
            activeOpacity={1}
            onPress={() => setPropertiesModalVisible(false)}
          />
          
          <View style={[styles.propertiesPanel, { backgroundColor: colors.background.primary }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border.primary }]}>
              <Text style={[styles.modalTitle, { color: colors.text.primary }]}>
                {selectedLayer.name} Properties
              </Text>
              <TouchableOpacity onPress={() => setPropertiesModalVisible(false)}>
                <X size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.propertiesContent}>
              <View style={styles.propertyGroup}>
                <Text style={[styles.propertyLabel, { color: colors.text.primary }]}>
                  Opacity: {selectedLayer.opacity}%
                </Text>
                <View style={styles.opacityControl}>
                  <TouchableOpacity
                    style={[styles.opacityButton, { backgroundColor: colors.background.secondary }]}
                    onPress={() => {
                      const newOpacity = Math.max(0, selectedLayer.opacity - 10);
                      updateLayerOpacity(selectedLayer.id, newOpacity);
                    }}
                  >
                    <Text style={{ color: colors.text.primary, fontSize: 18 }}>-</Text>
                  </TouchableOpacity>
                  <View style={styles.opacityBarContainer}>
                    <View 
                      style={[
                        styles.opacityBar, 
                        { 
                          width: `${selectedLayer.opacity}%`,
                          backgroundColor: colors.button.arclight
                        }
                      ]} 
                    />
                  </View>
                  <TouchableOpacity
                    style={[styles.opacityButton, { backgroundColor: colors.background.secondary }]}
                    onPress={() => {
                      const newOpacity = Math.min(100, selectedLayer.opacity + 10);
                      updateLayerOpacity(selectedLayer.id, newOpacity);
                    }}
                  >
                    <Text style={{ color: colors.text.primary, fontSize: 18 }}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.propertyGroup}>
                <Text style={[styles.propertyLabel, { color: colors.text.primary }]}>
                  Layer Type: {selectedLayer.type}
                </Text>
              </View>

              <View style={styles.propertyGroup}>
                <Text style={[styles.propertyLabel, { color: colors.text.primary }]}>
                  Blend Mode: {selectedLayer.blendMode}
                </Text>
              </View>

              <View style={styles.propertyGroup}>
                <Text style={[styles.propertyLabel, { color: colors.text.primary }]}>
                  Position: ({selectedLayer.position.x}, {selectedLayer.position.y})
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  const renderAutoEnhanceModal = () => (
    <Modal
      visible={autoEnhanceModalVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setAutoEnhanceModalVisible(false)}
    >
      <View style={styles.propertiesModalOverlay}>
        <TouchableOpacity 
          style={styles.propertiesBackdrop}
          activeOpacity={1}
          onPress={() => setAutoEnhanceModalVisible(false)}
        />
        
        <View style={[styles.propertiesPanel, { backgroundColor: colors.background.primary }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border.primary }]}>
            <Text style={[styles.modalTitle, { color: colors.text.primary }]}>✨ Auto-Enhancement</Text>
            <TouchableOpacity onPress={() => setAutoEnhanceModalVisible(false)}>
              <X size={24} color={colors.text.primary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.propertiesContent} showsVerticalScrollIndicator={false}>
            {enhancementAnalysis && (
              <View>
                <View style={[styles.qualityBadge, { 
                  backgroundColor: enhancementAnalysis.analysis.overall_quality === 'good' ? '#10B981' :
                                   enhancementAnalysis.analysis.overall_quality === 'fair' ? '#F59E0B' : '#EF4444'
                }]}>
                  <Text style={styles.qualityBadgeText}>
                    Quality: {enhancementAnalysis.analysis.overall_quality.toUpperCase()}
                  </Text>
                </View>

                <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
                  Recommended Enhancements
                </Text>
                <Text style={[styles.sectionSubtitle, { color: colors.text.secondary }]}>
                  Apply in this order for best results:
                </Text>

                {enhancementAnalysis.recommendations.enhancement_details.map((detail: any, index: number) => (
                  <View 
                    key={index}
                    style={[styles.enhancementItem, { 
                      backgroundColor: colors.background.secondary,
                      borderLeftColor: getSeverityColor(detail.severity)
                    }]}
                  >
                    <View style={styles.enhancementHeader}>
                      <View style={[styles.stepBadge, { backgroundColor: colors.button.arclight }]}>
                        <Text style={styles.stepBadgeText}>{index + 1}</Text>
                      </View>
                      <Text style={[styles.enhancementName, { color: colors.text.primary }]}>
                        {formatEnhancementName(detail.type)}
                      </Text>
                    </View>
                    <View style={[styles.severityBadge, { backgroundColor: getSeverityColor(detail.severity) }]}>
                      <Text style={styles.severityBadgeText}>{detail.severity}</Text>
                    </View>
                  </View>
                ))}

                <View style={styles.enhancementNote}>
                  <Text style={[styles.noteText, { color: colors.text.secondary }]}>
                    💡 These enhancements can be applied in the Labspace for AI sequential editing.
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>

          <View style={[styles.modalActions, { borderTopColor: colors.border.primary }]}>
            <TouchableOpacity
              style={[styles.modalActionButton, styles.modalActionButtonSecondary, { 
                backgroundColor: colors.background.secondary,
                borderColor: colors.border.primary,
                borderWidth: 1
              }]}
              onPress={() => setAutoEnhanceModalVisible(false)}
              disabled={applyingEnhancements}
            >
              <Text style={[styles.modalActionText, { color: colors.text.primary }]}>Close</Text>
            </TouchableOpacity>
            
            {enhancementAnalysis?.analysis?.needs_enhancement && 
             enhancementAnalysis?.analysis?.priority_order?.length > 0 && (
              <TouchableOpacity
                style={[styles.modalActionButton, { 
                  backgroundColor: colors.button.arclight,
                  opacity: applyingEnhancements ? 0.6 : 1
                }]}
                onPress={handleApplyEnhancements}
                disabled={applyingEnhancements}
              >
                <Text style={[styles.modalActionText, { color: '#FFFFFF' }]}>
                  {applyingEnhancements ? 'Applying...' : 'Apply'}
                </Text>
              </TouchableOpacity>
            )}
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

      <View style={styles.content}>
        <View style={[styles.canvasContainer, { 
          height: CANVAS_HEIGHT,
          backgroundColor: colors.background.secondary,
          borderColor: colors.border.primary 
        }]}>
          {renderCanvas()}
        </View>

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

      <View style={[styles.bottomBar, { backgroundColor: isDark ? colors.background.dark : colors.background.cream }]}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.background.secondary }]}
          onPress={() => setLayersModalVisible(true)}
          disabled={!projectCreated}
        >
          <LayersIcon size={24} color={projectCreated ? colors.text.primary : colors.text.tertiary} />
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.background.secondary }]}
          onPress={handleAutoEnhance}
          disabled={!projectCreated || layers.length === 0}
        >
          <Sparkles size={24} color={projectCreated && layers.length > 0 ? colors.button.arclight : colors.text.tertiary} />
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.background.secondary }]}
          onPress={handleBackgroundHarmonization}
          disabled={!projectCreated || layers.length < 2 || harmonizingBackground}
        >
          <Palette size={24} color={projectCreated && layers.length >= 2 && !harmonizingBackground ? colors.button.arclight : colors.text.tertiary} />
        </TouchableOpacity>
      </View>

      <Sidebar />
      {renderLayersModal()}
      {renderAddLayerModal()}
      {renderAdjustmentLayerModal()}
      {renderPropertiesPanel()}
      {renderAutoEnhanceModal()}

      {/* UPLOAD OPTIONS OVERLAY - FULL SCREEN */}
      <Modal
        visible={uploadOptionsVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setUploadOptionsVisible(false)}
      >
        <View style={styles.uploadOverlay}>
          {/* Dashed Border Container */}
          <View style={styles.uploadDashedContainer}>
            {/* Gallery Button */}
            <TouchableOpacity
              style={styles.uploadCircleButtonWrapper}
              onPress={handleGalleryFromModal}
              activeOpacity={0.8}
            >
              <View style={styles.uploadIconCircle}>
                <Upload size={48} color="#1a1a1a" strokeWidth={1.5} />
              </View>
              <Text style={styles.uploadButtonLabel}>UPLOAD</Text>
              <Text style={styles.uploadButtonLabel}>FROM</Text>
              <Text style={styles.uploadButtonLabel}>GALLERY</Text>
            </TouchableOpacity>

            {/* Camera Button */}
            <TouchableOpacity
              style={styles.uploadCircleButtonWrapper}
              onPress={handleCameraFromModal}
              activeOpacity={0.8}
            >
              <View style={styles.uploadIconCircle}>
                <Camera size={48} color="#1a1a1a" strokeWidth={1.5} />
              </View>
              <Text style={styles.uploadButtonLabel}>TAKE</Text>
              <Text style={styles.uploadButtonLabel}>PHOTO</Text>
            </TouchableOpacity>
          </View>

          {/* Close Button at Bottom Center */}
          <TouchableOpacity
            style={styles.uploadCloseButton}
            onPress={() => {
              setUploadOptionsVisible(false);
            }}
            activeOpacity={0.7}
          >
            <X size={32} color="#FFFFFF" strokeWidth={2.5} />
          </TouchableOpacity>
        </View>
      </Modal>

      {uploading && (
        <View style={[styles.loadingOverlay, { backgroundColor: colors.background.overlayTransparent }]}>
          <Loader size={160} />
          <Text style={[styles.loadingText, { color: colors.text.light }]}>
            Fun fact: {getRandomFunFact()}
          </Text>
        </View>
      )}

      {processing && (
        <View style={[styles.loadingOverlay, { backgroundColor: colors.background.overlayTransparent }]}>
          <Loader size={160} />
          <Text style={[styles.loadingText, { color: colors.text.light }]}>
            Fun fact: {getRandomFunFact()}
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
  blankCanvas: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 16,
    position: 'relative',
  },
  uploadingIndicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 16,
    gap: 12,
  },
  uploadingText: {
    fontSize: 12,
    fontWeight: '600',
  },
  canvasImageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  canvasLayerImage: {
    position: 'absolute',
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
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  layersIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
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
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
  },
  layerRowNumber: {
    width: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  layerNumber: {
    fontSize: 16,
    fontWeight: '600',
  },
  layerThumbnail: {
    width: 56,
    height: 56,
    borderRadius: 8,
    borderWidth: 1,
  },
  layerSpacer: {
    flex: 1,
  },
  layerVisibilityButton: {
    padding: 8,
    marginLeft: 8,
  },
  layerDeleteButton: {
    padding: 8,
    marginLeft: 4,
    borderRadius: 6,
  },
  layerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  layerInfo: {
    flex: 1,
  },
  layerName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  layerType: {
    fontSize: 12,
  },
  layerActions: {
    flexDirection: 'row',
    gap: 4,
  },
  layerActionButton: {
    padding: 6,
  },
  addLayerButton: {
    height: 70,
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
  addLayerCloseButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  propertiesModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  propertiesBackdrop: {
    flex: 1,
  },
  propertiesPanel: {
    height: SCREEN_HEIGHT * 0.5,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  propertiesContent: {
    flex: 1,
    padding: 20,
  },
  propertyGroup: {
    marginBottom: 24,
  },
  propertyLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  sliderContainer: {
    paddingVertical: 8,
  },
  opacityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  opacityButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  opacityBarContainer: {
    flex: 1,
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  opacityBar: {
    height: '100%',
    borderRadius: 4,
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
  adjustmentActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    alignItems: 'center',
  },
  adjustmentActionButton: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adjustmentActionText: {
    fontSize: 16,
    fontWeight: '600',
  },
  adjustmentModalPanel: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 24,
    paddingBottom: 40,
    paddingHorizontal: 24,
  },
  adjustmentTopActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 40,
  },
  adjustmentTopButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkIcon: {
    fontSize: 32,
    fontWeight: '700',
  },
  adjustmentSliderSection: {
    marginBottom: 50,
  },
  adjustmentLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    textAlign: 'center',
    marginBottom: 24,
  },
  adjustmentSliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  sliderControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 16,
  },
  sliderControlButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  adjustmentRangeLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  adjustmentSliderTrack: {
    flex: 1,
    height: 4,
    position: 'relative',
  },
  adjustmentSliderTrackBg: {
    position: 'absolute',
    width: '100%',
    height: 4,
    borderRadius: 2,
  },
  adjustmentSliderFill: {
    position: 'absolute',
    height: 4,
    borderRadius: 2,
  },
  adjustmentSliderThumb: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    top: -8,
    marginLeft: -10,
  },
  adjustmentBottomActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
  },
  adjustmentCircleButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  brightnessIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 3,
  },
  saturationIcon: {
    width: 20,
    height: 28,
    borderRadius: 10,
  },
  contrastIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
  },
  contrastHalf: {
    width: 14,
    height: 28,
  },
  qualityBadge: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 20,
    alignItems: 'center',
  },
  qualityBadgeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    marginBottom: 16,
  },
  enhancementItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderLeftWidth: 4,
  },
  enhancementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stepBadgeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  enhancementName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  severityBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  severityBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  enhancementNote: {
    padding: 16,
    borderRadius: 8,
    marginTop: 8,
  },
  noteText: {
    fontSize: 13,
    lineHeight: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
  },
  modalActionButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalActionButtonSecondary: {
    // Secondary button styles (for Close button)
  },
  modalActionText: {
    fontSize: 16,
    fontWeight: '600',
  },
  adjustmentBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    gap: 8,
  },
  adjustmentBannerText: {
    fontSize: 12,
    fontWeight: '500',
  },
  adjustmentInfoBanner: {
    padding: 12,
    marginBottom: 16,
    borderRadius: 8,
    borderLeftWidth: 3,
  },
  adjustmentInfoText: {
    fontSize: 12,
    lineHeight: 18,
  },
  // ============================================================
  // UPLOAD OPTIONS OVERLAY STYLES - FULL SCREEN
  // ============================================================
  uploadOverlay: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  uploadDashedContainer: {
    width: '100%',
    aspectRatio: 0.65,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#3a3a3a',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
    gap: 24,
  },
  uploadCircleButtonWrapper: {
    alignItems: 'center',
    gap: 12,
  },
  uploadIconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#E8E8E8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadButtonLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1.5,
    textAlign: 'center',
    lineHeight: 18,
  },
  uploadCloseButton: {
    position: 'absolute',
    bottom: 60,
    alignSelf: 'center',
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
});
