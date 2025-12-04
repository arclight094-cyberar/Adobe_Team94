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
  PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Share2, Mic, Send, Sliders, Plus, ImageIcon, Camera, X, Upload, Trash2, XCircle } from 'lucide-react-native';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';
import LightingModal from '../../components/LightingModal';
import FilterToolsMenu from '../../components/FilterToolsMenu';
import ArclightEngineButton from '../../components/ArclightEngineButton';
import LiveGLShader from '../../components/LiveGLShader';
import Loader from '../../components/Loader';
import History from './history'; // Import History component
import { useSidebar } from '../../context/SideBarContext';
import { useTheme } from '../../context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from '../../services/api';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Sharing from 'expo-sharing';
import * as ImagePicker from 'expo-image-picker';
import { useAlert } from '../../hooks/useAlert';
import CustomAlert from '../../components/CustomAlert';
import { getRandomFunFact } from '../../utils/funFacts';

import {
  FilterValues,
  defaultFilterValues,
} from '../../utils/filters';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;
const CANVAS_HEIGHT = SCREEN_HEIGHT * 0.5; // Half the screen height

// LogoIcon is now handled by Navbar component



// ============================================================
// GPU-ACCELERATED FILTERED IMAGE COMPONENT
// Using gl-react and GLSL shaders for real-time GPU rendering
// All filters run on GPU - works in Expo Go without native modules
// ============================================================
interface FilteredImageProps {
  uri: string;
  filterValues: FilterValues;
  style?: any;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center';
}

const FilteredImage: React.FC<FilteredImageProps> = ({
  uri,
  filterValues,
  style,
  resizeMode = 'contain',
}) => {
  // Get dimensions from style or use defaults
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  
  return (
    <View 
      style={[style, { overflow: 'hidden' }]}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setDimensions({ width, height });
      }}
    >
      {dimensions.width > 0 && dimensions.height > 0 && (
        <LiveGLShader
          imageUri={uri}
          filters={filterValues}
          width={dimensions.width}
          height={dimensions.height}
          style={{ width: '100%', height: '100%' }}
        />
      )}
    </View>
  );
};

export default function Workspace() {
  // ============================================================
  // STATE MANAGEMENT
  // ============================================================
  const { colors, isDark } = useTheme();
  const { alertState, showAlert, hideAlert } = useAlert();
  const [activeTab, setActiveTab] = useState<'workspace' | 'history'>('workspace');
  const [historyKey, setHistoryKey] = useState(0); // Key to force History refresh
  const { openSidebar } = useSidebar();
  const [promptText, setPromptText] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [originalImageUri, setOriginalImageUri] = useState<string | null>(null); // Store original uploaded image
  const [publicId, setPublicId] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null); // Store project ID
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string>('');
  const [uploadOptionsVisible, setUploadOptionsVisible] = useState(false);
  const [filterMenuVisible, setFilterMenuVisible] = useState(false);
  const [arclightEngineVisible, setArclightEngineVisible] = useState(false);
  const [filterValues, setFilterValues] = useState<FilterValues>(defaultFilterValues);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number; aspectRatio: number } | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [loadingProjectImage, setLoadingProjectImage] = useState(false); // Loading state for fetching project image
  const [canScroll, setCanScroll] = useState(false);
  const [showingOriginal, setShowingOriginal] = useState(false); // Track if showing original or updated
  const [objectRemovalMode, setObjectRemovalMode] = useState(false); // Track if in object removal mode
  const [objectRemovalMarker, setObjectRemovalMarker] = useState<{ x: number; y: number } | null>(null); // Red dot marker position
  const [styleTransferMode, setStyleTransferMode] = useState(false); // Track if waiting for reference image
  const [referenceImageUri, setReferenceImageUri] = useState<string | null>(null); // Reference image URI
  const [referenceImagePublicId, setReferenceImagePublicId] = useState<string | null>(null); // Reference image publicId
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false); // Confirmation modal state
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollViewHeight = useRef(0);
  const contentHeight = useRef(0);
  const inputBottomOffset = useRef(new Animated.Value(0)).current;
  const swipeX = useRef(new Animated.Value(0)).current;
  const imageContainerRef = useRef<View>(null);
  const [containerLayout, setContainerLayout] = useState<{ width: number; height: number; x: number; y: number } | null>(null);


  // ============================================================
  // LOAD PROJECT ID ON MOUNT
  // ============================================================
  useEffect(() => {
    const loadProjectId = async () => {
      const storedProjectId = await AsyncStorage.getItem('current_project_id');
      if (storedProjectId) {
        setProjectId(storedProjectId);
      }
    };
    loadProjectId();
  }, []);

  // ============================================================
  // KEYBOARD EVENT LISTENERS
  // ============================================================
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (event) => {
        setKeyboardVisible(true);
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
        setKeyboardVisible(false);
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
  // SWIPE GESTURE HANDLER
  // ============================================================
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only respond to horizontal swipes
        return Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 10;
      },
      onPanResponderMove: (_, gestureState) => {
        // Limit swipe to screen width
        const maxSwipe = SCREEN_WIDTH;
        const newX = Math.max(-maxSwipe, Math.min(maxSwipe, gestureState.dx));
        swipeX.setValue(newX);
      },
      onPanResponderRelease: (_, gestureState) => {
        const swipeThreshold = SCREEN_WIDTH * 0.3;
        
        if (gestureState.dx > swipeThreshold && activeTab === 'history') {
          // Swipe right from history -> go to workspace
          setActiveTab('workspace');
        } else if (gestureState.dx < -swipeThreshold && activeTab === 'workspace') {
          // Swipe left from workspace -> go to history
          handleTabChange('history');
        }
        
        // Reset animation
        Animated.spring(swipeX, {
          toValue: 0,
          useNativeDriver: true,
          tension: 50,
          friction: 7,
        }).start();
      },
    })
  ).current;

  // ============================================================
  // HANDLE TAB CHANGE
  // ============================================================
  const handleTabChange = (tab: 'workspace' | 'history') => {
    setActiveTab(tab);
    if (tab === 'history') {
      // Increment history key to trigger refresh
      setHistoryKey(prev => prev + 1);
    }
  };

  // ============================================================
  // ADD OPERATION TO HISTORY
  // ============================================================
  const addOperationToHistory = async (
    operationType: string,
    prompt: any,
    inputImageData: { imageUrl: string; publicId: string; width?: number; height?: number },
    outputImageData: { imageUrl: string; publicId: string; width?: number; height?: number }
  ) => {
    try {
      const currentProjectId = projectId || await AsyncStorage.getItem('current_project_id');
      
      if (!currentProjectId) {
        console.log('No project ID found, skipping history recording');
        return;
      }

      console.log('=== Recording Operation to History ===');
      console.log('Project ID:', currentProjectId);
      console.log('Operation Type:', operationType);
      console.log('Prompt:', prompt);

      const result = await ApiService.addAIProjectOperation(currentProjectId, {
        operationType,
        prompt,
        inputImage: inputImageData,
        outputImage: outputImageData,
        status: 'completed',
      });

      if (result.response.ok && result.data.success) {
        console.log('✅ Operation recorded to history');
        // Increment history key to trigger refresh when user switches to history tab
        setHistoryKey(prev => prev + 1);
      } else {
        console.error('Failed to record operation:', result.data.message);
      }
    } catch (error: any) {
      console.error('Error recording operation to history:', error);
    }
  };

  // ============================================================
  // HANDLE REVERT TO OPERATION (callback from History)
  // ============================================================
  const handleRevertToOperation = async (operationIndex: number, imageData: { imageUrl: string; publicId: string }) => {
    // Update workspace with reverted image
    setImageUri(imageData.imageUrl);
    setPublicId(imageData.publicId);
    setShowingOriginal(false);
    setFilterValues(defaultFilterValues);
    
    // Switch to workspace tab
    setActiveTab('workspace');
  };

  // ============================================================
  // HANDLE UNDO LAST (callback from History)
  // ============================================================
  const handleUndoLast = async () => {
    // Reload current image from AsyncStorage
    const currentImageUri = await AsyncStorage.getItem('selected_image_uri');
    const currentPublicId = await AsyncStorage.getItem('current_public_id');
    
    if (currentImageUri) {
      setImageUri(currentImageUri);
    }
    if (currentPublicId) {
      setPublicId(currentPublicId);
    }
    setShowingOriginal(false);
    setFilterValues(defaultFilterValues);
  };

  // ============================================================
  // LOAD IMAGE FROM EXISTING PROJECT (ONLY IF PROJECT HAS IMAGES)
  // For new projects: blank canvas
  // For existing projects opened from gallery: load most recent image
  // ============================================================
  useEffect(() => {
    const loadProjectImageIfExists = async () => {
      try {
        const storedProjectId = await AsyncStorage.getItem('current_project_id');
        const projectType = await AsyncStorage.getItem('project_type') as 'layer-based' | 'ai-sequential' | null;
        
        if (!storedProjectId || !projectType) {
          console.log('No project found, starting with blank canvas');
          setLoadingProjectImage(false);
          return;
        }

        setProjectId(storedProjectId);

        // Only load image for AI sequential projects (labspace)
        // Check if project already has images by fetching project details
        if (projectType === 'ai-sequential') {
          setLoadingProjectImage(true); // Show loader while fetching
          try {
            const projectDetails = await ApiService.getAIProjectDetails(storedProjectId);
            
            if (projectDetails.response.ok && projectDetails.data.success) {
              const currentImage = projectDetails.data.data?.currentImage;
              
              // Only load image if project already has a currentImage
              // New projects won't have currentImage, so they stay blank
              if (currentImage?.imageUrl && currentImage?.publicId) {
                console.log('Loading current image from existing project:', currentImage.imageUrl);
                setImageUri(currentImage.imageUrl);
                setOriginalImageUri(currentImage.imageUrl);
                setPublicId(currentImage.publicId);
                
                // Update AsyncStorage to keep it in sync
                await AsyncStorage.setItem('selected_image_uri', currentImage.imageUrl);
                await AsyncStorage.setItem('current_public_id', currentImage.publicId);
              } else {
                console.log('Project exists but has no images yet, starting with blank canvas');
              }
            }
          } catch (error: any) {
            console.error('Error fetching project details:', error);
            // Silently fail - user can upload new image
          } finally {
            setLoadingProjectImage(false); // Hide loader
          }
        } else {
          setLoadingProjectImage(false);
        }
      } catch (error: any) {
        console.error('Error loading project image:', error);
        setLoadingProjectImage(false);
        // Silently fail - user can upload new image
      }
    };

    loadProjectImageIfExists();
  }, []); // Run once on mount

  // ============================================================
  // GET IMAGE DIMENSIONS
  // ============================================================
  useEffect(() => {
    if (imageUri) {
      setImageLoading(true);
      Image.getSize(
        imageUri,
        (width, height) => {
          const aspectRatio = width / height;
          setImageDimensions({ width, height, aspectRatio });
          setImageLoading(false);
        },
        (error) => {
          console.error('Error getting image size:', error);
          setImageDimensions({ width: 1920, height: 1080, aspectRatio: 16 / 9 });
          setImageLoading(false);
        }
      );
    } else {
      // No image - reset loading state and dimensions
      setImageLoading(false);
      setImageDimensions(null);
    }
  }, [imageUri]);

  // ============================================================
  // HANDLE IMAGE SELECTION AND UPLOAD
  // ============================================================
  const handleImageSelected = async (uri: string, source: 'gallery' | 'camera') => {
    try {
      setUploading(true);
      setUploadMessage('Connecting to server...');
      
      // Get projectId and projectType from AsyncStorage
      const storedProjectId = await AsyncStorage.getItem('current_project_id');
      const projectType = await AsyncStorage.getItem('project_type') as 'layer-based' | 'ai-sequential' | null;

      if (!storedProjectId) {
        throw new Error('No project found. Please create a project first.');
      }

      if (!projectType) {
        throw new Error('Project type not found. Please create a project first.');
      }

      setProjectId(storedProjectId);

      console.log(`Uploading image from ${source}...`);
      console.log('Project ID:', storedProjectId);
      console.log('Project Type:', projectType);
      
      // Upload image to backend with projectId and projectType
      // Pass callback to update loading message during retries
      setUploadMessage('Uploading image...');
      const uploadResult = await ApiService.uploadImage(uri, storedProjectId, projectType, (attempt, maxRetries, message) => {
        if (attempt < maxRetries) {
          setUploadMessage(`Uploading image `);
        } else {
          setUploadMessage(message || 'Uploading image...');
        }
      });
      
      if (!uploadResult.response.ok || !uploadResult.data.success) {
        throw new Error(uploadResult.data.message || 'Failed to upload image');
      }

      const imageData = uploadResult.data.data.image;
      const { publicId: newPublicId, imageUrl } = imageData;
      console.log('Image uploaded successfully. PublicId:', newPublicId);
      console.log('Cloudinary imageUrl:', imageUrl);

      // Store Cloudinary image URL for workspace
      const cloudinaryImageUrl = imageUrl || uri;
      setImageUri(cloudinaryImageUrl);
      setOriginalImageUri(cloudinaryImageUrl); // Store original image when first uploaded
      setPublicId(newPublicId);
      setShowingOriginal(false); // Reset to showing updated image
      await AsyncStorage.setItem('selected_image_uri', cloudinaryImageUrl);
      await AsyncStorage.setItem('current_public_id', newPublicId);
      
      // Clear reference image when new base image is uploaded
      setReferenceImageUri(null);
      setReferenceImagePublicId(null);
      
      // Reset filters when new image is loaded
      setFilterValues(defaultFilterValues);

      // Increment history key to refresh history with new original image
      setHistoryKey(prev => prev + 1);
    } catch (error: any) {
      console.error('Error uploading image:', error);
      showAlert(
        'error',
        'Upload Failed',
        error.message || 'Failed to upload image. Please try again.'
      );
    } finally {
      setUploading(false);
      setUploadMessage('');
    }
  };

  // ===================== GALLERY =====================
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
      console.log("Selected from Gallery:", uri);
      await handleImageSelected(uri, 'gallery');
    }
  };

  // ===================== CAMERA =====================
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
      console.log("Captured from Camera:", uri);
      await handleImageSelected(uri, 'camera');
    }
  };

  // ===================== SHOW UPLOAD OPTIONS =====================
  const showUploadOptions = () => {
    setUploadOptionsVisible(true);
  };

  // ===================== HANDLE GALLERY FROM MODAL =====================
  const handleGalleryFromModal = async () => {
    setUploadOptionsVisible(false);
    if (styleTransferMode) {
      // In style transfer mode, use reference image handler
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showAlert('error', 'Permission Denied', 'Gallery access is required.');
        setStyleTransferMode(false);
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 1,
      });
      if (!result.canceled) {
        await handleReferenceImageSelected(result.assets[0].uri, 'gallery');
      } else {
        setStyleTransferMode(false);
      }
    } else {
      await openGallery();
    }
  };

  // ===================== HANDLE CAMERA FROM MODAL =====================
  const handleCameraFromModal = async () => {
    setUploadOptionsVisible(false);
    if (styleTransferMode) {
      // In style transfer mode, use reference image handler
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        showAlert('error', 'Permission Denied', 'Camera access is required.');
        setStyleTransferMode(false);
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 1,
      });
      if (!result.canceled) {
        await handleReferenceImageSelected(result.assets[0].uri, 'camera');
      } else {
        setStyleTransferMode(false);
      }
    } else {
      await openCamera();
    }
  };

  // ============================================================
  // HANDLE FILTER CHANGE
  // ============================================================
  const handleFilterChange = (filterId: keyof FilterValues, value: number) => {
    setFilterValues(prev => ({
      ...prev,
      [filterId]: value,
    }));
  };

  // ============================================================
  // ENHANCE IMAGE FUNCTION
  // ============================================================
  const handleEnhanceImage = async (mode: 'denoise' | 'deblur') => {
    if (!publicId) {
      showAlert(
        'warning',
        'No Image Selected',
        'Please upload an image first before using the enhance feature.'
      );
      return;
    }

    // Store input image data before operation
    const inputImageData = {
      imageUrl: imageUri || '',
      publicId: publicId,
      width: imageDimensions?.width,
      height: imageDimensions?.height,
    };

    setIsEnhancing(true);

    try {
      const enhanceResult = await ApiService.enhanceImage(publicId, mode);

      if (!enhanceResult.response.ok) {
        const errorMessage = enhanceResult.data?.message ||
          enhanceResult.data?.error?.message ||
          `Server error: ${enhanceResult.response.status} ${enhanceResult.response.statusText}`;
        throw new Error(errorMessage);
      }

      if (enhanceResult.data?.status === 'fail' || enhanceResult.data?.status === 'error') {
        const errorMessage = enhanceResult.data?.message ||
          enhanceResult.data?.error?.message ||
          'Failed to enhance image';
        throw new Error(errorMessage);
      }

      if (enhanceResult.data.success === false) {
        const errorMessage = enhanceResult.data?.message ||
          enhanceResult.data?.error?.message ||
          'Failed to enhance image';
        throw new Error(errorMessage);
      }

      const responseData = enhanceResult.data.data;

      if (!responseData) {
        throw new Error('Invalid response: missing data field');
      }

      const enhancedImageUrl = responseData.enhancedImageUrl;
      const enhancedPublicId = responseData.publicId;

      if (!enhancedImageUrl) {
        throw new Error('Invalid response: missing enhancedImageUrl');
      }
      if (!enhancedPublicId) {
        throw new Error('Invalid response: missing publicId');
      }

      // Store output image data
      const outputImageData = {
        imageUrl: enhancedImageUrl,
        publicId: enhancedPublicId,
        width: responseData.width,
        height: responseData.height,
      };

      setImageUri(enhancedImageUrl);
      // Keep originalImageUri unchanged - only update current image
      await AsyncStorage.setItem('selected_image_uri', enhancedImageUrl);
      await AsyncStorage.setItem('current_public_id', enhancedPublicId);
      setPublicId(enhancedPublicId);
      setShowingOriginal(false); // Reset to showing updated image

      // Reset filters when new image is loaded
      setFilterValues(defaultFilterValues);

      // Record operation to history
      await addOperationToHistory('enhance', { mode }, inputImageData, outputImageData);

      const successMessage = enhanceResult.data.message ||
        `Image has been ${mode === 'denoise' ? 'denoised' : 'deblurred'} successfully!`;

      showAlert(
        'success',
        'Enhancement Complete',
        successMessage
      );
    } catch (error: any) {
      console.error('Error enhancing image:', error);

      showAlert(
        'error',
        'Enhancement Failed',
        error.message || 'Failed to enhance image. Please try again.'
      );
    } finally {
      setIsEnhancing(false);
    }
  };

  // ============================================================
  // RELIGHT FUNCTION
  // ============================================================
  const handleRelight = async (brightness: number = 1.5) => {
    if (!publicId) {
      showAlert(
        'warning',
        'No Image Selected',
        'Please upload an image first before using the relight feature.'
      );
      return;
    }

    // Store input image data before operation
    const inputImageData = {
      imageUrl: imageUri || '',
      publicId: publicId,
      width: imageDimensions?.width,
      height: imageDimensions?.height,
    };

    setIsEnhancing(true);

    try {
      const result = await ApiService.relight(publicId, brightness);

      if (!result.response.ok) {
        const errorMessage = result.data?.message ||
          result.data?.error?.message ||
          `Server error: ${result.response.status} ${result.response.statusText}`;
        throw new Error(errorMessage);
      }

      if (result.data?.status === 'fail' || result.data?.status === 'error') {
        const errorMessage = result.data?.message ||
          result.data?.error?.message ||
          'Failed to relight image';
        throw new Error(errorMessage);
      }

      if (result.data.success === false) {
        const errorMessage = result.data?.message ||
          result.data?.error?.message ||
          'Failed to relight image';
        throw new Error(errorMessage);
      }

      const responseData = result.data.data;

      if (!responseData) {
        throw new Error('Invalid response: missing data field');
      }

      // Handle both response structures:
      // 1. Guide format: outputImage.imageUrl and outputImage.publicId
      // 2. Actual backend: relitImageUrl and publicId directly (or similar)
      const relitImageUrl = responseData.outputImage?.imageUrl || responseData.relitImageUrl || responseData.imageUrl;
      const relitPublicId = responseData.outputImage?.publicId || responseData.publicId;

      if (!relitImageUrl) {
        console.error('Relight response data:', JSON.stringify(responseData, null, 2));
        throw new Error('Invalid response: missing image URL');
      }
      if (!relitPublicId) {
        throw new Error('Invalid response: missing publicId');
      }

      // Store output image data
      const outputImageData = {
        imageUrl: relitImageUrl,
        publicId: relitPublicId,
        width: responseData.outputImage?.width || responseData.width,
        height: responseData.outputImage?.height || responseData.height,
      };

      setImageUri(relitImageUrl);
      // Keep originalImageUri unchanged - only update current image
      await AsyncStorage.setItem('selected_image_uri', relitImageUrl);
      await AsyncStorage.setItem('current_public_id', relitPublicId);
      setPublicId(relitPublicId);
      setShowingOriginal(false); // Reset to showing updated image

      // Reset filters when new image is loaded
      setFilterValues(defaultFilterValues);

      // Record operation to history
      await addOperationToHistory('relight', { brightness }, inputImageData, outputImageData);

      showAlert(
        'success',
        'Relight Complete',
        result.data.message || 'Image has been relit successfully!'
      );
    } catch (error: any) {
      console.error('Error relighting image:', error);
      showAlert(
        'error',
        'Relight Failed',
        error.message || 'Failed to relight image. Please try again.'
      );
    } finally {
      setIsEnhancing(false);
    }
  };

  // ============================================================
  // FACE RESTORE FUNCTION
  // ============================================================
  const handleFaceRestore = async () => {
    if (!publicId) {
      showAlert(
        'warning',
        'No Image Selected',
        'Please upload an image first before using the face restore feature.'
      );
      return;
    }

    // Store input image data before operation
    const inputImageData = {
      imageUrl: imageUri || '',
      publicId: publicId,
      width: imageDimensions?.width,
      height: imageDimensions?.height,
    };

    setIsEnhancing(true);

    try {
      const fidelity = 0.7;
      const result = await ApiService.faceRestore(publicId, fidelity);

      if (!result.response.ok) {
        const errorMessage = result.data?.message ||
          result.data?.error?.message ||
          `Server error: ${result.response.status} ${result.response.statusText}`;
        throw new Error(errorMessage);
      }

      if (result.data?.status === 'fail' || result.data?.status === 'error') {
        const errorMessage = result.data?.message ||
          result.data?.error?.message ||
          'Failed to restore face';
        throw new Error(errorMessage);
      }

      if (result.data.success === false) {
        const errorMessage = result.data?.message ||
          result.data?.error?.message ||
          'Failed to restore face';
        throw new Error(errorMessage);
      }

      const responseData = result.data.data;

      if (!responseData) {
        throw new Error('Invalid response: missing data field');
      }

      // Handle both response structures:
      // 1. Guide format: outputImage.imageUrl and outputImage.publicId
      // 2. Actual backend: restoredImageUrl and publicId directly
      const restoredImageUrl = responseData.outputImage?.imageUrl || responseData.restoredImageUrl;
      const restoredPublicId = responseData.outputImage?.publicId || responseData.publicId;

      if (!restoredImageUrl) {
        throw new Error('Invalid response: missing image URL');
      }
      if (!restoredPublicId) {
        throw new Error('Invalid response: missing publicId');
      }

      // Store output image data
      const outputImageData = {
        imageUrl: restoredImageUrl,
        publicId: restoredPublicId,
        width: responseData.outputImage?.width || responseData.width,
        height: responseData.outputImage?.height || responseData.height,
      };

      setImageUri(restoredImageUrl);
      // Keep originalImageUri unchanged - only update current image
      await AsyncStorage.setItem('selected_image_uri', restoredImageUrl);
      await AsyncStorage.setItem('current_public_id', restoredPublicId);
      setPublicId(restoredPublicId);
      setShowingOriginal(false); // Reset to showing updated image

      // Reset filters when new image is loaded
      setFilterValues(defaultFilterValues);

      // Record operation to history
      await addOperationToHistory('face-restore', { fidelity }, inputImageData, outputImageData);

      showAlert(
        'success',
        'Face Restore Complete',
        result.data.message || 'Face has been restored successfully!'
      );
    } catch (error: any) {
      console.error('Error restoring face:', error);
      showAlert(
        'error',
        'Face Restore Failed',
        error.message || 'Failed to restore face. Please try again.'
      );
    } finally {
      setIsEnhancing(false);
    }
  };

  // ============================================================
  // REMOVE SUBJECT / BACKGROUND FUNCTION
  // ============================================================
  const handleSubjectRemoval = async (mode: 'subject' | 'background' = 'subject') => {
    if (!publicId) {
      showAlert(
        'warning',
        'No Image Selected',
        'Please upload an image first before using this feature.'
      );
      return;
    }

    // Store input image data before operation
    const inputImageData = {
      imageUrl: imageUri || '',
      publicId: publicId,
      width: imageDimensions?.width,
      height: imageDimensions?.height,
    };

    setIsEnhancing(true);

    try {
      // Use 'human' mode for subject removal, 'object' mode for background removal
      const removalMode = mode === 'subject' ? 'human' : 'object';
      const result = await ApiService.removeBackground(publicId, removalMode);

      if (!result.response.ok || !result.data.success) {
        throw new Error(result.data.message || `Failed to remove ${mode === 'subject' ? 'subject' : 'background'}`);
      }

      const responseData = result.data.data;
      // Handle both response formats from the guide
      const processedImageUrl = responseData.outputImage?.imageUrl || responseData.processedImageUrl || responseData.imageUrl;
      const processedPublicId = responseData.outputImage?.publicId || responseData.publicId;

      if (!processedImageUrl || !processedPublicId) {
        throw new Error('Invalid response: missing processed image data');
      }

      // Store output image data
      const outputImageData = {
        imageUrl: processedImageUrl,
        publicId: processedPublicId,
        width: responseData.outputImage?.width || responseData.width,
        height: responseData.outputImage?.height || responseData.height,
      };

      setImageUri(processedImageUrl);
      // Keep originalImageUri unchanged - only update current image
      await AsyncStorage.setItem('selected_image_uri', processedImageUrl);
      await AsyncStorage.setItem('current_public_id', processedPublicId);
      setPublicId(processedPublicId);
      setShowingOriginal(false); // Reset to showing updated image

      // Reset filters when new image is loaded
      setFilterValues(defaultFilterValues);

      // Record operation to history
      await addOperationToHistory('remove-background', { mode: removalMode }, inputImageData, outputImageData);

      showAlert(
        'success',
        mode === 'subject' ? 'Subject Removed' : 'Background Removed',
        mode === 'subject' 
          ? 'Subject has been removed from the image successfully!'
          : 'Background has been removed successfully!'
      );
    } catch (error: any) {
      console.error(`Error removing ${mode}:`, error);
      showAlert(
        'error',
        'Removal Failed',
        error.message || `Failed to remove ${mode === 'subject' ? 'subject' : 'background'}. Please try again.`
      );
    } finally {
      setIsEnhancing(false);
    }
  };

  // ============================================================
  // HANDLE GEMINI PROMPT
  // Send user prompt to Gemini AI for analysis and automatic execution
  // ============================================================
  const handleSendPrompt = async () => {
    if (!promptText.trim()) {
      showAlert('warning', 'Empty Prompt', 'Please enter a prompt');
      return;
    }

    if (!publicId) {
      showAlert(
        'warning',
        'No Image Selected',
        'Please upload an image first before using this feature.'
      );
      return;
    }

    setIsEnhancing(true);
    const userPrompt = promptText.trim();
    setPromptText(''); // Clear prompt after sending

    try {
      // Get projectId and projectType from AsyncStorage
      const storedProjectId = projectId || await AsyncStorage.getItem('current_project_id');
      const storedProjectType = await AsyncStorage.getItem('project_type') as 'layer-based' | 'ai-sequential' | null;

      console.log('=== Sending Prompt to Gemini ===');
      console.log('Prompt:', userPrompt);
      console.log('PublicId:', publicId);
      console.log('ProjectId:', storedProjectId);
      console.log('ProjectType:', storedProjectType);

      // Call Gemini prompt endpoint
      const result = await ApiService.processGeminiPrompt(
        publicId,
        userPrompt,
        storedProjectId || undefined,
        storedProjectType || undefined
      );

      if (!result.response.ok || !result.data.success) {
        // Check if it's a "not supported" message (this is still a valid response)
        if (result.data.message && result.data.supported === false) {
        showAlert(
          'warning',
          'Feature Not Supported',
          result.data.message || 'This feature is not yet supported. Please try a different prompt.'
        );
          return;
        }
        throw new Error(result.data.message || 'Failed to process prompt');
      }

      // Check if interaction is required (object removal)
      if (result.data.requiresInteraction === true) {
        // Enable object removal mode
        setObjectRemovalMode(true);
        setObjectRemovalMarker(null);
        
        showAlert(
          'warning',
          'Select Object',
          result.data.message || 'Please tap on the object in the image to remove it.'
        );
        return;
      }

      // Automatic execution - update image with result
      const responseData = result.data.data;
      
      console.log('=== Gemini Response Data ===');
      console.log('Full result.data:', JSON.stringify(result.data, null, 2));
      console.log('Full responseData:', JSON.stringify(responseData, null, 2));
      
      // Handle different response formats from different AI operations
      // Face restore: restoredImageUrl, publicId
      // Relight: relitImageUrl, publicId
      // Enhance: enhancedImageUrl, publicId
      // Background removal: outputImage.imageUrl, outputImage.publicId
      // Style transfer: outputImage.imageUrl, outputImage.publicId
      const processedImageUrl = 
        responseData.outputImage?.imageUrl || 
        responseData.restoredImageUrl || 
        responseData.relitImageUrl || 
        responseData.enhancedImageUrl ||
        responseData.imageUrl || 
        responseData.processedImageUrl;
        
      const processedPublicId = 
        responseData.outputImage?.publicId || 
        responseData.publicId;

      console.log('Extracted imageUrl:', processedImageUrl);
      console.log('Extracted publicId:', processedPublicId);

      if (!processedImageUrl || !processedPublicId) {
        console.error('Missing image data. Full response:', JSON.stringify(result.data, null, 2));
        throw new Error('Invalid response: missing processed image data');
      }

      // Store output image data
      // Handle width/height from different response formats
      const outputWidth = 
        responseData.outputImage?.width || 
        responseData.width;
      const outputHeight = 
        responseData.outputImage?.height || 
        responseData.height;
        
      const outputImageData = {
        imageUrl: processedImageUrl,
        publicId: processedPublicId,
        width: outputWidth,
        height: outputHeight,
      };
      
      console.log('Output image data:', outputImageData);

      setImageUri(processedImageUrl);
      await AsyncStorage.setItem('selected_image_uri', processedImageUrl);
      await AsyncStorage.setItem('current_public_id', processedPublicId);
      setPublicId(processedPublicId);
      setShowingOriginal(false);

      // Reset filters when new image is loaded
      setFilterValues(defaultFilterValues);

      // Add to history for sequential projects
      // Backend tries to add automatically, but may fail for operations that don't use outputImage structure
      // So we add it here to ensure it's always recorded
      if (storedProjectId && storedProjectType === 'ai-sequential' && processedImageUrl && processedPublicId) {
        const inputImageData = {
          imageUrl: imageUri || '',
          publicId: publicId,
          width: imageDimensions?.width,
          height: imageDimensions?.height,
        };

        // Infer operation type from response structure if feature is not available
        // Check which field exists to determine the operation
        let operationType = 'enhance'; // default
        let feature = null;

        // Try to get feature from response
        if (result.data.data?.geminiAnalysis?.feature) {
          feature = result.data.data.geminiAnalysis.feature;
        } else if (result.data.data?.feature) {
          feature = result.data.data.feature;
        } else if (responseData.feature) {
          feature = responseData.feature;
        } else if (result.data.feature) {
          feature = result.data.feature;
        } else {
          // Infer from response structure
          if (responseData.restoredImageUrl || responseData.restoredImageId) {
            feature = 'face_restore';
          } else if (responseData.relitImageUrl || responseData.relitImageId) {
            feature = 'relighting';
          } else if (responseData.enhancedImageUrl || responseData.enhancedImageId) {
            feature = 'denoise'; // or deblur, but default to denoise
          } else if (responseData.outputImage) {
            // Could be background removal or style transfer
            feature = 'background_removal'; // default
          }
        }

        console.log('Feature detected:', feature);
        console.log('Full result.data:', JSON.stringify(result.data, null, 2));

        // Map Gemini feature to operation type
        const operationTypeMap: { [key: string]: string } = {
          'relighting': 'relight',
          'low_light_enhancement': 'relight',
          'auto_enhance': 'enhance',
          'denoise': 'enhance',
          'deblur': 'enhance',
          'face_restore': 'face-restore',
          'face_restoration': 'face-restore',
          'background_removal': 'remove-background',
        };

        operationType = feature ? (operationTypeMap[feature] || 'enhance') : 'enhance';
        const promptData = responseData.prompt || { userPrompt, feature: feature || 'unknown' };

        console.log('Adding to history:', {
          operationType,
          promptData,
          inputImageData,
          outputImageData
        });

        try {
          await addOperationToHistory(operationType, promptData, inputImageData, outputImageData);
          console.log('✅ History added successfully');
        } catch (historyError: any) {
          console.error('❌ Failed to add to history:', historyError);
          // Don't throw - history addition failure shouldn't block the operation
        }
      }

      showAlert(
        'success',
        'Processed',
        result.data.message || 'Image processed successfully!'
      );
    } catch (error: any) {
      console.error('Error processing Gemini prompt:', error);
      showAlert(
        'error',
        'Processing Failed',
        error.message || 'Failed to process prompt. Please try again.'
      );
    } finally {
      setIsEnhancing(false);
    }
  };

  // ============================================================
  // REMOVE OBJECT FUNCTION
  // ============================================================
  const handleObjectRemoval = async () => {
    if (!publicId) {
      showAlert(
        'warning',
        'No Image Selected',
        'Please upload an image first before using this feature.'
      );
      return;
    }

    if (!imageUri || !imageDimensions) {
      showAlert(
        'warning',
        'Image Not Ready',
        'Please wait for the image to load completely.'
      );
      return;
    }

    // Enable object removal mode - user will tap on image to select object
    setObjectRemovalMode(true);
    setObjectRemovalMarker(null); // Clear any previous marker
    console.log('Object removal mode enabled');
  };

  // ============================================================
  // HANDLE IMAGE TAP FOR OBJECT REMOVAL
  // ============================================================
  const handleImageTapForObjectRemoval = async (event: any) => {
    console.log('=== handleImageTapForObjectRemoval called ===');
    console.log('objectRemovalMode:', objectRemovalMode);
    console.log('publicId:', publicId);
    console.log('imageDimensions:', imageDimensions);
    console.log('containerLayout:', containerLayout);
    
    if (!objectRemovalMode) {
      console.log('Not in object removal mode, returning');
      return;
    }

    if (!publicId || !imageDimensions || !containerLayout) {
      console.log('Missing required data, returning');
      return;
    }

    try {
      // Get tap coordinates relative to the TouchableOpacity (image)
      const { locationX, locationY } = event.nativeEvent;
      
      console.log('=== Object Removal Tap ===');
      console.log('Tap location:', { locationX, locationY });
      console.log('Container layout:', containerLayout);
      console.log('Image dimensions:', imageDimensions);

      // Calculate coordinates relative to the displayed image
      // The image is displayed with resizeMode="contain", so we need to account for letterboxing
      const containerWidth = containerLayout.width;
      const containerHeight = containerLayout.height;
      const imageAspectRatio = imageDimensions.aspectRatio;
      const containerAspectRatio = containerWidth / containerHeight;

      let imageDisplayWidth: number;
      let imageDisplayHeight: number;
      let offsetX = 0;
      let offsetY = 0;

      if (imageAspectRatio > containerAspectRatio) {
        // Image is wider - letterboxing on top/bottom
        imageDisplayWidth = containerWidth;
        imageDisplayHeight = containerWidth / imageAspectRatio;
        offsetY = (containerHeight - imageDisplayHeight) / 2;
      } else {
        // Image is taller - letterboxing on left/right
        imageDisplayHeight = containerHeight;
        imageDisplayWidth = containerHeight * imageAspectRatio;
        offsetX = (containerWidth - imageDisplayWidth) / 2;
      }

      // Check if tap is within the actual image bounds
      const relativeX = locationX - offsetX;
      const relativeY = locationY - offsetY;

      if (relativeX < 0 || relativeX > imageDisplayWidth || relativeY < 0 || relativeY > imageDisplayHeight) {
        // Tap is outside image bounds - ignore
        return;
      }

      // Convert display coordinates to original image coordinates
      // Coordinates are relative to top-left corner of the original image
      const originalX = Math.round((relativeX / imageDisplayWidth) * imageDimensions.width);
      const originalY = Math.round((relativeY / imageDisplayHeight) * imageDimensions.height);

      console.log('=== Final Coordinates ===');
      console.log('Original image coordinates:', { x: originalX, y: originalY });
      console.log('Marker position (display):', { x: locationX, y: locationY });

      // Show red dot marker at tap location IMMEDIATELY
      setObjectRemovalMarker({ x: locationX, y: locationY });
      console.log('Marker set to:', { x: locationX, y: locationY });

      // Disable object removal mode and hide overlay IMMEDIATELY
      setObjectRemovalMode(false);
      console.log('Object removal mode disabled, overlay should disappear');
      
      // Wait a moment to show the marker, then process
      setTimeout(async () => {
        console.log('Starting object removal with coordinates:', { x: originalX, y: originalY });
        setIsEnhancing(true);
        await performObjectRemoval(originalX, originalY);
        // Clear marker after processing
        setObjectRemovalMarker(null);
        console.log('Marker cleared after processing');
      }, 500);
    } catch (error: any) {
      console.error('Error processing tap for object removal:', error);
      setObjectRemovalMode(false);
      setObjectRemovalMarker(null);
      showAlert(
        'error',
        'Selection Failed',
        error.message || 'Failed to process selection. Please try again.'
      );
    }
  };

  // ============================================================
  // PERFORM OBJECT REMOVAL WITH COORDINATES
  // ============================================================
  const performObjectRemoval = async (x: number, y: number) => {
    if (!publicId) {
      setIsEnhancing(false);
      return;
    }

    // Store input image data before operation
    const inputImageData = {
      imageUrl: imageUri || '',
      publicId: publicId,
      width: imageDimensions?.width,
      height: imageDimensions?.height,
    };

    try {
      const result = await ApiService.removeObject(publicId, x, y);

      if (!result.response.ok) {
        const errorMessage = result.data?.message ||
          result.data?.error?.message ||
          `Server error: ${result.response.status} ${result.response.statusText}`;
        throw new Error(errorMessage);
      }

      if (result.data?.status === 'fail' || result.data?.status === 'error') {
        const errorMessage = result.data?.message ||
          result.data?.error?.message ||
          'Failed to remove object';
        throw new Error(errorMessage);
      }

      if (result.data.success === false) {
        const errorMessage = result.data?.message ||
          result.data?.error?.message ||
          'Failed to remove object';
        throw new Error(errorMessage);
      }

      const responseData = result.data.data;

      if (!responseData) {
        throw new Error('Invalid response: missing data field');
      }

      // Handle response structure - check for outputImage
      const processedImageUrl = responseData.outputImage?.imageUrl || responseData.imageUrl;
      const processedPublicId = responseData.outputImage?.publicId || responseData.publicId;

      if (!processedImageUrl) {
        throw new Error('Invalid response: missing image URL');
      }
      if (!processedPublicId) {
        throw new Error('Invalid response: missing publicId');
      }

      // Store output image data
      const outputImageData = {
        imageUrl: processedImageUrl,
        publicId: processedPublicId,
        width: responseData.outputImage?.width || responseData.width,
        height: responseData.outputImage?.height || responseData.height,
      };

      setImageUri(processedImageUrl);
      // Keep originalImageUri unchanged - only update current image
      await AsyncStorage.setItem('selected_image_uri', processedImageUrl);
      await AsyncStorage.setItem('current_public_id', processedPublicId);
      setPublicId(processedPublicId);
      setShowingOriginal(false); // Reset to showing updated image
      setObjectRemovalMarker(null); // Clear marker

      // Reset filters when new image is loaded
      setFilterValues(defaultFilterValues);

      // Record operation to history
      await addOperationToHistory('object-removal', { x, y }, inputImageData, outputImageData);

      showAlert(
        'success',
        'Object Removed',
        'Object has been removed from the image successfully!'
      );
    } catch (error: any) {
      console.error('Error removing object:', error);
      showAlert(
        'error',
        'Removal Failed',
        error.message || 'Failed to remove object. Please try again.'
      );
    } finally {
      setIsEnhancing(false);
    }
  };

  // ============================================================
  // STYLE TRANSFER FUNCTION
  // ============================================================
  const handleStyleTransfer = async () => {
    if (!imageUri || !publicId) {
      showAlert('error', 'No Image', 'Please upload a base image first');
      return;
    }
    // Enable style transfer mode to show image picker
    setStyleTransferMode(true);
    setUploadOptionsVisible(true);
  };

  // ============================================================
  // HANDLE REFERENCE IMAGE SELECTION FOR STYLE TRANSFER
  // ============================================================
  const handleReferenceImageSelected = async (uri: string, source: 'gallery' | 'camera') => {
    try {
      setUploading(true);
      setStyleTransferMode(false);
      setUploadOptionsVisible(false);

      // Get projectId and projectType from AsyncStorage
      const storedProjectId = projectId || await AsyncStorage.getItem('current_project_id');
      const projectType = await AsyncStorage.getItem('project_type') as 'layer-based' | 'ai-sequential' | null;

      if (!storedProjectId || !projectType) {
        throw new Error('No project found. Please create a project first.');
      }

      console.log(`Uploading reference image from ${source}...`);
      
      // Upload reference image to backend
      const uploadResult = await ApiService.uploadImage(uri, storedProjectId, projectType);
      
      if (!uploadResult.response.ok || !uploadResult.data.success) {
        throw new Error(uploadResult.data.message || 'Failed to upload reference image');
      }

      const imageData = uploadResult.data.data.image;
      const { publicId: refPublicId, imageUrl: refImageUrl } = imageData;
      console.log('Reference image uploaded successfully. PublicId:', refPublicId);

      // Store reference image
      setReferenceImageUri(refImageUrl);
      setReferenceImagePublicId(refPublicId);

      // Now perform style transfer
      await performStyleTransfer(refPublicId);
    } catch (error: any) {
      console.error('Error uploading reference image:', error);
      setStyleTransferMode(false);
      showAlert(
        'error',
        'Upload Failed',
        error.message || 'Failed to upload reference image. Please try again.'
      );
    } finally {
      setUploading(false);
    }
  };

  // ============================================================
  // PERFORM STYLE TRANSFER
  // ============================================================
  const performStyleTransfer = async (stylePublicId: string) => {
    if (!publicId) {
      setIsEnhancing(false);
      showAlert('error', 'Error', 'Missing base image. Please upload an image first.');
      return;
    }

    if (!stylePublicId) {
      setIsEnhancing(false);
      showAlert('error', 'Error', 'Missing reference image.');
      return;
    }

    // Store input image data before operation
    // publicId is the base image (content) that will be styled
    const inputImageData = {
      imageUrl: imageUri || '',
      publicId: publicId,
      width: imageDimensions?.width,
      height: imageDimensions?.height,
    };

    try {
      setIsEnhancing(true);

      // Use explicit mode: contentPublicId (base image) and stylePublicId (reference image)
      // Style from reference image will be transferred to base image
      const result = await ApiService.styleTransfer(publicId, stylePublicId);

      if (!result.response.ok || !result.data.success) {
        const errorMessage = result.data?.message || 'Failed to transfer style';
        throw new Error(errorMessage);
      }

      const responseData = result.data.data;
      const processedImageUrl = responseData.outputImage?.imageUrl || responseData.imageUrl;
      const processedPublicId = responseData.outputImage?.publicId || responseData.publicId;

      if (!processedImageUrl) {
        throw new Error('Invalid response: missing outputImage.imageUrl');
      }
      if (!processedPublicId) {
        throw new Error('Invalid response: missing publicId');
      }

      // Output image data
      const outputImageData = {
        imageUrl: processedImageUrl,
        publicId: processedPublicId,
        width: responseData.outputImage?.width || imageDimensions?.width,
        height: responseData.outputImage?.height || imageDimensions?.height,
      };

      // Add to history with reference image info
      await addOperationToHistory(
        'style-transfer',
        { stylePublicId, referenceImageUrl: referenceImageUri },
        inputImageData,
        outputImageData
      );

      setImageUri(processedImageUrl);
      await AsyncStorage.setItem('selected_image_uri', processedImageUrl);
      await AsyncStorage.setItem('current_public_id', processedPublicId);
      setPublicId(processedPublicId);
      setShowingOriginal(false);

      setFilterValues(defaultFilterValues);

      showAlert(
        'success',
        'Style Transferred',
        'Style has been applied to the image successfully!'
      );
    } catch (error: any) {
      console.error('Error transferring style:', error);
      showAlert(
        'error',
        'Transfer Failed',
        error.message || 'Failed to transfer style. Please try again.'
      );
    } finally {
      setIsEnhancing(false);
      setStyleTransferMode(false); // Exit style transfer mode
    }
  };

  // ============================================================
  // RESET ALL FILTERS
  // ============================================================
  const handleResetFilters = () => {
    setFilterValues(defaultFilterValues);
  };

  // ============================================================
  // LONG PRESS HANDLERS FOR SHOWING ORIGINAL IMAGE
  // ============================================================
  const handleLongPressStart = () => {
    // Don't trigger long press if in object removal mode
    if (objectRemovalMode) {
      return;
    }
    // Only show original if we have both original and current images, and they're different
    if (originalImageUri && imageUri && originalImageUri !== imageUri) {
      longPressTimer.current = setTimeout(() => {
        setShowingOriginal(true);
      }, 500); // 3 second delay
    }
  };

  const handleLongPressEnd = () => {
    // Clear timer if user releases before 3 seconds
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    // Always return to updated image when released
    setShowingOriginal(false);
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
    };
  }, []);


  // ============================================================
  // CHECK IF ANY FILTER IS ACTIVE
  // ============================================================
  const hasActiveFilters = (): boolean => {
    return (
      filterValues.brightness !== 0 ||
      filterValues.contrast !== 0 ||
      filterValues.saturation !== 0 ||
      filterValues.warmth !== 0 ||
      filterValues.shadows !== 0 ||
      filterValues.highlights !== 0 ||
      filterValues.sharpen !== 0
    );
  };

  // ============================================================
  // EXPORT/SHARE IMAGE WITH FILTERS
  // ============================================================
  const handleShareImage = async () => {
    if (!imageUri) {
      showAlert('warning', 'No Image', 'Please select an image first');
      return;
    }

    setIsSharing(true);

    try {
      // Apply filters to the image using Cloudinary URL transformations
      let finalImageUri = imageUri;

      console.log('=== EXPORT DEBUG ===');
      console.log('Original imageUri:', imageUri);
      console.log('Filter values:', filterValues);

      // Check if any filters are active
      const hasFilters = Object.values(filterValues).some(val => val !== 0);
      console.log('Has filters:', hasFilters);
      console.log('Is Cloudinary URL:', imageUri?.includes('res.cloudinary.com'));

      if (hasFilters && imageUri?.includes('res.cloudinary.com')) {
        // Build Cloudinary transformation parameters
        const transformations: string[] = [];
        
        // Brightness: -50 to 50 → Cloudinary uses e_brightness:value (range -100 to 100)
        if (filterValues.brightness !== 0) {
          transformations.push(`e_brightness:${filterValues.brightness}`);
        }
        
        // Contrast: -50 to 50 → Cloudinary uses e_contrast:value (range -100 to 100)
        if (filterValues.contrast !== 0) {
          transformations.push(`e_contrast:${filterValues.contrast}`);
        }
        
        // Saturation: -50 to 50 → Cloudinary uses e_saturation:value (range -100 to 100)
        if (filterValues.saturation !== 0) {
          transformations.push(`e_saturation:${filterValues.saturation}`);
        }
        
        console.log('Transformations array:', transformations);
        
        // Apply transformations to Cloudinary URL
        if (transformations.length > 0) {
          const transformString = transformations.join(',');
          console.log('Transform string:', transformString);
          
          // Parse Cloudinary URL structure
          // Format: https://res.cloudinary.com/{cloud_name}/image/upload/{version}/{folder}/{public_id}
          // OR: https://res.cloudinary.com/{cloud_name}/image/upload/{transforms}/{version}/{folder}/{public_id}
          if (imageUri.includes('/image/upload/')) {
            const parts = imageUri.split('/image/upload/');
            const baseUrl = parts[0] + '/image/upload';
            const pathAfterUpload = parts[1];
            
            // Parse the path to extract version, folder, and public_id
            // Path can be: {version}/{folder}/{public_id} or {transforms}/{version}/{folder}/{public_id}
            const pathSegments = pathAfterUpload.split('/');
            
            // Check if segment is a version (starts with 'v' followed by numbers)
            const isVersion = (segment: string) => /^v\d+$/.test(segment);
            // Check if segment looks like transformations (contains colons, underscores, or commas)
            const isTransformation = (segment: string) => /[:_,]/.test(segment);
            
            // Find version index (skip any transformation segments)
            let versionIndex = -1;
            for (let i = 0; i < pathSegments.length; i++) {
              if (isVersion(pathSegments[i])) {
                versionIndex = i;
                break;
              }
              // If we hit a transformation segment, continue looking
              if (isTransformation(pathSegments[i])) {
                continue;
              }
            }
            
            // Reconstruct path with transformations
            // Transformations go BEFORE version: /image/upload/{transforms}/{version}/{folder}/{public_id}
            let newPath = transformString;
            
            if (versionIndex >= 0) {
              // Has version - preserve version, folder(s), and public_id
              // Include everything from version onwards
              newPath += '/' + pathSegments.slice(versionIndex).join('/');
            } else {
              // No version found - preserve all segments (folder and public_id)
              newPath += '/' + pathSegments.join('/');
            }
            
            finalImageUri = `${baseUrl}/${newPath}`;
            
            console.log('Base URL:', baseUrl);
            console.log('Path after upload:', pathAfterUpload);
            console.log('Path segments:', pathSegments);
            console.log('Version index:', versionIndex);
            console.log('Transform string:', transformString);
            console.log('New path:', newPath);
            console.log('Final transformed URI:', finalImageUri);
          } else {
            console.warn('Unexpected Cloudinary URL format:', imageUri);
          }
        }
      } else if (hasFilters && !imageUri?.includes('res.cloudinary.com')) {
        // Not a Cloudinary URL - filters can't be applied
        console.warn('Filters cannot be applied - not a Cloudinary URL');
        showAlert(
          'warning',
          'Filters Not Applied',
          'Filters can only be applied to Cloudinary images. The original image will be shared.'
        );
      }
      
      console.log('Using finalImageUri for ImageManipulator:', finalImageUri);
      
      // Process image with ImageManipulator to ensure proper format
      const manipulatedImage = await ImageManipulator.manipulateAsync(
        finalImageUri || imageUri,
        [], // No additional actions needed
        {
          compress: 1,
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );
      
      console.log('ImageManipulator result URI:', manipulatedImage.uri);

      // Check if sharing is available
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        showAlert('error', 'Not Available', 'Sharing is not available on this device');
        return;
      }

      // Share the image directly (works with both local and remote URIs)
      // On mobile, this opens the native share sheet where user can save to gallery
      await Sharing.shareAsync(manipulatedImage.uri, {
        mimeType: 'image/jpeg',
        dialogTitle: 'Save or Share Image',
        UTI: 'public.jpeg', // iOS specific
      });
    } catch (error: any) {
      console.error('Share error:', error);
      showAlert(
        'error',
        'Share Failed', 
        error.message || 'Failed to share image. Please try again.'
      );
    } finally {
      setIsSharing(false);
    }
  };

  // ============================================================
  // DELETE IMAGE
  // Deletes the current image and reverts to empty canvas
  // ============================================================
  const handleDeleteImage = () => {
    if (!imageUri) {
      showAlert('warning', 'No Image', 'No image to delete');
      return;
    }

    // Show confirmation modal
    setShowDeleteConfirmation(true);
  };

  const confirmDeleteImage = async () => {
    try {
      // Clear all image-related state
      setImageUri(null);
      setOriginalImageUri(null);
      setPublicId(null);
      setReferenceImageUri(null);
      setReferenceImagePublicId(null);
      setShowingOriginal(false);
      setObjectRemovalMode(false);
      setObjectRemovalMarker(null);
      setStyleTransferMode(false);
      
      // Reset filters
      setFilterValues(defaultFilterValues);
      
      // Clear AsyncStorage
      await AsyncStorage.removeItem('selected_image_uri');
      await AsyncStorage.removeItem('current_public_id');
      
      // Increment history key to refresh history
      setHistoryKey(prev => prev + 1);
      
      // Close confirmation modal
      setShowDeleteConfirmation(false);
      
      showAlert('success', 'Image Deleted', 'Image has been removed. Canvas is now empty.');
    } catch (error: any) {
      console.error('Error deleting image:', error);
      setShowDeleteConfirmation(false);
      showAlert('error', 'Delete Failed', error.message || 'Failed to delete image. Please try again.');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? colors.background.dark : colors.background.cream }]} edges={['top', 'bottom']}>
      {/* HEADER / NAVBAR */}
      <Navbar 
        screenName="" 
        rightElement={
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={handleShareImage}
          >
            <Share2 size={28} color={colors.text.primary} strokeWidth={2.5} />
          </TouchableOpacity>
        }
      />

      {/* TABS */}
      <View style={[styles.tabsContainer, { backgroundColor: isDark ? colors.background.dark : colors.background.cream }]}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'workspace' && styles.tabActive]}
          onPress={() => setActiveTab('workspace')}
        >
          <Text style={[styles.tabText, activeTab === 'workspace' && styles.tabTextActive, { color: activeTab === 'workspace' ? colors.text.primary : colors.text.secondary }]}>
            WORKSPACE
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'history' && styles.tabActive]}
          onPress={() => handleTabChange('history')}
        >
          <Text style={[styles.tabText, activeTab === 'history' && styles.tabTextActive, { color: activeTab === 'history' ? colors.text.primary : colors.text.secondary }]}>
            HISTORY
          </Text>
        </TouchableOpacity>
      </View>

      {/* CONTENT AREA - WORKSPACE OR HISTORY */}
      <Animated.View
        style={[
          styles.contentWrapper,
          {
            transform: [{ translateX: swipeX }],
          },
        ]}
        {...panResponder.panHandlers}
      >
        {activeTab === 'workspace' ? (
          <View style={styles.scrollWrapper}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={(contentWidth, height) => {
            contentHeight.current = height;
            if (scrollViewHeight.current > 0) {
              setCanScroll(height > scrollViewHeight.current);
            }
          }}
          onLayout={(event) => {
            scrollViewHeight.current = event.nativeEvent.layout.height;
            if (contentHeight.current > 0) {
              setCanScroll(contentHeight.current > scrollViewHeight.current);
            }
          }}
        >

          {/* MAIN CONTENT */}
          <View style={styles.content}>
            {/* Image Container with Real-Time Filters or Blank Canvas */}
            <View 
              ref={imageContainerRef}
              onLayout={(event) => {
                const { width, height, x, y } = event.nativeEvent.layout;
                setContainerLayout({ width, height, x, y });
                console.log('Container layout updated:', { width, height, x, y });
              }}
              style={[
                styles.imageContainer,
                { 
                  width: '100%',
                  height: CANVAS_HEIGHT,
                  backgroundColor: colors.background.secondary,
                  borderColor: colors.border.primary
                }
              ]}
            >
              {imageLoading ? (
                <View style={[styles.imageLoadingContainer, { backgroundColor: colors.background.secondary }]}>
                  <Loader size={120} />
                </View>
              ) : imageUri ? (
                <View style={styles.imageWrapper}>
                  {/* Delete Button - Top Right Corner */}
                  <TouchableOpacity
                    style={[styles.deleteButton, { backgroundColor: colors.background.overlayTransparent || 'rgba(0, 0, 0, 0)' }]}
                    onPress={handleDeleteImage}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <X size={24} color="#FF4444" strokeWidth={2.5} />
                  </TouchableOpacity>
                  
                  {/* Image Label Overlay */}
                  {originalImageUri && originalImageUri !== imageUri && (
                    <View style={[styles.imageLabelContainer, { backgroundColor: colors.background.overlayTransparent || 'rgba(0, 0, 0, 0.6)' }]}>
                      <Text style={[styles.imageLabelText, { color: colors.text.cream || '#FFFFFF' }]}>
                        {showingOriginal ? 'Original Image' : 'Updated Image'}
                      </Text>
                    </View>
                  )}
                  {/* Red dot marker for object removal */}
                  {objectRemovalMarker && (
                    <View 
                      style={[
                        styles.objectRemovalMarker,
                        {
                          left: objectRemovalMarker.x - 10,
                          top: objectRemovalMarker.y - 10,
                        }
                      ]}
                      pointerEvents="none"
                    />
                  )}
                  {/* Image with long press handler and tap handler for object removal */}
                  <TouchableOpacity
                    activeOpacity={1}
                    onPressIn={objectRemovalMode ? undefined : handleLongPressStart}
                    onPressOut={objectRemovalMode ? undefined : handleLongPressEnd}
                    onPress={objectRemovalMode ? handleImageTapForObjectRemoval : undefined}
                    style={styles.imageTouchable}
                    disabled={false}
                  >
                    <FilteredImage
                      uri={showingOriginal && originalImageUri ? originalImageUri : imageUri}
                      filterValues={showingOriginal ? defaultFilterValues : filterValues}
                      style={styles.image}
                      resizeMode="contain"
                    />
                  </TouchableOpacity>
                </View>
              ) : (
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
                        {uploadMessage || 'Uploading...'}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}
            </View>

            {/* Reference Image Display - Outside Canvas, Bottom Right Overlay */}
            {referenceImageUri && (
              <View style={[styles.referenceImageOverlay, { 
                backgroundColor: isDark ? colors.background.dark : colors.background.cream,
                borderColor: colors.border.primary
              }]}>
                <Text style={[styles.referenceImageLabel, { color: colors.text.secondary }]}>
                  Reference Style
                </Text>
                <Image
                  source={{ uri: referenceImageUri }}
                  style={styles.referenceImage}
                  resizeMode="cover"
                />
              </View>
            )}

            {/* Object Removal Instruction - Outside Canvas */}
            {objectRemovalMode && (
              <View style={[styles.objectRemovalInstruction, { backgroundColor: isDark ? colors.background.dark : colors.background.cream }]}>
                <Text style={[styles.objectRemovalInstructionText, { color: colors.text.primary }]}>
                  Tap on the object to remove
                </Text>
              </View>
            )}

            {/* Filter Status Indicator */}
            {hasActiveFilters() && (
              <View style={styles.filterStatusContainer}>
                <Text style={[styles.filterStatusText, { color: colors.button.arclight }]}>
                  Filters Active
                </Text>
                <TouchableOpacity
                  onPress={handleResetFilters}
                  style={[styles.resetButton, { backgroundColor: colors.button.arclightHover }]}
                >
                  <Text style={[styles.resetButtonText, { color: colors.button.arclight }]}>Reset All</Text>
                </TouchableOpacity>
              </View>
            )}

          </View>
        </ScrollView>
      </View>
        ) : (
          <History
            onRevertToOperation={handleRevertToOperation}
            onUndoLast={handleUndoLast}
            refreshKey={historyKey}
          />
        )}
      </Animated.View>

      {/* BOTTOM BAR WITH BUTTONS - Only show in workspace */}
      {activeTab === 'workspace' && !keyboardVisible && (
        <View style={styles.bottomBarWrapper}>
          {canScroll && (
            <LinearGradient
              colors={[
                `${isDark ? colors.background.dark : colors.background.cream}00`,
                `${isDark ? colors.background.dark : colors.background.cream}CC`,
                isDark ? colors.background.dark : colors.background.cream
              ]}
              locations={[0, 0.5, 1]}
              style={styles.bottomBarGradient}
              pointerEvents="none"
            />
          )}
          <View style={[styles.bottomBar, { backgroundColor: isDark ? colors.background.dark : colors.background.cream }]}>
            <TouchableOpacity
              style={[
                styles.adjustButton,
                { backgroundColor: isDark ? '#E8E0F0' : '#E8E0F0' },
              ]}
              onPress={() => setFilterMenuVisible(true)}
            >
              <Sliders 
                size={24} 
                color={isDark ? colors.background.dark : colors.background.dark} 
                strokeWidth={2} 
              />
            </TouchableOpacity>

            <ArclightEngineButton
              onPress={() => setArclightEngineVisible(true)}
              disabled={isEnhancing}
            />
          </View>
        </View>
      )}

      {/* INPUT AREA - Only show in workspace */}
      {activeTab === 'workspace' && (
        <Animated.View
          style={[
            styles.inputContainer,
            {
              marginBottom: inputBottomOffset,
              backgroundColor: isDark ? colors.background.dark : colors.background.cream
            }
          ]}
        >
        <View style={[styles.inputWrapper, { backgroundColor: isDark ? colors.background.button : colors.input.background }]}>
          <TextInput
            style={[styles.input, { color: colors.text.primary }]}
            placeholder="Type in your prompt..."
            placeholderTextColor={colors.input.placeholder}
            value={promptText}
            onChangeText={setPromptText}
            multiline={false}
          />
          <TouchableOpacity style={styles.inputIcon}>
            <Mic size={20} color={colors.icon.default} strokeWidth={2} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.inputIcon}
            onPress={handleSendPrompt}
            disabled={!promptText.trim() || isEnhancing || uploading}
          >
            <Send size={20} color={(!promptText.trim() || isEnhancing || uploading) ? colors.icon.default : colors.button.arclight} strokeWidth={2} />
          </TouchableOpacity>
        </View>
      </Animated.View>
      )}

      <Sidebar />

      <LightingModal
        visible={arclightEngineVisible}
        onClose={() => setArclightEngineVisible(false)}
        onRelight={handleRelight}
        onEnhance={handleEnhanceImage}
        onFaceRestore={handleFaceRestore}
        onSubjectRemoval={handleSubjectRemoval}
        onObjectRemoval={handleObjectRemoval}
        onStyleTransfer={handleStyleTransfer}
      />

      {/* ENHANCE LOADING OVERLAY */}
      {isEnhancing && (
        <View style={[styles.enhanceOverlay, { backgroundColor: colors.background.overlayTransparent }]}>
          <Loader size={150} />
          <Text style={[styles.enhanceText, { color: colors.text.cream }]}>
            Fun fact: {getRandomFunFact()}
          </Text>
        </View>
      )}

      {/* SHARE LOADING OVERLAY */}
      {isSharing && (
        <View style={[styles.enhanceOverlay, { backgroundColor: colors.background.overlayTransparent }]}>
          <Loader size={150} />
          <Text style={[styles.enhanceText, { color: colors.text.cream }]}>
            Fun fact: {getRandomFunFact()}
          </Text>
        </View>
      )}

      {/* LOADING PROJECT IMAGE OVERLAY */}
      {loadingProjectImage && (
        <View style={[styles.enhanceOverlay, { backgroundColor: colors.background.overlayTransparent }]}>
          <Loader size={150} />
          <Text style={[styles.enhanceText, { color: colors.text.cream }]}>
            Fun fact: {getRandomFunFact()}
          </Text>
        </View>
      )}

      {/* FILTER MENU */}
      <FilterToolsMenu
        visible={filterMenuVisible}
        onClose={() => setFilterMenuVisible(false)}
        filterValues={filterValues}
        onFilterChange={handleFilterChange}
        imageUri={imageUri}
      />

      <CustomAlert
        visible={alertState.visible}
        type={alertState.type}
        title={alertState.title}
        message={alertState.message}
        onClose={hideAlert}
      />

      {/* DELETE CONFIRMATION MODAL */}
      <Modal
        visible={showDeleteConfirmation}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteConfirmation(false)}
      >
        <View style={styles.deleteModalOverlay}>
          <TouchableOpacity
            style={styles.deleteModalBackdrop}
            activeOpacity={1}
            onPress={() => setShowDeleteConfirmation(false)}
          />
          <View style={[styles.deleteModalContainer, { backgroundColor: '#FF6B6B' }]}>
            <View style={styles.deleteModalHeader}>
              <XCircle size={24} color="#8B0000" strokeWidth={2.5} />
              <Text style={[styles.deleteModalLabel, { color: '#1A1A1A' }]}>
                ERROR
              </Text>
            </View>
            <Text style={[styles.deleteModalMessage, { color: '#1A1A1A' }]}>
              Are you sure you want to delete this image? This will revert to an empty canvas.
            </Text>
            <View style={styles.deleteModalButtons}>
              <TouchableOpacity
                style={[styles.deleteModalButton, styles.deleteModalCancelButton]}
                onPress={() => setShowDeleteConfirmation(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.deleteModalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteModalButton, styles.deleteModalDeleteButton]}
                onPress={confirmDeleteImage}
                activeOpacity={0.8}
              >
                <Text style={styles.deleteModalDeleteText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
              setStyleTransferMode(false);
            }}
            activeOpacity={0.7}
          >
            <X size={32} color="#FFFFFF" strokeWidth={2.5} />
          </TouchableOpacity>
        </View>
      </Modal>
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

  // HEADER STYLES
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // CONTENT WRAPPER
  contentWrapper: {
    flex: 1,
    minHeight: 0,
  },

  // TAB STYLES
  tabsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 16,
    gap: 32,
  },
  tab: {
    paddingBottom: 4,
  },
  tabActive: {
    borderBottomWidth: 2,
  },
  tabText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  tabTextActive: {
    fontWeight: '700',
  },

  // SCROLL VIEW STYLES
  scrollWrapper: {
    flex: 1,
    flexDirection: 'row',
    minHeight: 0,
  },
  scrollView: {
    flex: 1,
    minHeight: 0,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },

  // CONTENT STYLES
  content: {
    paddingHorizontal: 20,
  },

  // IMAGE CONTAINER STYLES
  imageContainer: {
    alignSelf: 'center',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    minHeight: 200,
    maxHeight: CANVAS_HEIGHT,
  },
  imageWrapper: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  deleteButton: {
    position: 'absolute',
    top: 1,
    right: 1,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  imageTouchable: {
    width: '100%',
    height: '100%',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageLabelContainer: {
    position: 'absolute',
    top: 6,
    left: 6,
    right: 6,
    zIndex: 10,
    paddingVertical: 8,
    paddingHorizontal: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageLabelText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    fontFamily: 'geistmono',
  },
  objectRemovalInstruction: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginBottom: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  objectRemovalInstructionText: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  objectRemovalMarker: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FF0000',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 10,
  },
  imageLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // FILTER STATUS
  filterStatusContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  filterStatusText: {
    fontSize: 12,
    color: '#4A90E2',
    fontWeight: '600',
  },
  resetButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(74, 144, 226, 0.2)',
    borderRadius: 12,
  },
  resetButtonText: {
    fontSize: 12,
    color: '#4A90E2',
    fontWeight: '600',
  },

  // BLANK CANVAS STYLES
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
    bottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  uploadingText: {
    fontSize: 12,
    color: '#4A90E2',
    fontWeight: '500',
  },

  // BOTTOM BAR WRAPPER
  bottomBarWrapper: {
    position: 'relative',
  },
  bottomBarGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 20,
    zIndex: 0,
  },

  // BOTTOM BAR
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    zIndex: 0,
  },

  // ADJUST BUTTON
  adjustButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -8,
    },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 12,
  },

  // INPUT CONTAINER
  inputContainer: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 4,
    gap: 12,
  },
  input: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 12,
  },
  inputIcon: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ENHANCE LOADING OVERLAY
  enhanceOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2000,
  },
  enhanceText: {
    marginTop: 24,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  enhanceSubtext: {
    marginTop: 8,
    fontSize: 14,
    textAlign: 'center',
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
  },

  // DELETE CONFIRMATION MODAL STYLES
  deleteModalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 30,
  },
  deleteModalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  deleteModalContainer: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
    zIndex: 10,
  },
  deleteModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  deleteModalLabel: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'geistmono',
    letterSpacing: 0.5,
  },
  deleteModalMessage: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 22,
    marginBottom: 20,
    fontFamily: 'geistmono',
  },
  deleteModalButtons: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
  },
  deleteModalButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    minWidth: 80,
    alignItems: 'center',
  },
  deleteModalCancelButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  deleteModalDeleteButton: {
    backgroundColor: '#000',
  },
  deleteModalCancelText: {
    color: '#1A1A1A',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'geistmono',
  },
  deleteModalDeleteText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'geistmono',
  },

  // REFERENCE IMAGE OVERLAY - Outside Canvas
  referenceImageOverlay: {
    position: 'absolute',
    right: 20,
    bottom: -28, // Position below canvas area
    width: 120,
    padding: 10,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
    zIndex: 10,
  },
  referenceImageLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 4,
    textAlign: 'center',
  },
  referenceImage: {
    width: 84,
    height: 84,
    borderRadius: 8,
  },
});