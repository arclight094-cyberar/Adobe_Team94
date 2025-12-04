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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { G, Path } from 'react-native-svg';
import { PanelLeft, Share2, Mic, Send, Sliders } from 'lucide-react-native';
import Sidebar from '../../components/Sidebar';
import LightingModal from '../../components/LightingModal';
import Loader from '../../components/Loader';
import FilterToolsMenu from '../../components/FilterToolsMenu';
import ArclightEngineButton from '../../components/ArclightEngineButton';
import { useSidebar } from '../../context/SideBarContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from '../../services/api';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Sharing from 'expo-sharing';
import CustomAlert from '../../components/CustomAlert';
import { useAlert } from '../../hooks/useAlert';
import { getRandomFunFact } from '../../utils/funFacts';

import {
  FilterValues,
  defaultFilterValues,
} from '../../utils/filters';

const SCREEN_WIDTH = Dimensions.get('window').width;

// ============================================================
// LOGO COMPONENT
// ============================================================
const LogoIcon = ({ size = 48 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 707.9 631.64">
    <G id="Layer_3">
      <Path
        d="M856.46,719.56,722.79,488,558.61,772.39a12.25,12.25,0,0,1-.78,1.36l0,.07h0a14.85,14.85,0,0,1-5,4.65l-79.9,46.13H795.82C849.73,824.6,883.42,766.24,856.46,719.56Z"
        transform="translate(-158.05 -192.95)"
        fill="#ffffff"
      />
      <Path
        d="M427.8,706.3a14.71,14.71,0,0,1,1.54-6.63h0l0,0a13.16,13.16,0,0,1,.84-1.46l207-358.46L572.64,228c-26.95-46.69-94.33-46.69-121.28,0L167.54,719.56c-27,46.68,6.73,105,60.64,105H427.8Z"
        transform="translate(-158.05 -192.95)"
        fill="#ffffff"
      />
    </G>
  </Svg>
);

// ============================================================
// SAMPLE SUGGESTIONS DATA
// ============================================================
const sampleSuggestions = [
  'Make the photo look like fall',
  'Remove the pier',
  'Add dramatic lighting',
  'Convert to black and white',
  'Enhance colors',
  'Add vintage filter',
  'Remove background',
  'Add sunset glow',
];


// ============================================================
// FILTERED IMAGE COMPONENT
// Note: Real-time filters require native modules. For Expo Go compatibility,
// filters are applied via backend processing. The UI shows filter values
// but visual preview requires backend processing or development build.
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
  // Apply CSS-style visual filters for LIVE PREVIEW only
  const brightness = filterValues.brightness;
  const contrast = filterValues.contrast;
  const saturation = filterValues.saturation;
  const sharpen = filterValues.sharpen;
  
  // Calculate brightness multiplier (-50 to 50 -> 0.5 to 1.5)
  const brightnessMultiplier = 1 + (brightness / 100);
  
  return (
    <View style={[style, { overflow: 'hidden' }]}>
      {/* Base Image - brightness affects base image opacity */}
      <Image
        source={{ uri }}
        style={[
          { width: '100%', height: '100%' },
          { opacity: Math.max(0.3, Math.min(1, brightnessMultiplier)) }
        ]}
        resizeMode={resizeMode}
      />
      
      {/* BRIGHTNESS OVERLAYS - Applied first, independent of other filters */}
      {/* White overlay for positive brightness (brightening) */}
      {brightness > 0 && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: '#ffffff',
            opacity: brightness / 200, // 0 to 0.25 opacity
          }}
          pointerEvents="none"
        />
      )}
      
      {/* Black overlay for negative brightness (darkening) */}
      {brightness < 0 && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: '#000000',
            opacity: Math.abs(brightness) / 100, // 0 to 0.5 opacity
          }}
          pointerEvents="none"
        />
      )}
      
      {/* CONTRAST OVERLAYS - Applied on top, independent of brightness */}
      {/* Black overlay for positive contrast (increased contrast - darker midtones) */}
      {contrast > 0 && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: '#000000',
            opacity: contrast / 250, // 0 to 0.2 opacity for subtle effect
          }}
          pointerEvents="none"
        />
      )}
      
      {/* Gray overlay for negative contrast (decreased contrast - washed out) */}
      {contrast < 0 && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: '#808080',
            opacity: Math.abs(contrast) / 150, // 0 to 0.33 opacity for washed out effect
          }}
          pointerEvents="none"
        />
      )}

      {/* SATURATION OVERLAYS - Applied on top, independent of other filters */}
      {/* 
        Saturation Filter using CSS-style overlays
        Formula from Python: factor = (value + 50) / 50
        - value = -50 → factor = 0 → fully grayscale
        - value = 0   → factor = 1 → original
        - value = 50  → factor = 2 → double saturation
      */}
      
      {/* ========== DESATURATION (saturation < 0) ========== */}
      {/* 
        When factor < 1, we're moving towards grayscale.
        We overlay a gray that matches the image's average luminance.
        At factor = 0 (saturation = -50), image should be fully grayscale.
      */}
      {saturation < 0 && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            // Gray overlay - opacity increases as saturation decreases
            // At saturation = -50, opacity = 1 (full gray)
            // At saturation = 0, opacity = 0 (no overlay)
            backgroundColor: '#808080',
            opacity: Math.abs(saturation) / 50, // 0 to 1
          }}
          pointerEvents="none"
        />
      )}

      {/* ========== SATURATION BOOST (saturation > 0) ========== */}
      {/* 
        When factor > 1, we're boosting color intensity.
        We use subtle colored overlays to enhance perceived saturation.
        This is an approximation - true saturation needs pixel manipulation.
      */}
      {saturation > 0 && (
        <>
          {/* Method 1: Contrast boost to make colors pop */}
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              // Slight dark overlay increases perceived color intensity
              backgroundColor: '#000000',
              opacity: saturation / 300, // 0 to 0.167
            }}
            pointerEvents="none"
          />
          {/* Method 2: Subtle warm color overlay for vibrancy */}
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              // Warm tint adds perceived saturation
              backgroundColor: '#FF4500', // Orange-red
              opacity: saturation / 600, // 0 to 0.083
            }}
            pointerEvents="none"
          />
          {/* Method 3: Cool color to balance and add depth */}
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: '#00CED1', // Dark cyan
              opacity: saturation / 800, // 0 to 0.0625
            }}
            pointerEvents="none"
          />
        </>
      )}

      {/* SHARPEN OVERLAYS - Applied on top, independent of other filters */}
      {/* Soften/Blur effect for negative sharpen (blur approximation) */}
      {sharpen < 0 && (
        <>
          {/* White haze overlay to simulate blur/softness */}
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: '#FFFFFF',
              opacity: Math.abs(sharpen) / 200, // 0 to 0.25
            }}
            pointerEvents="none"
          />
          {/* Additional soft gray to reduce contrast (blur looks low contrast) */}
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: '#C0C0C0',
              opacity: Math.abs(sharpen) / 300, // 0 to 0.167
            }}
            pointerEvents="none"
          />
        </>
      )}

      {/* Sharpen effect for positive values (contrast + clarity boost) */}
      {sharpen > 0 && (
        <>
          {/* Dark overlay to increase perceived sharpness via contrast */}
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: '#000000',
              opacity: sharpen / 400, // 0 to 0.125 - subtle darkening
            }}
            pointerEvents="none"
          />
          {/* Edge enhancement illusion using border */}
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'transparent',
              borderWidth: sharpen > 25 ? 1 : 0,
              borderColor: `rgba(0, 0, 0, ${sharpen / 200})`, // Very subtle border
            }}
            pointerEvents="none"
          />
        </>
      )}
    </View>
  );
};

export default function Workspace() {
  // ============================================================
  // STATE MANAGEMENT
  // ============================================================
  const [activeTab, setActiveTab] = useState<'workspace' | 'history'>('workspace');
  const { openSidebar } = useSidebar();
  const { alertState, showAlert, hideAlert } = useAlert();
  const [promptText, setPromptText] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [publicId, setPublicId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [filterMenuVisible, setFilterMenuVisible] = useState(false);
  const [arclightEngineVisible, setArclightEngineVisible] = useState(false);
  const [filterValues, setFilterValues] = useState<FilterValues>(defaultFilterValues);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number; aspectRatio: number } | null>(null);
  const [imageLoading, setImageLoading] = useState(true);
  const [canScroll, setCanScroll] = useState(false);
  const scrollViewHeight = useRef(0);
  const contentHeight = useRef(0);
  const inputBottomOffset = useRef(new Animated.Value(0)).current;
  const suggestionsOpacity = useRef(new Animated.Value(0)).current;


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
  // LOAD IMAGE FROM STORAGE
  // ============================================================
  useEffect(() => {
    const loadImage = async () => {
      const storedUri = await AsyncStorage.getItem('selected_image_uri');
      if (storedUri) {
        setImageUri(storedUri);
      } else {
        setImageUri('https://images.pexels.com/photos/1133957/pexels-photo-1133957.jpeg?auto=compress&cs=tinysrgb&w=600');
      }

      const storedPublicId = await AsyncStorage.getItem('current_public_id');
      if (storedPublicId) {
        setPublicId(storedPublicId);
      }
    };
    loadImage();
  }, []);

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
    }
  }, [imageUri]);

  // ============================================================
  // INITIALIZE SUGGESTIONS
  // ============================================================
  useEffect(() => {
    generateSuggestions();
    suggestionsOpacity.setValue(1);
  }, []);

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
      showAlert('error', 'No Image Selected', 'Please upload an image first before using the enhance feature.');
      return;
    }

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

      setImageUri(enhancedImageUrl);
      await AsyncStorage.setItem('selected_image_uri', enhancedImageUrl);
      await AsyncStorage.setItem('current_public_id', enhancedPublicId);
      setPublicId(enhancedPublicId);

      // Reset filters when new image is loaded
      setFilterValues(defaultFilterValues);

      const successMessage = enhanceResult.data.message ||
        `Image has been ${mode === 'denoise' ? 'denoised' : 'deblurred'} successfully!`;

      showAlert('success', 'Enhancement Complete', successMessage);
    } catch (error: any) {
      console.error('Error enhancing image:', error);

      showAlert('error', 'Enhancement Failed', error.message || 'Failed to enhance image. Please try again.');
    } finally {
      setIsEnhancing(false);
    }
  };

  // ============================================================
  // REMOVE SUBJECT FUNCTION
  // ============================================================
  const handleSubjectRemoval = async () => {
    if (!publicId) {
      showAlert('error', 'No Image Selected', 'Please upload an image first before using this feature.');
      return;
    }

    setIsEnhancing(true);

    try {
      const result = await ApiService.removeBackground(publicId, 'human');

      if (!result.response.ok || !result.data.success) {
        throw new Error(result.data.message || 'Failed to remove subject');
      }

      const responseData = result.data.data;
      const processedImageUrl = responseData.processedImageUrl;
      const processedPublicId = responseData.publicId;

      if (!processedImageUrl || !processedPublicId) {
        throw new Error('Invalid response: missing processed image data');
      }

      setImageUri(processedImageUrl);
      await AsyncStorage.setItem('selected_image_uri', processedImageUrl);
      await AsyncStorage.setItem('current_public_id', processedPublicId);
      setPublicId(processedPublicId);

      // Reset filters when new image is loaded
      setFilterValues(defaultFilterValues);

      showAlert('success', 'Subject Removed', 'Subject has been removed from the image successfully!');
    } catch (error: any) {
      console.error('Error removing subject:', error);
      showAlert('error', 'Removal Failed', error.message || 'Failed to remove subject. Please try again.');
    } finally {
      setIsEnhancing(false);
    }
  };

  // ============================================================
  // REMOVE OBJECT FUNCTION
  // ============================================================
  const handleObjectRemoval = async () => {
    if (!publicId) {
      Alert.alert(
        'No Image Selected',
        'Please upload an image first before using this feature.',
        [{ text: 'OK' }]
      );
      return;
    }

    setIsEnhancing(true);

    try {
      const result = await ApiService.removeBackground(publicId, 'object');

      if (!result.response.ok || !result.data.success) {
        throw new Error(result.data.message || 'Failed to remove object');
      }

      const responseData = result.data.data;
      const processedImageUrl = responseData.processedImageUrl;
      const processedPublicId = responseData.publicId;

      if (!processedImageUrl || !processedPublicId) {
        throw new Error('Invalid response: missing processed image data');
      }

      setImageUri(processedImageUrl);
      await AsyncStorage.setItem('selected_image_uri', processedImageUrl);
      await AsyncStorage.setItem('current_public_id', processedPublicId);
      setPublicId(processedPublicId);

      // Reset filters when new image is loaded
      setFilterValues(defaultFilterValues);

      showAlert('success', 'Object Removed', 'Object has been removed from the image successfully!');
    } catch (error: any) {
      console.error('Error removing object:', error);
      showAlert('error', 'Removal Failed', error.message || 'Failed to remove object. Please try again.');
    } finally {
      setIsEnhancing(false);
    }
  };

  // ============================================================
  // STYLE TRANSFER FUNCTION
  // ============================================================
  const handleStyleTransfer = async () => {
    showAlert('warning', 'Style Transfer', 'Style transfer requires selecting a style image. This feature will be available soon.');
  };

  // ============================================================
  // RESET ALL FILTERS
  // ============================================================
  const handleResetFilters = () => {
    setFilterValues(defaultFilterValues);
  };

  // ============================================================
  // GENERATE RANDOM SUGGESTIONS
  // ============================================================
  const generateSuggestions = () => {
    const shuffled = [...sampleSuggestions].sort(() => 0.5 - Math.random());
    setSuggestions(shuffled.slice(0, 2));
  };

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
      showAlert('error', 'No Image', 'Please select an image first');
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
        showAlert('warning', 'Filters Not Applied', 'Filters can only be applied to Cloudinary images. The original image will be shared.');
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
      showAlert('error', 'Share Failed', error.message || 'Failed to share image. Please try again.');
    } finally {
      setIsSharing(false);
    }
  };


  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* HEADER / NAVBAR */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={openSidebar}
        >
          <PanelLeft size={28} color="#FFF" strokeWidth={2.5} />
        </TouchableOpacity>

        <View style={styles.logoContainer}>
          <LogoIcon size={28} />
        </View>

        <TouchableOpacity 
          style={styles.headerButton}
          onPress={handleShareImage}
        >
          <Share2 size={28} color="#FFF" strokeWidth={2.5} />
        </TouchableOpacity>
      </View>

      {/* SCROLLABLE CONTENT AREA */}
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
          {/* TABS: WORKSPACE / HISTORY */}
          <View style={styles.tabsContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'workspace' && styles.tabActive]}
              onPress={() => setActiveTab('workspace')}
            >
              <Text style={[styles.tabText, activeTab === 'workspace' && styles.tabTextActive]}>
                WORKSPACE
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tab, activeTab === 'history' && styles.tabActive]}
              onPress={() => setActiveTab('history')}
            >
              <Text style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}>
                HISTORY
              </Text>
            </TouchableOpacity>
          </View>

          {/* MAIN CONTENT */}
          <View style={styles.content}>
            {/* Image Container with Real-Time Filters */}
            <View style={[
              styles.imageContainer,
              imageDimensions && {
                height: (Dimensions.get('window').width - 40) / imageDimensions.aspectRatio
              }
            ]}>
              {imageLoading ? (
                <View style={styles.imageLoadingContainer}>
                  <Loader size={120} />
                </View>
              ) : (
                imageUri && (
                  <FilteredImage
                    uri={imageUri}
                    filterValues={filterValues}
                    style={styles.image}
                    resizeMode="contain"
                  />
                )
              )}
            </View>

            {/* Filter Status Indicator */}
            {hasActiveFilters() && (
              <View style={styles.filterStatusContainer}>
                <Text style={styles.filterStatusText}>
                  Filters Active
                </Text>
                <TouchableOpacity
                  onPress={handleResetFilters}
                  style={styles.resetButton}
                >
                  <Text style={styles.resetButtonText}>Reset All</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* AI Suggestions Section */}
            <View style={styles.suggestionsWrapper}>
              <View style={styles.suggestionsContainer}>
                <View style={styles.suggestionsHeader}>
                  <Text style={styles.suggestionsTitle}>AI auto-suggestions</Text>
                  {canScroll && (
                    <Text style={styles.scrollDownText}>Scroll down</Text>
                  )}
                </View>

                <Animated.View
                  style={{
                    opacity: suggestionsOpacity,
                    gap: 12,
                  }}
                >
                  {suggestions.map((suggestion, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.suggestionButton}
                    >
                      <Text style={styles.suggestionText}>{suggestion}</Text>
                    </TouchableOpacity>
                  ))}
                </Animated.View>
              </View>
            </View>
          </View>
        </ScrollView>
      </View>

      {/* BOTTOM BAR WITH BUTTONS */}
      {!keyboardVisible && (
        <View style={styles.bottomBarWrapper}>
          {canScroll && (
            <LinearGradient
              colors={['rgba(26, 26, 26, 0)', 'rgba(26, 26, 26, 0.8)', '#1a1a1a']}
              locations={[0, 0.5, 1]}
              style={styles.bottomBarGradient}
              pointerEvents="none"
            />
          )}
          <View style={styles.bottomBar}>
            <TouchableOpacity
              style={[
                styles.adjustButton,
                hasActiveFilters() && styles.adjustButtonActive,
              ]}
              onPress={() => setFilterMenuVisible(true)}
            >
              <Sliders size={24} color={hasActiveFilters() ? "#FFF" : "#000"} strokeWidth={2} />
            </TouchableOpacity>

            <ArclightEngineButton
              onPress={() => setArclightEngineVisible(true)}
              disabled={isEnhancing}
            />
          </View>
        </View>
      )}

      {/* INPUT AREA */}
      <Animated.View
        style={[
          styles.inputContainer,
          {
            marginBottom: inputBottomOffset,
          }
        ]}
      >
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            placeholder="Type in your prompt..."
            placeholderTextColor="#666"
            value={promptText}
            onChangeText={setPromptText}
            multiline={false}
          />
          <TouchableOpacity style={styles.inputIcon}>
            <Mic size={20} color="#AAA" strokeWidth={2} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.inputIcon}>
            <Send size={20} color="#AAA" strokeWidth={2} />
          </TouchableOpacity>
        </View>
      </Animated.View>

      <Sidebar />

      <LightingModal
        visible={arclightEngineVisible}
        onClose={() => setArclightEngineVisible(false)}
        onEnhance={handleEnhanceImage}
        onSubjectRemoval={handleSubjectRemoval}
        onObjectRemoval={handleObjectRemoval}
        onStyleTransfer={handleStyleTransfer}
      />

      {/* ENHANCE LOADING OVERLAY */}
      {isEnhancing && (
        <View style={styles.enhanceOverlay}>
          <Loader size={150} />
          <Text style={styles.enhanceText}>
            Fun fact: {getRandomFunFact()}
          </Text>
        </View>
      )}

      {/* SHARE LOADING OVERLAY */}
      {isSharing && (
        <View style={styles.enhanceOverlay}>
          <Loader size={150} />
          <Text style={styles.enhanceText}>
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

      {/* Custom Alert */}
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
    backgroundColor: '#1a1a1a',
  },

  // HEADER STYLES
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: 48,
    height: 48,
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
    backgroundColor: '#1a1a1a',
  },
  tab: {
    paddingBottom: 4,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#FFF',
  },
  tabText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
    letterSpacing: 0.5,
  },
  tabTextActive: {
    color: '#FFF',
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
    width: '100%',
    maxWidth: '100%',
    alignSelf: 'center',
    borderRadius: 1,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 0,
    borderColor: '#808080',
    backgroundColor: '#000',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
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

  // SUGGESTIONS STYLES
  suggestionsWrapper: {
    position: 'relative',
    marginTop: 8,
    marginBottom: 20,
    paddingHorizontal: 0,
    zIndex: 10,
  },
  suggestionsContainer: {
    gap: 12,
    paddingBottom: 50,
  },
  suggestionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 0,
  },
  suggestionsTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#999',
  },
  scrollDownText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#999',
  },
  suggestionButton: {
    backgroundColor: '#4A4E8D',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginBottom: 0,
    minWidth: 120,
  },
  suggestionText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#FFF',
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
    backgroundColor: '#1a1a1a',
    zIndex: 0,
  },

  // ADJUST BUTTON
  adjustButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#E8E8E8',
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
  adjustButtonActive: {
    backgroundColor: '#4A4E8D',
  },

  // INPUT CONTAINER
  inputContainer: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#1a1a1a',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'black',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 4,
    gap: 12,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#FFF',
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
    backgroundColor: 'rgba(26, 26, 26, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2000,
  },
  enhanceText: {
    marginTop: 24,
    fontSize: 18,
    fontWeight: '600',
    color: '#e8e5d8',
    textAlign: 'center',
  },
  enhanceSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});