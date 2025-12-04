import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Image,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import Navbar from '../../components/Navbar';
import { useTheme } from '../../context/ThemeContext';
import ApiService from '../../services/api';
import CustomAlert from '../../components/CustomAlert';
import { useAlert } from '../../hooks/useAlert';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Loader from '../../components/Loader';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Layer-based project interface
interface LayerProject {
  type: 'layer-based';
  projectId: string;
  title: string;
  thumbnail: string | null;
  canvas: {
    width: number;
    height: number;
    backgroundColor: string;
  };
  totalLayers: number;
  createdAt: string;
  updatedAt: string;
}

// AI Sequential project interface
interface AIProject {
  type: 'ai-sequential';
  projectId: string;
  title: string;
  description?: string;
  thumbnail: {
    imageUrl: string;
    publicId: string;
  } | null;
  currentImage?: {
    imageUrl: string;
    publicId: string;
    width: number;
    height: number;
  };
  totalOperations: number;
  lastOperation?: string;
  createdAt: string;
  updatedAt: string;
}

type Project = LayerProject | AIProject;

export default function Projects() {
  const [searchQuery, setSearchQuery] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [renameProjectId, setRenameProjectId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const { colors, isDark } = useTheme();
  const { alertState, showAlert, hideAlert } = useAlert();

  // Format date in a user-friendly way
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) {
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      return days[date.getDay()];
    }
    
    const month = date.toLocaleString('en-US', { month: 'short' });
    const day = date.getDate();
    const year = date.getFullYear();
    const currentYear = now.getFullYear();
    
    if (year === currentYear) {
      return `${month} ${day}`;
    }
    
    return `${month} ${day}, ${year}`;
  };

  // Load projects from backend (both layer-based and AI sequential)
  const loadProjects = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    
    try {
      // Fetch layer-based projects
      const layerProjectsResult = await ApiService.getAllProjects({
        sort: '-updatedAt',
      });

      // Fetch AI sequential projects
      const aiProjectsResult = await ApiService.getAllAIProjects({
        status: 'active',
      });

      const layerProjects: LayerProject[] = [];
      const aiProjects: AIProject[] = [];

      // Process layer-based projects
      if (layerProjectsResult.response.ok && layerProjectsResult.data.success === true) {
        const layerData = layerProjectsResult.data.data || [];
        layerProjects.push(...layerData.map((p: any) => ({
          ...p,
          type: 'layer-based' as const,
        })));
      }

      // Process AI sequential projects
      if (aiProjectsResult.response.ok && aiProjectsResult.data.success === true) {
        const aiData = aiProjectsResult.data.data || [];
        aiProjects.push(...aiData.map((p: any) => ({
          ...p,
          type: 'ai-sequential' as const,
        })));
      }

      // Combine and sort by updatedAt
      const allProjects = [...layerProjects, ...aiProjects].sort((a, b) => {
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });

      setProjects(allProjects);
    } catch (error: any) {
      console.error('Error loading projects:', error);
      showAlert('error', 'Error', error.message || 'Failed to load projects');
    } finally {
      if (showLoader) setLoading(false);
      setRefreshing(false);
    }
  }, [showAlert]);

  // Load projects on mount
  useEffect(() => {
    loadProjects();
  }, []);

  // Refresh projects (pull to refresh)
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadProjects(false);
  }, [loadProjects]);

  const filteredProjects = projects.filter((project) =>
    project.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getCardWidth = () => {
    const padding = 40;
    const gap = 20;
    const availableWidth = SCREEN_WIDTH - padding;
    const cardWidth = (availableWidth - gap) / 2;
    return cardWidth;
  };

  const handleRename = (projectId: string, currentTitle: string) => {
    setRenameProjectId(projectId);
    setNewTitle(currentTitle);
    setOpenMenuId(null);
  };

  const handleRenameSubmit = async () => {
    if (!renameProjectId || !newTitle.trim()) return;

    try {
      const project = projects.find(p => p.projectId === renameProjectId);
      if (!project) return;

      let result;
      if (project.type === 'layer-based') {
        result = await ApiService.updateProjectTitle(renameProjectId, newTitle.trim());
      } else {
        result = await ApiService.updateAIProject(renameProjectId, { title: newTitle.trim() });
      }

      if (result.response.ok && result.data.success === true) {
        // Update local state
        setProjects(projects.map(p => 
          p.projectId === renameProjectId ? { ...p, title: newTitle.trim() } : p
        ));
        setRenameProjectId(null);
        setNewTitle('');
        showAlert('success', 'Success', 'Project renamed successfully');
      } else {
        throw new Error(result.data.message || 'Failed to rename project');
      }
    } catch (error: any) {
      console.error('Error renaming project:', error);
      showAlert('error', 'Error', error.message || 'Failed to rename project');
    }
  };

  const handleDelete = (projectId: string) => {
    setOpenMenuId(null);
    
    const project = projects.find(p => p.projectId === projectId);
    if (!project) return;

    Alert.alert(
      'Delete Project',
      'Are you sure you want to delete this project? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              let result;
              if (project.type === 'layer-based') {
                result = await ApiService.deleteProject(projectId);
              } else {
                result = await ApiService.deleteAIProject(projectId, false); // Soft delete
              }

              if (result.response.ok || result.response.status === 204) {
                // Remove from local state
                setProjects(projects.filter(p => p.projectId !== projectId));
                showAlert('success', 'Success', 'Project deleted successfully');
              } else {
                throw new Error(result.data?.message || 'Failed to delete project');
              }
            } catch (error: any) {
              console.error('Error deleting project:', error);
              showAlert('error', 'Error', error.message || 'Failed to delete project');
            }
          },
        },
      ]
    );
  };

  const handleProjectPress = async (project: Project) => {
    // Store project ID and navigate to appropriate workspace
    await AsyncStorage.setItem('current_project_id', project.projectId);
    await AsyncStorage.setItem('project_type', project.type);
    
    if (project.type === 'layer-based') {
      router.push('/(app)/flowspace');
    } else {
      router.push('/(app)/labspace');
    }
  };

  // Get thumbnail image URL
  const getThumbnailUrl = (project: Project): string | null => {
    if (project.type === 'layer-based') {
      return project.thumbnail;
    } else {
      // AI sequential project - return thumbnail imageUrl
      return project.thumbnail?.imageUrl || null;
    }
  };

  // Get project type label
  const getProjectTypeLabel = (project: Project): string => {
    return project.type === 'layer-based' ? 'Layers' : 'AI Edit';
  };

  // Get project info (layers count or operations count)
  const getProjectInfo = (project: Project): string => {
    if (project.type === 'layer-based') {
      return `${project.totalLayers} layer${project.totalLayers !== 1 ? 's' : ''}`;
    } else {
      return `${project.totalOperations} operation${project.totalOperations !== 1 ? 's' : ''}`;
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#1A1A1A' : '#E8E5D8' }]} edges={['top']}>
      <Navbar screenName="PROJECTS" />

      {/* BACKDROP when menu open */}
      {openMenuId !== null && (
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={() => setOpenMenuId(null)}
        />
      )}

      {/* SEARCH BAR */}
      <View style={[styles.searchContainer, { backgroundColor: isDark ? '#2A2A2A' : '#FFFFFF', borderColor: isDark ? '#3A3A3A' : '#D0CDB8', borderWidth: 1 }]}>
        <Feather name="search" size={20} color={isDark ? '#B0B0B0' : '#666666'} style={styles.searchIcon} />
        <TextInput
          style={[styles.searchInput, { color: isDark ? '#FFFFFF' : '#1A1A1A' }]}
          placeholder="Search"
          placeholderTextColor={isDark ? '#808080' : '#999999'}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* GRID */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.button.arclight}
          />
        }
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <Loader size={120} />
            <Text style={[styles.loadingText, { color: colors.text.secondary }]}>
              Loading projects...
            </Text>
          </View>
        ) : filteredProjects.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Feather name="folder" size={64} color={colors.icon.default} />
            <Text style={[styles.emptyText, { color: colors.text.secondary }]}>
              {searchQuery ? 'No projects found' : 'No projects yet'}
            </Text>
            {!searchQuery && (
              <Text style={[styles.emptySubtext, { color: colors.text.tertiary }]}>
                Create your first project from the Canvas screen
              </Text>
            )}
          </View>
        ) : (
          <View style={styles.gridContainer}>
            {filteredProjects.map((project) => (
              <View
                key={project.projectId}
                style={[styles.projectCard, { width: getCardWidth() }]}
              >
                {/* Three dots menu button */}
                {renameProjectId !== project.projectId && (
                  <TouchableOpacity
                    style={styles.optionsButton}
                    onPress={() =>
                      setOpenMenuId(openMenuId === project.projectId ? null : project.projectId)
                    }
                  >
                    <Text style={[styles.optionsText, { color: isDark ? '#B0B0B0' : '#666666' }]}>⋮</Text>
                  </TouchableOpacity>
                )}

                {/* Menu itself */}
                {openMenuId === project.projectId && (
                  <View style={[styles.optionsMenu, { backgroundColor: isDark ? '#2A2A2A' : '#FFFFFF' }]}>
                    <TouchableOpacity
                      style={styles.optionItem}
                      onPress={() => handleRename(project.projectId, project.title)}
                    >
                      <Text style={[styles.optionText, { color: isDark ? '#FFFFFF' : '#1A1A1A' }]}>Rename</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.optionItem, [styles.lastOptionItem, { borderTopColor: isDark ? '#3A3A3A' : '#E0E0E0' }]]}
                      onPress={() => handleDelete(project.projectId)}
                    >
                      <Text style={[styles.optionText, { color: colors.status.error }]}>
                        Delete
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* MAIN CARD */}
                {renameProjectId === project.projectId ? (
                  <View>
                    <View style={[styles.projectThumbnail, { backgroundColor: isDark ? '#E8E5D8' : '#2A2A2A' }]}>
                      {getThumbnailUrl(project) && (
                        <Image
                          source={{ uri: getThumbnailUrl(project)! }}
                          style={styles.thumbnailImage}
                          resizeMode="cover"
                        />
                      )}
                    </View>
                    <TextInput
                      style={[
                        styles.renameInput,
                        {
                          color: isDark ? '#FFFFFF' : '#1A1A1A',
                          backgroundColor: isDark ? '#2A2A2A' : '#FFFFFF',
                          borderColor: colors.button.arclight,
                        },
                      ]}
                      value={newTitle}
                      onChangeText={setNewTitle}
                      onSubmitEditing={handleRenameSubmit}
                      onBlur={() => {
                        if (newTitle.trim() === project.title) {
                          setRenameProjectId(null);
                        } else {
                          handleRenameSubmit();
                        }
                      }}
                      autoFocus
                      selectTextOnFocus
                    />
                  </View>
                ) : (
                  <TouchableOpacity activeOpacity={0.8} onPress={() => handleProjectPress(project)}>
                    <View style={[styles.projectThumbnail, { backgroundColor: isDark ? '#E8E5D8' : '#2A2A2A' }]}>
                      {getThumbnailUrl(project) ? (
                        <Image
                          source={{ uri: getThumbnailUrl(project)! }}
                          style={styles.thumbnailImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <Feather name="image" size={48} color={isDark ? '#2A2A2A' : '#E8E5D8'} />
                      )}
                      {/* Project type badge */}
                      <View style={[styles.typeBadge, { backgroundColor: project.type === 'layer-based' ? '#4A90E2' : '#9B59B6' }]}>
                        <Text style={styles.typeBadgeText}>{getProjectTypeLabel(project)}</Text>
                      </View>
                    </View>
                    <Text style={[styles.projectName, { color: isDark ? '#FFFFFF' : '#1A1A1A' }]} numberOfLines={1}>
                      {project.title}
                    </Text>
                    <Text style={[styles.projectInfo, { color: isDark ? '#B0B0B0' : '#666666' }]}>
                      {getProjectInfo(project)}
                    </Text>
                    <Text style={[styles.projectDate, { color: isDark ? '#B0B0B0' : '#666666' }]}>
                      {formatDate(project.updatedAt)}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

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

  /* BACKDROP */
  backdrop: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    zIndex: 1,
  },

  /* SEARCH */
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    marginHorizontal: 20,
    marginVertical: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    padding: 0,
    fontFamily: 'geistmono',
  },

  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },

  /* GRID */
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 20,
  },

  /* CARD */
  projectCard: {
    marginBottom: 20,
    position: 'relative',
  },

  projectThumbnail: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 16,
    marginBottom: 8,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  typeBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  typeBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
    fontFamily: 'geistmono',
  },
  projectName: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 2,
    fontFamily: 'geistmono',
  },
  projectInfo: {
    fontSize: 11,
    textAlign: 'center',
    marginBottom: 2,
    fontFamily: 'geistmono',
  },
  projectDate: {
    fontSize: 12,
    textAlign: 'center',
    fontFamily: 'geistmono',
  },

  /* OPTIONS MENU */
  optionsButton: {
    position: 'absolute',
    top: 1,
    right: 8,
    zIndex: 10,
    padding: 6,
  },
  optionsText: {
    fontSize: 24,
    fontFamily: 'geistmono',
  },
  optionsMenu: {
    position: 'absolute',
    top: 28,
    right: 4,
    borderRadius: 10,
    paddingVertical: 6,
    width: 120,
    zIndex: 20,
  },
  optionItem: {
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  lastOptionItem: {
    borderTopWidth: 1,
  },
  optionText: {
    fontSize: 14,
    fontFamily: 'geistmono',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    fontFamily: 'geistmono',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'geistmono',
    textAlign: 'center',
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: 14,
    fontFamily: 'geistmono',
    textAlign: 'center',
  },
  renameInput: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 2,
    fontFamily: 'geistmono',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 2,
  },
});