// This will be the history page for the app

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Dimensions,
} from 'react-native';
import {
  RotateCcw,
  Sun,
  Sparkles,
  Smile,
  Scissors,
  Eraser,
  Palette,
  ImageIcon,
  Clock,
  ChevronUp,
} from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { useAlert } from '../../hooks/useAlert';
import CustomAlert from '../../components/CustomAlert';
import Loader from '../../components/Loader';
import ApiService from '../../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SCREEN_WIDTH = Dimensions.get('window').width;
const IMAGE_WIDTH = SCREEN_WIDTH - 80; // Padding on both sides
const IMAGE_HEIGHT = IMAGE_WIDTH * 0.75; // 4:3 aspect ratio default

// ============================================================
// TYPES
// ============================================================
interface TimelineImage {
  imageUrl: string;
  publicId: string;
  width?: number;
  height?: number;
}

interface TimelineEntry {
  index: number; // -1 for original, 0+ for operations
  operationType: string;
  image: TimelineImage; // Output image
  inputImage?: TimelineImage; // Input image - for style-transfer this is the BASE image (Image 1)
  timestamp: string;
  prompt?: any;
  processingTime?: number;
  status: 'completed' | 'failed';
}

interface HistoryProps {
  onRevertToOperation?: (operationIndex: number, imageData: TimelineImage) => void;
  onUndoLast?: () => void;
  refreshKey?: number; // Increment to force refresh
}

// ============================================================
// HISTORY COMPONENT
// ============================================================
export default function History({ onRevertToOperation, onUndoLast, refreshKey }: HistoryProps) {
  const { colors, isDark } = useTheme();
  const { alertState, showAlert, hideAlert } = useAlert();
  
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isReverting, setIsReverting] = useState(false);

  // ============================================================
  // FETCH TIMELINE
  // ============================================================
  const fetchTimeline = useCallback(async () => {
    try {
      const storedProjectId = await AsyncStorage.getItem('current_project_id');
      
      if (!storedProjectId) {
        setTimeline([]);
        setIsLoading(false);
        return;
      }

      setProjectId(storedProjectId);

      const result = await ApiService.getAIProjectTimeline(storedProjectId);

      if (result.response.ok && result.data.success) {
        const timelineData = result.data.data?.timeline || [];
        // Sort by index ascending (original first, then operations in order)
        const sortedTimeline = timelineData.sort((a: TimelineEntry, b: TimelineEntry) => a.index - b.index);
        
        // Find the first style transfer operation to get the base/input image
        const firstStyleTransfer = sortedTimeline.find(
          (entry: TimelineEntry) => entry.operationType === 'style-transfer' && entry.inputImage
        );
        
        // If there's a style transfer operation, replace the original image with its input image
        if (firstStyleTransfer && firstStyleTransfer.inputImage) {
          const originalIndex = sortedTimeline.findIndex((entry: TimelineEntry) => entry.index === -1);
          if (originalIndex !== -1) {
            sortedTimeline[originalIndex] = {
              ...sortedTimeline[originalIndex],
              image: firstStyleTransfer.inputImage, // Use base image (Image 1) as original
            };
          }
        }
        
        setTimeline(sortedTimeline);
      } else {
        console.log('No timeline data or error:', result.data.message);
        setTimeline([]);
      }
    } catch (error: any) {
      console.error('Error fetching timeline:', error);
      setTimeline([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchTimeline();
  }, [fetchTimeline]);

  // Refresh when refreshKey changes
  useEffect(() => {
    if (refreshKey !== undefined && refreshKey > 0) {
      fetchTimeline();
    }
  }, [refreshKey, fetchTimeline]);

  // ============================================================
  // HANDLE REFRESH
  // ============================================================
  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchTimeline();
  };

  // ============================================================
  // HANDLE REVERT TO OPERATION
  // ============================================================
  const handleRevertToOperation = async (operationIndex: number, imageData: TimelineImage) => {
    if (!projectId) {
      showAlert('error', 'Error', 'No project found');
      return;
    }

    setIsReverting(true);

    try {
      const result = await ApiService.revertAIProject(projectId, operationIndex);

      if (result.response.ok && result.data.success) {
        // Update AsyncStorage with reverted image
        await AsyncStorage.setItem('selected_image_uri', imageData.imageUrl);
        await AsyncStorage.setItem('current_public_id', imageData.publicId);

        // Notify parent component
        if (onRevertToOperation) {
          onRevertToOperation(operationIndex, imageData);
        }

        // Refresh timeline
        await fetchTimeline();

        showAlert(
          'success',
          'Reverted',
          operationIndex === -1 
            ? 'Reverted to original image' 
            : `Reverted to step ${operationIndex + 1}`
        );
      } else {
        throw new Error(result.data.message || 'Failed to revert');
      }
    } catch (error: any) {
      console.error('Error reverting:', error);
      showAlert('error', 'Revert Failed', error.message || 'Failed to revert to selected image');
    } finally {
      setIsReverting(false);
    }
  };

  // ============================================================
  // HANDLE UNDO LAST
  // ============================================================
  const handleUndoLast = async () => {
    if (!projectId) {
      showAlert('error', 'Error', 'No project found');
      return;
    }

    if (timeline.length <= 1) {
      showAlert('warning', 'Nothing to Undo', 'No operations to undo');
      return;
    }

    setIsReverting(true);

    try {
      const result = await ApiService.undoAIProjectOperation(projectId);

      if (result.response.ok && result.data.success) {
        const currentImage = result.data.data?.currentImage;
        
        if (currentImage) {
          await AsyncStorage.setItem('selected_image_uri', currentImage.imageUrl);
          await AsyncStorage.setItem('current_public_id', currentImage.publicId);
        }

        // Notify parent component
        if (onUndoLast) {
          onUndoLast();
        }

        // Refresh timeline
        await fetchTimeline();

        showAlert('success', 'Undone', 'Last operation has been undone');
      } else {
        throw new Error(result.data.message || 'Failed to undo');
      }
    } catch (error: any) {
      console.error('Error undoing:', error);
      showAlert('error', 'Undo Failed', error.message || 'Failed to undo last operation');
    } finally {
      setIsReverting(false);
    }
  };

  // ============================================================
  // GET OPERATION LABEL
  // ============================================================
  const getOperationLabel = (operationType: string, prompt?: any): string => {
    switch (operationType) {
      case 'original':
        return 'Original Image';
      case 'relight':
        const brightness = prompt?.brightness || 1;
        return brightness > 1 ? 'Brightened' : 'Darkened';
      case 'enhance':
        const mode = prompt?.mode || 'denoise';
        return mode === 'denoise' ? 'Removed Noise' : 'Removed Blur';
      case 'face-restore':
        return 'Restored Face';
      case 'style-transfer':
        return 'Applied Style';
      case 'remove-background':
        const bgMode = prompt?.mode || 'human';
        return bgMode === 'human' ? 'Removed Subject' : 'Removed Background';
      case 'object-removal':
        return 'Removed Object';
      default:
        return operationType.charAt(0).toUpperCase() + operationType.slice(1).replace(/-/g, ' ');
    }
  };

  // ============================================================
  // GET OPERATION ICON
  // ============================================================
  const getOperationIcon = (operationType: string) => {
    const iconColor = colors.text.primary;
    const iconSize = 16;
    
    switch (operationType) {
      case 'original':
        return <ImageIcon size={iconSize} color={iconColor} strokeWidth={2} />;
      case 'relight':
        return <Sun size={iconSize} color={iconColor} strokeWidth={2} />;
      case 'enhance':
        return <Sparkles size={iconSize} color={iconColor} strokeWidth={2} />;
      case 'face-restore':
        return <Smile size={iconSize} color={iconColor} strokeWidth={2} />;
      case 'style-transfer':
        return <Palette size={iconSize} color={iconColor} strokeWidth={2} />;
      case 'remove-background':
        return <Scissors size={iconSize} color={iconColor} strokeWidth={2} />;
      case 'object-removal':
        return <Eraser size={iconSize} color={iconColor} strokeWidth={2} />;
      default:
        return <Clock size={iconSize} color={iconColor} strokeWidth={2} />;
    }
  };

  // ============================================================
  // RENDER EMPTY STATE
  // ============================================================
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <ImageIcon size={64} color={colors.text.tertiary} strokeWidth={1.5} />
      <Text style={[styles.emptyTitle, { color: colors.text.primary }]}>
        No History Yet
      </Text>
      <Text style={[styles.emptySubtitle, { color: colors.text.secondary }]}>
        Upload an image and apply AI operations to see your edit history here
      </Text>
    </View>
  );

  // ============================================================
  // RENDER LOADING STATE
  // ============================================================
  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: isDark ? colors.background.dark : colors.background.cream }]}>
        <Loader size={80} />
        <Text style={[styles.loadingText, { color: colors.text.secondary }]}>
          Loading history...
        </Text>
      </View>
    );
  }

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <View style={[styles.container, { backgroundColor: isDark ? colors.background.dark : colors.background.cream }]}>
      {/* Undo Button at Top */}
      {timeline.length > 1 && (
        <View style={styles.undoContainer}>
          <TouchableOpacity
            style={[styles.undoButton, { backgroundColor: isDark ? '#2a2a2a' : '#f0f0f0' }]}
            onPress={handleUndoLast}
            disabled={isReverting}
          >
            <RotateCcw size={18} color={colors.text.primary} strokeWidth={2} />
            <Text style={[styles.undoButtonText, { color: colors.text.primary }]}>
              Undo Last
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.text.primary}
          />
        }
      >
        {timeline.length === 0 ? (
          renderEmptyState()
        ) : (
          <View style={styles.timelineContainer}>
            {/* Render timeline in reverse order (newest at top) */}
            {[...timeline].reverse().map((entry, displayIndex) => {
              const isFirst = displayIndex === 0; // Newest/current image
              const isLast = displayIndex === timeline.length - 1; // Original image
              
              return (
                <View key={`${entry.index}-${entry.timestamp}`} style={styles.timelineItem}>
                  {/* Connector Line (not for first item) */}
                  {!isFirst && (
                    <View style={styles.connectorContainer}>
                      <View style={[styles.connectorLine, { backgroundColor: colors.border.primary }]} />
                      <View style={[styles.connectorDot, { backgroundColor: colors.button.arclight }]}>
                        <ChevronUp size={12} color="#FFFFFF" strokeWidth={3} />
                      </View>
                      <View style={[styles.connectorLine, { backgroundColor: colors.border.primary }]} />
                    </View>
                  )}

                  {/* Operation Label */}
                  <View style={[styles.operationLabelContainer, { backgroundColor: isDark ? '#1E3A5F' : '#E3F2FD' }]}>
                    {getOperationIcon(entry.operationType)}
                    <Text style={[styles.operationLabelText, { color: isDark ? '#90CAF9' : '#1565C0' }]}>
                      {getOperationLabel(entry.operationType, entry.prompt)}
                    </Text>
                    {isFirst && (
                      <View style={[styles.currentBadge, { backgroundColor: colors.button.arclight }]}>
                        <Text style={styles.currentBadgeText}>CURRENT</Text>
                      </View>
                    )}
                  </View>

                  {/* Image Card */}
                  <View style={[styles.imageCard, { 
                    backgroundColor: isDark ? '#1a1a1a' : '#ffffff',
                    borderColor: isFirst ? colors.button.arclight : colors.border.primary,
                    borderWidth: isFirst ? 2 : 1,
                  }]}>
                    {/* Step Indicator */}
                    <View style={[styles.stepIndicator, { backgroundColor: isDark ? '#2a2a2a' : '#f5f5f5' }]}>
                      <Text style={[styles.stepText, { color: colors.text.secondary }]}>
                        {entry.index === -1 ? 'ORIGINAL' : `STEP ${entry.index + 1}`}
                      </Text>
                    </View>

                    {/* Image Container - Show output image for all operations (follows timeline flow) */}
                    <View style={styles.imageContainerWithReference}>
                      {/* Main Image - Always show output image (Image 3 for style transfer) */}
                      <Image
                        source={{ uri: entry.image.imageUrl }}
                        style={[styles.timelineImage, {
                          width: IMAGE_WIDTH - 2, // Account for border
                          height: entry.image.height && entry.image.width 
                            ? ((IMAGE_WIDTH - 2) / entry.image.width) * entry.image.height
                            : IMAGE_HEIGHT,
                          maxHeight: IMAGE_HEIGHT * 1.5,
                        }]}
                        resizeMode="contain"
                      />
                    </View>

                    {/* Revert Button (not for current image) */}
                    {!isFirst && (
                      <TouchableOpacity
                        style={[styles.revertButton, { backgroundColor: isDark ? '#2a2a2a' : '#f0f0f0' }]}
                        onPress={() => handleRevertToOperation(entry.index, entry.image)}
                        disabled={isReverting}
                      >
                        <RotateCcw size={14} color={colors.text.primary} strokeWidth={2} />
                        <Text style={[styles.revertButtonText, { color: colors.text.primary }]}>
                          Revert to this
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Original Badge at Bottom */}
                  {isLast && entry.index === -1 && (
                    <View style={styles.originalBadgeContainer}>
                      <View style={[styles.originalBadge, { backgroundColor: isDark ? '#2a2a2a' : '#e8e8e8' }]}>
                        <View style={[styles.originalDot, { backgroundColor: colors.button.arclight }]} />
                        <Text style={[styles.originalBadgeText, { color: colors.text.secondary }]}>
                          Starting Point
                        </Text>
                      </View>
                    </View>
                  )}

                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Reverting Overlay */}
      {isReverting && (
        <View style={[styles.revertingOverlay, { backgroundColor: colors.background.overlayTransparent }]}>
          <Loader size={100} />
          <Text style={[styles.revertingText, { color: colors.text.cream }]}>
            Reverting...
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
    </View>
  );
}

// ============================================================
// STYLES
// ============================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
  },
  
  // Undo Button
  undoContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    alignItems: 'flex-end',
  },
  undoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 8,
  },
  undoButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Scroll View
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 24,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Timeline
  timelineContainer: {
    paddingTop: 8,
  },
  timelineItem: {
    alignItems: 'center',
  },

  // Connector
  connectorContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  connectorLine: {
    width: 2,
    height: 20,
  },
  connectorDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 4,
  },

  // Operation Label
  operationLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
    marginBottom: 12,
  },
  operationLabelText: {
    fontSize: 13,
    fontWeight: '600',
  },
  currentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 4,
  },
  currentBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },

  // Image Card
  imageCard: {
    width: IMAGE_WIDTH,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 8,
  },
  stepIndicator: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  stepText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  timelineImage: {
    alignSelf: 'center',
  },
  revertButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  revertButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Original Badge
  originalBadgeContainer: {
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 20,
  },
  originalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    gap: 8,
  },
  originalDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  originalBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Reverting Overlay
  revertingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  revertingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
  },
  // Image Container with Reference Image (for style transfer)
  imageContainerWithReference: {
    position: 'relative',
    width: '100%',
  },
  // Reference Image Inline (shows base/content image for style transfer)
  referenceImageInline: {
    position: 'absolute',
    right: 12,
    top: 12,
    width: 80,
    padding: 6,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  referenceImageInlineLabel: {
    fontSize: 9,
    fontWeight: '600',
    marginBottom: 4,
    textAlign: 'center',
  },
  referenceImageInlineImage: {
    width: 68,
    height: 68,
    borderRadius: 6,
    overflow: 'hidden',
  },
});