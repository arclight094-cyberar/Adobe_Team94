// app/(app)/templates.tsx
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Dimensions, Modal, TextInput, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Navbar from "../../components/Navbar"
import CustomAlert from '../../components/CustomAlert';
import { useAlert } from '../../hooks/useAlert';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ============================================================
// INTERFACES
// ============================================================

interface Template {
  id: number;
  name: string;
  width: number;
  height: number;
  isFixed: boolean;
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

// Calculate card dimensions based on screen size
const getCardDimensions = () => {
  const horizontalPadding = 32;
  const gap = 12;
  const cardWidth = (SCREEN_WIDTH - horizontalPadding - gap) / 2;
  
  const navbarHeight = 80;
  const availableHeight = SCREEN_HEIGHT - navbarHeight - 120;
  const cardHeight = availableHeight / 3 - 32;
  
  return {
    width: cardWidth,
    height: cardHeight,
  };
};

// Calculate icon size to fit within template card while maintaining aspect ratio
const getTemplateIconSize = (template: Template, cardWidth: number, cardHeight: number) => {
  const aspectRatio = template.width / template.height;
  
  const maxWidth = cardWidth * 0.7;
  const maxHeight = cardHeight * 0.6;
  
  let iconWidth, iconHeight;
  
  if (aspectRatio > 1) {
    iconWidth = maxWidth;
    iconHeight = iconWidth / aspectRatio;
    
    if (iconHeight > maxHeight) {
      iconHeight = maxHeight;
      iconWidth = iconHeight * aspectRatio;
    }
  } else {
    iconHeight = maxHeight;
    iconWidth = iconHeight * aspectRatio;
    
    if (iconWidth > maxWidth) {
      iconWidth = maxWidth;
      iconHeight = iconWidth / aspectRatio;
    }
  }
  
  return {
    width: iconWidth,
    height: iconHeight,
    aspectRatio: aspectRatio,
  };
};

// ============================================================
// ORIGINAL DIMENSIONS CARD COMPONENT
// Large rectangular card at the top of the page
// ============================================================

const OriginalDimensionsCard = ({ onPress }: { onPress: () => void }) => {
  return (
    <TouchableOpacity 
      style={styles.originalDimensionsCard}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Image
        source={require('../icons/expand.png')}
        style={{
          width: 40,
          height: 40,
          resizeMode: 'contain',
          alignSelf:'center',
          marginHorizontal:20,
          tintColor:'#ffffff'
        }}
      />

      <Text style={styles.originalDimensionsText}>
        Original Dimensions
      </Text>
    </TouchableOpacity>
  );
};

// ============================================================
// SECTION HEADER COMPONENT
// Displays "Popular" or "Custom" section titles
// ============================================================

const SectionHeader = ({ title }: { title: string }) => {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{title}</Text>
    </View>
  );
};

// ============================================================
// ICON MAPPING HELPER
// Maps template names to icon require paths
// ============================================================
const getTemplateIcon = (templateName: string) => {
  const iconMap: { [key: string]: any } = {
    'Instagram Post': require('../icons/instagram.png'),
    'Instagram Reel': require('../icons/instagram.png'),
    'YouTube Thumbnail': require('../icons/youtube.png'),
    'Pinterest Pin': require('../icons/pinterest.png'),
    'Facebook Post': require('../icons/facebook.png'),
    'LinkedIn Banner': require('../icons/linkedin.png'),
  };
  return iconMap[templateName] || null;
};

// ============================================================
// TEMPLATE CARD COMPONENT
// Individual template card with icon, name, dimensions, and options menu
// ============================================================

const TemplateCard = ({ 
  template, 
  onPress, 
  onRename, 
  onDelete 
}: { 
  template: Template; 
  onPress: () => void;
  onRename: () => void;
  onDelete: () => void;
}) => {
  const [showOptions, setShowOptions] = useState(false);
  const cardDimensions = getCardDimensions();
  const iconSize = getTemplateIconSize(template, cardDimensions.width, cardDimensions.height);
  const templateIcon = getTemplateIcon(template.name);

  return (
    <>
      {/* Full screen backdrop - closes options menu when tapped outside */}
      {showOptions && !template.isFixed && (
        <TouchableOpacity
          style={styles.fullScreenBackdrop}
          activeOpacity={1}
          onPress={() => setShowOptions(false)}
        />
      )}
      
      {/* Card wrapper - controls card width */}
      <View style={[styles.cardWrapper, { width: cardDimensions.width }]}>
        {/* Three dots menu button - only shown for custom templates */}
        {!template.isFixed && (
          <>
            <TouchableOpacity 
              style={styles.optionsButton}
              onPress={() => {
                setShowOptions(prev => !prev);
              }}
            >
              <Text style={styles.optionsText}>⋮</Text>
            </TouchableOpacity>

            {showOptions && (
              <View style={styles.optionsMenu}>
                <TouchableOpacity 
                  style={styles.optionItem}
                  onPress={() => {
                    setShowOptions(false);
                    onRename();
                  }}
                >
                  <Text style={styles.optionText}>Rename</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.optionItem, styles.lastOptionItem]}
                  onPress={() => {
                    setShowOptions(false);
                    onDelete();
                  }}
                >
                  <Text style={[styles.optionText, { color: '#ff4444' }]}>Delete</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}

        {/* Main card touchable area */}
        <TouchableOpacity 
          style={[
            styles.templateCard, 
            { 
              width: cardDimensions.width,
              height: cardDimensions.height,
            }
          ]} 
          onPress={() => {
            if (showOptions) {
              setShowOptions(false);
              return;
            }
            onPress();
          }}
          activeOpacity={0.7}
        >
          <View style={styles.cardContent}>
            {/* Icon container - centered within the card */}
            <View style={styles.iconContainer}>
              {/* Template icon with background */}
              <View
                style={[
                  styles.icon,
                  {
                    width: iconSize.width,
                    height: iconSize.height,
                    alignItems: "center",
                    justifyContent: "center",
                  }
                ]}
              >
                {templateIcon ? (
                  <Image
                    source={templateIcon}
                    style={{
                      width: iconSize.width * 0.55,
                      height: iconSize.height * 0.55,
                    }}
                    resizeMode="contain"
                  />
                ) : (
                  <View
                    style={{
                      width: iconSize.width * 0.25,
                      height: iconSize.height * 0.25,
                      backgroundColor: "#ffffff55",
                      borderRadius: 4,
                    }}
                  />
                )}
              </View>
            </View>
          </View>
        </TouchableOpacity>
        
        {/* Card info section - template name and dimensions */}
        <View style={styles.cardInfo}>
          <Text style={styles.templateName} numberOfLines={1}>{template.name}</Text>
          <Text style={styles.templateDimensions}>{template.width} × {template.height}</Text>
        </View>
      </View>
    </>
  );
};

// ============================================================
// ADD TEMPLATE MODAL
// Modal for creating new custom templates
// ============================================================

const AddTemplateModal = ({ 
  visible, 
  onClose, 
  onAdd 
}: { 
  visible: boolean; 
  onClose: () => void; 
  onAdd: (name: string, width: number, height: number) => void;
}) => {
  const [name, setName] = useState('');
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');

  const handleAdd = () => {
    if (!name.trim() || !width || !height) {
      showAlert('error', 'Error', 'Please fill all fields');
      return;
    }
    
    onAdd(name.trim(), parseInt(width), parseInt(height));
    
    setName('');
    setWidth('');
    setHeight('');
    
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity 
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity 
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add New Template</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Template Name"
              value={name}
              onChangeText={setName}
              placeholderTextColor="#999"
            />
            
            <View style={styles.dimensionsRow}>
              <TextInput
                style={[styles.input, styles.dimensionInput]}
                placeholder="Width"
                value={width}
                onChangeText={setWidth}
                keyboardType="numeric"
                placeholderTextColor="#999"
              />
              <Text style={styles.dimensionSeparator}>×</Text>
              <TextInput
                style={[styles.input, styles.dimensionInput]}
                placeholder="Height"
                value={height}
                onChangeText={setHeight}
                keyboardType="numeric"
                placeholderTextColor="#999"
              />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]} 
                onPress={onClose}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.addButtonModal]} 
                onPress={handleAdd}
              >
                <Text style={styles.addButtonModalText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

// ============================================================
// RENAME TEMPLATE MODAL
// Modal for renaming existing custom templates
// ============================================================

const RenameModal = ({ 
  visible, 
  currentName,
  onClose, 
  onRename 
}: { 
  visible: boolean;
  currentName: string;
  onClose: () => void; 
  onRename: (newName: string) => void;
}) => {
  const [name, setName] = useState(currentName);

  React.useEffect(() => {
    setName(currentName);
  }, [currentName]);

  const handleRename = () => {
    if (!name.trim()) {
      showAlert('error', 'Error', 'Please enter a name');
      return;
    }
    onRename(name.trim());
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity 
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity 
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Rename Template</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Template Name"
              value={name}
              onChangeText={setName}
              placeholderTextColor="#999"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]} 
                onPress={onClose}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.addButtonModal]} 
                onPress={handleRename}
              >
                <Text style={styles.addButtonModalText}>Rename</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

// ============================================================
// MAIN TEMPLATES PAGE COMPONENT
// Main container component for the templates page
// ============================================================

export default function TemplatesPage() {
  const { alertState, showAlert, hideAlert } = useAlert();
  const [templates, setTemplates] = useState<Template[]>([
    { id: 1, name: 'Instagram Post', width: 1080, height: 1080, isFixed: true },
    { id: 2, name: 'Instagram Reel', width: 1080, height: 1920, isFixed: true },
    { id: 3, name: 'YouTube Thumbnail', width: 1920, height: 1080, isFixed: true },
    { id: 4, name: 'Pinterest Pin', width: 1000, height: 1500, isFixed: true },
    { id: 5, name: 'Facebook Post', width: 940, height: 788, isFixed: true },
    { id: 6, name: 'LinkedIn Banner', width: 1584, height: 396, isFixed: true },
  ]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);

  const customTemplates = templates.filter(t => !t.isFixed);
  const popularTemplates = templates.filter(t => t.isFixed);

  const addNewTemplate = (name: string, width: number, height: number) => {
    const newTemplate: Template = {
      id: Date.now(),
      name,
      width,
      height,
      isFixed: false,
    };
    setTemplates([...templates, newTemplate]);
  };

  const renameTemplate = (templateId: number, newName: string) => {
    setTemplates(prevTemplates => prevTemplates.map(t => 
      t.id === templateId ? { ...t, name: newName } : t
    ));
    setSelectedTemplate(null);
    setShowRenameModal(false);
  };

  const deleteTemplate = (templateId: number, templateName: string) => {
    Alert.alert(
      'Delete Template',
      `Are you sure you want to delete "${templateName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => {
            setTemplates(prevTemplates => prevTemplates.filter(t => t.id !== templateId));
          }
        },
      ]
    );
  };

  const handleTemplatePress = (template: Template) => {
    console.log('Template pressed:', template.name);
    // TODO: Navigate to editor with selected template dimensions
  };

  const handleOriginalDimensionsPress = () => {
    console.log('Original Dimensions pressed');
    // TODO: Navigate to editor with original dimensions option
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#EEECE5" }}>
      <View style={styles.container}>
        
        {/* ========== REUSABLE NAVBAR COMPONENT ========== */}
        <Navbar screenName="Templates" />

        {/* ========== SCROLLABLE CONTENT ========== */}
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <OriginalDimensionsCard onPress={handleOriginalDimensionsPress} />

          <SectionHeader title="Popular" />

          <View style={styles.grid}>
            {popularTemplates.map((template) => (
              <TemplateCard 
                key={template.id} 
                template={template}
                onPress={() => handleTemplatePress(template)}
                onRename={() => {
                  setSelectedTemplate(template);
                  setShowRenameModal(true);
                }}
                onDelete={() => deleteTemplate(template.id, template.name)}
              />
            ))}
          </View>

          {customTemplates.length > 0 && (
            <>
              <SectionHeader title="Custom" />
              <View style={styles.grid}>
                {customTemplates.map((template) => (
                  <TemplateCard 
                    key={template.id} 
                    template={template}
                    onPress={() => handleTemplatePress(template)}
                    onRename={() => {
                      setSelectedTemplate(template);
                      setShowRenameModal(true);
                    }}
                    onDelete={() => deleteTemplate(template.id, template.name)}
                  />
                ))}
              </View>
            </>
          )}
        </ScrollView>

        {/* ========== FLOATING ADD BUTTON ========== */}
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => setShowAddModal(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>

        {/* ========== MODALS ========== */}
        <AddTemplateModal 
          visible={showAddModal}
          onClose={() => setShowAddModal(false)}
          onAdd={addNewTemplate}
        />

        {selectedTemplate && (
          <RenameModal 
            visible={showRenameModal}
            currentName={selectedTemplate.name}
            onClose={() => {
              setShowRenameModal(false);
              setSelectedTemplate(null);
            }}
            onRename={(newName) => {
              renameTemplate(selectedTemplate.id, newName);
            }}
          />
        )}

      </View>

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
    backgroundColor: '#EEECE5',
    zIndex: 1,
  },
  
  scrollView: {
    flex: 1,
    zIndex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 100,
  },
  
  originalDimensionsCard: {
    width: '92%',
    alignSelf: 'center',
    height: 100,
    backgroundColor: '#222222',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginTop: 12,
  },
  originalDimensionsText: {
    fontSize: 16,
    color: '#fff',
    fontFamily: 'geistmono',
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  
  sectionHeader: {
    marginTop: 4,
    width: '100%',
    alignItems:'center'
  },
  sectionHeaderText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1D1B20',
    fontFamily: 'geistmono',
  },
  
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 24,
  },
  
  cardWrapper: {
    marginBottom: 8,
    position: 'relative',
  },
  templateCard: {
    backgroundColor: '#EEECE5',
    overflow: 'visible',
  },
  cardContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    margin: 0,
  },
  
  optionsButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEECE5',
    borderRadius: 16,
    zIndex: 10003,
  },
  optionsText: {
    fontSize: 24,
    color: '#000000ff',
    fontWeight: 'bold',
    fontFamily: 'geistmono',
  },
  fullScreenBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10001,
  },
  optionsMenu: {
    position: 'absolute',
    top: 24,
    right: 24,
    backgroundColor: '#fff',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 10,
    zIndex: 10002,
    minWidth: 140,
  },
  optionItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  lastOptionItem: {
    borderBottomWidth: 0,
  },
  optionText: {
    fontSize: 14,
    color: '#222',
    fontFamily: 'geistmono',
  },
  
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    backgroundColor: '#141414ff',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  cardInfo: {
    marginTop: -12,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  templateName: {
    fontSize: 13,
    fontWeight: '100',
    color: '#1D1B20',
    textAlign: 'center',
    marginBottom: 2,
    fontFamily: 'geistmono',
    fontFamily: 'geistmono',
  },
  templateDimensions: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    fontFamily: 'geistmono',
  },
  
  addButton: {
    position: 'absolute',
    right: 24,
    bottom: 32,
    width: 64,
    height: 64,
    backgroundColor: '#222222',
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    zIndex: 150,
  },
  addButtonText: {
    fontSize: 32,
    color: '#fff',
    fontWeight: '300',
    fontFamily: 'geistmono',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 30000,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: SCREEN_WIDTH - 48,
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1D1B20',
    marginBottom: 20,
    fontFamily: 'geistmono',
    textAlign: 'center',
  },
  
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
    fontFamily: 'geistmono',
    color: '#1D1B20',
  },
  dimensionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  dimensionInput: {
    flex: 1,
    marginBottom: 0,
  },
  dimensionSeparator: {
    fontSize: 20,
    color: '#666',
    fontWeight: 'bold',
    fontFamily: 'geistmono',
  },
  
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#666',
    fontFamily: 'geistmono',
  },
  addButtonModal: {
    backgroundColor: '#222222',
  },
  addButtonModalText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    fontFamily: 'geistmono',
  },
});

