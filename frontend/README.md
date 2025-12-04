# Arclight - Frontend Documentation

> **React Native Expo application for AI-powered image editing**

---

## Quick Reference

| Feature | Location | Description |
|---------|----------|-------------|
| **Splash Screen** | `app/index.tsx` | Animated splash with auth check |
| **Authentication** | `app/(auth)/` | Login, Signup, OTP verification |
| **Main App** | `app/(app)/` | Protected routes after login |
| **API Service** | `services/api.ts` | Centralized backend communication |
| **Theme System** | `context/ThemeContext.tsx` | Light/Dark mode support |
| **Components** | `components/` | Reusable UI components |

---

## Table of Contents

1. [Overview](#overview)
2. [Tech Stack](#tech-stack)
3. [Getting Started](#getting-started)
4. [Project Structure](#project-structure)
5. [Routing & Navigation](#routing--navigation)
6. [Pages & Screens](#pages--screens)
7. [Components](#components)
8. [State Management](#state-management)
9. [API Integration](#api-integration)
10. [Theme System](#theme-system)
11. [Authentication Flow](#authentication-flow)

---

## Overview

**Arclight** is a cross-platform image editing application built with React Native and Expo. It provides two main editing workflows:

### 1. Layer-Based Editing (Workspace)
Traditional Photoshop-like layer composition with:
- Multiple independent layers
- Layer properties (opacity, blend modes, transformations)
- Real-time GPU-accelerated filters
- Layer reordering and duplication

### 2. AI Sequential Editing (Flowspace)
AI-powered image processing with:
- Chain AI operations (enhance, relight, face-restore, etc.)
- Full operation history with undo/redo
- Gemini AI prompt processing
- Auto-enhancement suggestions

---

## Tech Stack

| Category | Technology | Version |
|----------|------------|---------|
| **Framework** | React Native | 0.81.5 |
| **Platform** | Expo | ~54.0.23 |
| **Router** | Expo Router | ~6.0.15 |
| **Language** | TypeScript | ~5.9.2 |
| **State** | React Context | - |
| **Storage** | AsyncStorage | ^2.2.0 |
| **Animations** | Reanimated | ~4.1.1 |
| **Icons** | Lucide React Native | ^0.553.0 |
| **Auth** | Expo Auth Session | ~7.0.9 |

### Key Dependencies

```json
{
  "expo": "~54.0.23",
  "react-native": "0.81.5",
  "expo-router": "~6.0.15",
  "expo-image-picker": "~17.0.8",
  "expo-image-manipulator": "~14.0.7",
  "expo-file-system": "~19.0.19",
  "expo-sharing": "~14.0.7",
  "expo-auth-session": "~7.0.9",
  "react-native-reanimated": "~4.1.1",
  "react-native-gesture-handler": "~2.28.0",
  "@react-native-async-storage/async-storage": "^2.2.0"
}
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator (macOS) or Android Emulator
- Expo Go app (for physical device testing)

### Installation

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start development server
npm start
# or
expo start
```

### Running the App

```bash
# Start Expo development server
npm start

# Run on Android
npm run android

# Run on iOS (macOS only)
npm run ios

# Run on Web
npm run web
```

### Backend Configuration

Update the API URL in `constants/api.ts`:

```typescript
// For Android Emulator
const API_URL = 'http://10.0.2.2:4000/api/v1/adobe-ps';

// For iOS Simulator
const API_URL = 'http://localhost:4000/api/v1/adobe-ps';

// For Physical Device (use your computer's IP)
const API_URL = 'http://192.168.x.x:4000/api/v1/adobe-ps';
```

---

## Project Structure

```
frontend/
├── app/                          # Expo Router file-based routing
│   ├── index.tsx                 # Splash screen (entry point)
│   ├── _layout.tsx               # Root layout with providers
│   │
│   ├── (auth)/                   # Authentication routes (public)
│   │   ├── _layout.tsx           # Auth layout with redirect guard
│   │   ├── login.tsx             # Login page
│   │   ├── signup.tsx            # Signup page
│   │   └── verify-otp.tsx        # OTP verification page
│   │
│   └── (app)/                    # Protected app routes
│       ├── _layout.tsx           # App layout with auth guard
│       ├── home.tsx              # Dashboard/home
│       ├── canvas.tsx            # Project creation form
│       ├── workspace.tsx         # Layer-based editor
│       ├── flowspace.tsx         # AI sequential editor
│       ├── labspace.tsx          # AI experiments lab
│       ├── projects.tsx          # Projects gallery
│       ├── templates.tsx         # Templates browser
│       ├── settings.tsx          # User settings
│       └── history.tsx           # Edit history
│
├── components/                   # Reusable components
│   ├── Navbar.tsx               # Top navigation bar
│   ├── Sidebar.tsx              # Side navigation menu
│   ├── Loader.tsx               # Loading spinner
│   ├── CustomAlert.tsx          # Toast notifications
│   ├── FilterToolsMenu.tsx      # Image filter controls
│   ├── LightingModal.tsx        # Lighting adjustment modal
│   ├── LiveGLShader.tsx         # GPU-accelerated filters
│   ├── ArclightEngineButton.tsx # AI enhancement trigger
│   └── ArclightEngineModal.tsx  # AI suggestions display
│
├── context/                      # React Context providers
│   ├── ThemeContext.tsx         # Light/dark theme management
│   └── SideBarContext.tsx       # Sidebar state management
│
├── services/                     # API and external services
│   └── api.ts                   # Centralized API client (1800+ lines)
│
├── constants/                    # Configuration constants
│   ├── api.ts                   # API URL configuration
│   └── colors.json              # Theme color definitions (470+ lines)
│
├── hooks/                        # Custom React hooks
│   └── useAlert.ts              # Alert/toast hook
│
├── utils/                        # Utility functions
│   └── filters.ts               # Image filter calculations
│
├── assets/                       # Static assets
│   ├── fonts/                   # Custom fonts (grift, geistmono)
│   └── images/                  # Logo, icons, etc.
│
├── package.json
├── tsconfig.json
├── babel.config.js
└── app.json                      # Expo configuration
```

---

## Routing & Navigation

Uses **Expo Router** for file-based routing with group-based organization.

### Route Groups

| Group | Path | Purpose | Auth Required |
|-------|------|---------|---------------|
| Root | `/` | Splash screen | No |
| `(auth)` | `/login`, `/signup`, `/verify-otp` | Authentication | No (redirects if logged in) |
| `(app)` | `/home`, `/workspace`, etc. | Main application | Yes |

### Navigation Flow

```
App Start
    │
    ▼
Splash Screen (index.tsx)
    │
    ├── Check JWT Token
    │
    ├── Has Token? ──Yes──► /(app)/home
    │
    └── No Token? ──────────► /(auth)/signup
```

### Route Protection

**Auth Guard** (`app/(app)/_layout.tsx`):
```typescript
// Redirects unauthenticated users to signup
useEffect(() => {
  const checkAuth = async () => {
    const isAuth = await apiService.isAuthenticated();
    if (!isAuth) {
      router.replace('/(auth)/signup');
    }
  };
  checkAuth();
}, []);
```

**Auth Redirect** (`app/(auth)/_layout.tsx`):
```typescript
// Redirects authenticated users to home
useEffect(() => {
  const checkAuth = async () => {
    const isAuth = await apiService.isAuthenticated();
    if (isAuth) {
      router.replace('/(app)/home');
    }
  };
  checkAuth();
}, []);
```

---

## Pages & Screens

### Authentication Pages

#### `/signup` - Sign Up
- Email/password registration
- Google OAuth integration
- Form validation
- Navigates to OTP verification

#### `/login` - Login
- Email/password authentication
- Google OAuth integration
- "Forgot password" link
- Stores JWT token on success

#### `/verify-otp` - OTP Verification
- 4-digit OTP input
- Resend OTP functionality
- Auto-submit on complete
- Completes registration flow

### Main App Pages

#### `/home` - Dashboard
- Welcome message with user name
- Quick action buttons:
  - New Project → `/canvas`
  - Project Gallery → `/projects`
- Recent projects preview

#### `/canvas` - Project Creation
- Project name input
- Dimension presets:
  - Instagram (1080x1080)
  - Facebook (1200x630)
  - YouTube (1280x720)
  - Custom dimensions
- Unit conversion (px, in, cm, mm, points)
- Background color picker
- Workspace type selection:
  - Layer-based → `/workspace`
  - AI Sequential → `/flowspace`

#### `/workspace` - Layer-Based Editor
Main editing interface with:
- **Canvas Area**: Displays image with layers
- **Filter Controls**: Real-time GPU filters
  - Brightness (0-200%)
  - Contrast (0-200%)
  - Saturation (0-200%)
  - Sharpness (0-100%)
- **Arclight Engine**: AI enhancement suggestions
- **Tools**: Crop, rotate, flip, zoom
- **Layer Panel**: Layer management
- **History**: Undo/redo timeline
- **Export**: Share/save functionality

#### `/flowspace` - AI Sequential Editor
AI-powered editing with:
- Image upload and display
- AI operation buttons:
  - Enhance (denoise/deblur)
  - Relight (low-light enhancement)
  - Face Restore
  - Style Transfer
  - Remove Background
  - Object Removal
- Operation history timeline
- Undo/redo navigation
- Gemini AI prompt input

#### `/labspace` - AI Lab
Experimental AI features and testing ground.

#### `/projects` - Projects Gallery
- Grid view of all projects
- Project thumbnails
- Create new project button
- Delete/archive projects

#### `/templates` - Templates Browser
Pre-made templates for quick start.

#### `/settings` - User Settings
- Account information
- Theme preference (light/dark/system)
- Max history versions (1-15)
- Logout button

#### `/history` - Edit History
Detailed operation history and timeline.

---

## Components

### Core Components

#### `Navbar.tsx`
Top navigation bar with:
- Screen title
- Menu toggle button
- Logo display

```typescript
<Navbar title="Workspace" />
```

#### `Sidebar.tsx`
Side navigation menu with:
- User profile (name, email, avatar)
- Navigation links (Home, Projects, Templates, Settings)
- Theme toggle switch
- Logout button
- Swipe gesture to close

```typescript
// Controlled via SidebarContext
const { isOpen, toggleSidebar } = useSidebar();
```

#### `Loader.tsx`
Animated loading spinner.

```typescript
<Loader size={50} />
```

#### `CustomAlert.tsx`
Toast notification component.

```typescript
<CustomAlert
  type="success" // success | error | warning | info
  message="Operation completed!"
  visible={showAlert}
  onDismiss={() => setShowAlert(false)}
/>
```

### Image Editing Components

#### `FilterToolsMenu.tsx`
Filter control panel with sliders:
- Brightness
- Contrast
- Saturation
- Sharpness

```typescript
<FilterToolsMenu
  brightness={brightness}
  contrast={contrast}
  saturation={saturation}
  sharpness={sharpness}
  onBrightnessChange={setBrightness}
  onContrastChange={setContrast}
  onSaturationChange={setSaturation}
  onSharpnessChange={setSharpness}
/>
```

#### `LightingModal.tsx`
Advanced lighting adjustment modal.

```typescript
<LightingModal
  visible={showModal}
  onClose={() => setShowModal(false)}
  onApply={handleLightingApply}
/>
```

#### `LiveGLShader.tsx`
GPU-accelerated WebGL shader for real-time image filtering.

```typescript
<LiveGLShader
  imageUri={imageUri}
  brightness={brightness}
  contrast={contrast}
  saturation={saturation}
  sharpness={sharpness}
/>
```

### AI Components

#### `ArclightEngineButton.tsx`
Button to trigger AI analysis.

```typescript
<ArclightEngineButton
  projectId={projectId}
  onAnalysisComplete={handleSuggestions}
/>
```

#### `ArclightEngineModal.tsx`
Displays AI enhancement suggestions from Gemini.

```typescript
<ArclightEngineModal
  visible={showModal}
  suggestions={suggestions}
  onApply={handleApplyEnhancements}
  onClose={() => setShowModal(false)}
/>
```

---

## State Management

Uses **React Context API** for global state (no Redux/Zustand).

### ThemeContext

Manages application theme (light/dark mode).

```typescript
// Provider setup (app/_layout.tsx)
<ThemeProvider>
  <App />
</ThemeProvider>

// Usage in components
import { useTheme } from '../context/ThemeContext';

const MyComponent = () => {
  const { colors, isDark, toggleTheme, setThemeMode } = useTheme();

  return (
    <View style={{ backgroundColor: colors.background.primary }}>
      <Text style={{ color: colors.text.primary }}>Hello</Text>
      <Button onPress={toggleTheme} title="Toggle Theme" />
    </View>
  );
};
```

**Available Values:**
- `colors` - Color palette object (200+ properties)
- `isDark` - Boolean indicating dark mode
- `themeMode` - Current mode ('light' | 'dark' | 'system')
- `toggleTheme()` - Toggle between light/dark
- `setThemeMode(mode)` - Set specific mode

### SideBarContext

Manages sidebar open/close state.

```typescript
// Provider setup (app/_layout.tsx)
<SidebarProvider>
  <App />
</SidebarProvider>

// Usage in components
import { useSidebar } from '../context/SideBarContext';

const MyComponent = () => {
  const { isOpen, openSidebar, closeSidebar, toggleSidebar } = useSidebar();

  return (
    <Button onPress={toggleSidebar} title="Menu" />
  );
};
```

### Local Storage (AsyncStorage)

Persistent data stored in AsyncStorage:

| Key | Description |
|-----|-------------|
| `jwt_token` | JWT authentication token |
| `user_data` | User profile data (JSON) |
| `theme_preference` | Theme mode preference |
| `pending_email` | Email during OTP flow |
| `api_url` | Custom API URL |

---

## API Integration

### ApiService Class

Centralized API client in `services/api.ts` (~1800 lines).

#### Initialization

```typescript
import apiService from '../services/api';

// The service auto-initializes with stored URL
// Or manually update:
await apiService.updateBaseUrl('http://192.168.1.100:4000/api/v1/adobe-ps');
```

#### Authentication Methods

```typescript
// Login
const { response, data } = await apiService.login(email, password);
if (data.success) {
  // Token auto-stored in AsyncStorage
  router.replace('/(app)/home');
}

// Signup
const { response, data } = await apiService.signup(name, email, password);
if (data.success) {
  // Navigate to OTP verification
  router.push('/(auth)/verify-otp');
}

// Verify OTP
const { response, data } = await apiService.verifyOTP(email, otp);
if (data.success) {
  // Token auto-stored, user verified
  router.replace('/(app)/home');
}

// Google OAuth
const { response, data } = await apiService.googleAuth(idToken);

// Check authentication status
const isAuth = await apiService.isAuthenticated();

// Logout
await apiService.logout();
```

#### Project Management

```typescript
// Create Layer-Based Project
const { data } = await apiService.createLayerProject(
  'My Project',    // title
  1920,            // width
  1080,            // height
  '#ffffff'        // backgroundColor
);
const projectId = data.data.project._id;

// Create AI Sequential Project
const { data } = await apiService.createAIProject(
  'AI Edit',       // title
  1920,            // width
  1080,            // height
  '#ffffff',       // backgroundColor
  'Description'    // description
);

// Get All Projects
const { data } = await apiService.getAllProjects();
const projects = data.data.projects;

// Get Project Details
const { data } = await apiService.getProjectDetails(projectId);

// Update Project Title
await apiService.updateProjectTitle(projectId, 'New Title');

// Delete Project
await apiService.deleteProject(projectId);
```

#### Image Operations

```typescript
// Upload Image
const { data } = await apiService.uploadImage(
  imageUri,        // Local file URI
  projectId,       // Project ID
  'layer-based'    // or 'ai-sequential'
);
const publicId = data.data.image.publicId;

// Enhance Image (denoise/deblur)
const { data } = await apiService.enhanceImage(publicId, 'denoise');
const enhancedUrl = data.data.enhancedImageUrl;

// Remove Background
const { data } = await apiService.removeBackground(publicId, 'human');
const foregroundUrl = data.data.foregroundImageUrl;

// Relight (low-light enhancement)
const { data } = await apiService.relight(publicId, 1.5); // brightness 0.1-3.0

// Face Restore
const { data } = await apiService.faceRestore(publicId, 0.7); // fidelity 0-1

// Style Transfer
const { data } = await apiService.styleTransfer(contentPublicId, stylePublicId);

// Object Removal (click coordinates)
const { data } = await apiService.removeObject(publicId, x, y);

// Replace Background
const { data } = await apiService.replaceBackground(subjectUrl, backgroundUrl);
```

#### Layer Operations

```typescript
// Get Project Layers
const { data } = await apiService.getProjectLayers(projectId);
const layers = data.data.layers;

// Update Layer
await apiService.updateLayer(layerId, {
  opacity: 75,
  visible: true,
  position: { x: 100, y: 50 },
  transformations: { rotation: 45 }
});

// Reorder Layers
await apiService.reorderLayers(projectId, [layerId1, layerId2, layerId3]);

// Duplicate Layer
const { data } = await apiService.duplicateLayer(layerId);

// Delete Layer
await apiService.deleteLayer(layerId);
```

#### AI Sequential Operations

```typescript
// Get AI Project Details
const { data } = await apiService.getAIProjectDetails(projectId);

// Add Operation Result
await apiService.addAIProjectOperation(projectId, {
  operationType: 'enhance',
  prompt: { mode: 'denoise' },
  inputImage: { publicId: '...', imageUrl: '...' },
  outputImage: { publicId: '...', imageUrl: '...', width: 1920, height: 1080 }
});

// Undo Last Operation
await apiService.undoAIProjectOperation(projectId);

// Revert to Specific Operation
await apiService.revertAIProject(projectId, operationIndex);
// Use -1 to revert to original

// Get Timeline
const { data } = await apiService.getAIProjectTimeline(projectId);
```

#### Gemini AI Integration

```typescript
// Process Natural Language Prompt
const { data } = await apiService.processGeminiPrompt(
  publicId,
  'remove the cup from the table',
  projectId,
  'ai-sequential'
);

// If object removal is detected:
if (data.requiresInteraction) {
  // Show image, let user click on object
  // Then call removeObject with coordinates
}

// Auto-Enhancement Analysis
const { data } = await apiService.autoEnhanceAnalysis(projectId);
const suggestions = data.data.suggestions;
// [{ operation: 'enhance', reason: '...', priority: 1 }, ...]

// Apply Enhancements
await apiService.applyEnhancements(projectId, ['enhance', 'denoise']);
```

### Complete API Method Reference

| Category | Method | Endpoint |
|----------|--------|----------|
| **Auth** | `login(email, password)` | POST /auth/login |
| | `signup(name, email, password)` | POST /auth/signup |
| | `verifyOTP(email, otp)` | POST /auth/verify-otp |
| | `googleAuth(idToken)` | POST /auth/google |
| | `logout()` | Clears local storage |
| | `isAuthenticated()` | Checks JWT token |
| **Images** | `uploadImage(uri, projectId, type)` | POST /images/upload |
| **AI Ops** | `enhanceImage(publicId, mode)` | POST /ai/enhance |
| | `removeBackground(publicId, mode)` | POST /ai/remove-background |
| | `removeObject(publicId, x, y)` | POST /ai/object-removal |
| | `relight(publicId, brightness)` | POST /ai/relight |
| | `faceRestore(publicId, fidelity)` | POST /ai/face-restore |
| | `styleTransfer(content, style)` | POST /ai/style-transfer |
| | `replaceBackground(subject, bg)` | POST /ai/replace-background |
| **Projects** | `createLayerProject(...)` | POST /projects/create |
| | `createAIProject(...)` | POST /ai-projects/create |
| | `getAllProjects()` | GET /projects |
| | `getProjectDetails(id)` | GET /projects/:id |
| | `updateProjectTitle(id, title)` | PATCH /projects/:id/title |
| | `deleteProject(id)` | DELETE /projects/:id |
| **Layers** | `getProjectLayers(projectId)` | GET /layers/project/:id |
| | `updateLayer(layerId, updates)` | PATCH /layers/:id |
| | `reorderLayers(projectId, ids)` | PATCH /layers/project/:id/reorder |
| | `duplicateLayer(layerId)` | POST /layers/:id/duplicate |
| | `deleteLayer(layerId)` | DELETE /layers/:id |
| **AI Projects** | `getAllAIProjects()` | GET /ai-projects |
| | `getAIProjectDetails(id)` | GET /ai-projects/:id |
| | `addAIProjectOperation(id, op)` | POST /ai-projects/:id/operations |
| | `undoAIProjectOperation(id)` | POST /ai-projects/:id/undo |
| | `revertAIProject(id, index)` | POST /ai-projects/:id/revert/:index |
| | `getAIProjectTimeline(id)` | GET /ai-projects/:id/timeline |
| **Gemini** | `processGeminiPrompt(...)` | POST /gemini/prompt |
| | `autoEnhanceAnalysis(id)` | POST /gemini/auto-enhance/:id |
| | `applyEnhancements(id, list)` | POST /gemini/apply-enhancements/:id |

---

## Theme System

### Color Configuration

Colors defined in `constants/colors.json` with light and dark variants.

### Color Categories

```json
{
  "light": {
    "background": {
      "primary": "#ffffff",
      "secondary": "#f5f5f5",
      "tertiary": "#e0e0e0",
      "modal": "#ffffff",
      "overlay": "rgba(0,0,0,0.5)"
    },
    "text": {
      "primary": "#1a1a1a",
      "secondary": "#666666",
      "muted": "#999999"
    },
    "button": {
      "primary": "#2563eb",
      "secondary": "#64748b",
      "danger": "#dc2626"
    },
    "border": {
      "default": "#e5e7eb",
      "focus": "#2563eb"
    },
    "status": {
      "success": "#22c55e",
      "error": "#ef4444",
      "warning": "#f59e0b",
      "info": "#3b82f6"
    }
  },
  "dark": {
    // Dark mode variants
  }
}
```

### Usage Example

```typescript
import { useTheme } from '../context/ThemeContext';

const MyScreen = () => {
  const { colors, isDark } = useTheme();

  return (
    <View style={{
      backgroundColor: colors.background.primary,
      borderColor: colors.border.default
    }}>
      <Text style={{ color: colors.text.primary }}>
        Hello World
      </Text>
      <TouchableOpacity style={{
        backgroundColor: colors.button.primary
      }}>
        <Text style={{ color: colors.button.text }}>
          Click Me
        </Text>
      </TouchableOpacity>
    </View>
  );
};
```

---

## Authentication Flow

### Email/Password Flow

```
┌─────────────┐
│   Signup    │
│  (signup)   │
└──────┬──────┘
       │ POST /auth/signup
       ▼
┌─────────────┐
│ Verify OTP  │
│(verify-otp) │
└──────┬──────┘
       │ POST /auth/verify-otp
       │ Store JWT token
       ▼
┌─────────────┐
│    Home     │
│   (home)    │
└─────────────┘
```

### Google OAuth Flow

```
┌─────────────┐
│Login/Signup │
│  (Google)   │
└──────┬──────┘
       │ expo-auth-session
       ▼
┌─────────────┐
│Google OAuth │
│   Prompt    │
└──────┬──────┘
       │ Get ID Token
       ▼
┌─────────────┐
│POST /google │
│  Backend    │
└──────┬──────┘
       │ Return JWT
       │ Store in AsyncStorage
       ▼
┌─────────────┐
│    Home     │
│   (home)    │
└─────────────┘
```

### Token Management

```typescript
// Storing token (handled by ApiService)
await AsyncStorage.setItem('jwt_token', token);
await AsyncStorage.setItem('user_data', JSON.stringify(user));

// Retrieving token (automatic in requests)
const token = await AsyncStorage.getItem('jwt_token');

// Clearing token (logout)
await AsyncStorage.removeItem('jwt_token');
await AsyncStorage.removeItem('user_data');
```

---

## Scripts

```bash
# Start development server
npm start

# Run on Android emulator/device
npm run android

# Run on iOS simulator (macOS only)
npm run ios

# Run on web browser
npm run web

# Run linting
npm run lint

# Reset project (clears cache)
npm run reset-project
```

---

## Environment Setup

### For Android Emulator

```typescript
// constants/api.ts
const API_URL = 'http://10.0.2.2:4000/api/v1/adobe-ps';
```

### For iOS Simulator

```typescript
const API_URL = 'http://localhost:4000/api/v1/adobe-ps';
```

### For Physical Device

1. Find your computer's IP address
2. Ensure device is on same WiFi network
3. Update API URL:

```typescript
const API_URL = 'http://192.168.x.x:4000/api/v1/adobe-ps';
```

### Google OAuth Setup

1. Create Google Cloud Console project
2. Enable Google+ API
3. Create OAuth 2.0 credentials
4. Add authorized redirect URIs:
   - `https://auth.expo.io/@your-username/arclight`
5. Add client IDs to `app/(auth)/signup.tsx` and `login.tsx`

---

## Troubleshooting

### Common Issues

**Network Error: Cannot connect to backend**
- Verify backend server is running on port 4000
- Check API URL in `constants/api.ts`
- Ensure device/emulator can reach the server
- Check firewall settings

**Google OAuth not working**
- Verify Google Cloud Console setup
- Check client IDs are correct
- Ensure redirect URI matches Expo configuration

**Images not loading**
- Check Cloudinary configuration
- Verify image URLs are accessible
- Check network connectivity

**Theme not persisting**
- Clear AsyncStorage and restart app
- Check for AsyncStorage errors in console

---

## License

This project is developed for Inter IIT Tech Meet.

**Last Updated:** December 4, 2025
