# Adobe PS Clone - Backend Documentation

> **Comprehensive guide to backend architecture, API endpoints, and frontend integration workflows**

---

## Quick Reference - All API Routes

| Route Group | Base Path | Description |
|-------------|-----------|-------------|
| **Auth** | `/api/v1/adobe-ps/auth` | User signup, login, OTP verification, Google OAuth |
| **Images** | `/api/v1/adobe-ps/images` | Image upload, delete, crop operations |
| **AI Operations** | `/api/v1/adobe-ps/ai` | Relight, enhance, face-restore, style-transfer, background removal |
| **Gemini AI** | `/api/v1/adobe-ps/gemini` | AI analysis, prompt processing, auto-enhancement |
| **Layer Projects** | `/api/v1/adobe-ps/projects` | Layer-based project CRUD |
| **Layers** | `/api/v1/adobe-ps/layers` | Layer CRUD, reorder, duplicate |
| **AI Projects** | `/api/v1/adobe-ps/ai-projects` | Sequential AI projects with undo/redo |
| **Settings** | `/api/v1/adobe-ps/settings` | User settings management |

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Getting Started](#getting-started)
4. [Project Systems](#project-systems)
5. [AI Operations](#ai-operations)
6. [API Endpoints](#api-endpoints)
7. [Frontend Integration Guides](#frontend-integration-guides)
8. [Authentication](#authentication)
9. [Error Handling](#error-handling)
10. [Docker Requirements](#docker-requirements)

---

## Overview

This backend powers an Adobe Photoshop-like web application with two distinct editing workflows:

### **1. AI Sequential Editing**
Chain multiple AI operations on a single image with full history tracking and undo capability.

**Use Case:** Apply relight → denoise → face-restore → style-transfer in sequence

**Workflow:**
```
Upload Image → AI Operation 1 → AI Operation 2 → ... → Final Result
```

### **2. Layer-Based Editing**
Work with multiple independent image layers, similar to Photoshop's layer system.

**Use Case:** Composite multiple images with individual layer properties (opacity, blend modes, transformations)

**Workflow:**
```
Create Project → Upload Images → Auto-Separate into Layers → Manipulate Each Layer → Compose Final Image
```

### **3. AI Auto-Enhancement (NEW)**
Intelligent analysis of composite canvas using Google Gemini AI to recommend enhancement order.

**Use Case:** Automatically detect and suggest which enhancements are needed (low-light, denoise, deblur, face-restore)

**Workflow:**
```
Layer Project → Merge Visible Layers → Gemini Analysis → Recommended Priority Order → Apply Enhancements
```

---

## Architecture

### Technology Stack

- **Runtime:** Node.js with Express.js
- **Database:** MongoDB with Mongoose ODM
- **Storage:** Cloudinary (cloud image storage)
- **AI Processing:** Docker containers running specialized models
- **Authentication:** JWT (JSON Web Tokens)
- **File Uploads:** Multer middleware

### Core Components

```
backend/
├── controllers/          # Request handlers
│   ├── aiOperationsController.js      # AI operations (relight, enhance, face-restore, etc.)
│   ├── authController.js              # User authentication
│   ├── imageController.js             # Image upload and management
│   ├── layerController.js             # Layer CRUD operations
│   ├── layerProjectController.js      # Layer-based projects
│   ├── seqAiProjectController.js      # AI sequential projects
│   └── seqAiGeminiController.js       # Gemini AI prompt processing
├── models/               # MongoDB schemas
│   ├── User.js                        # User accounts
│   ├── Image.js                       # Image metadata
│   ├── Layer.js                       # Layer documents
│   ├── Project.js                     # Layer-based projects
│   └── AIProject.js                   # AI sequential projects
├── routes/               # API route definitions
├── middleware/           # Auth, upload, error handling
├── utils/                # Helper functions
├── AI/                   # Gemini AI integration
└── config/               # Cloudinary configuration
```

### Data Flow

#### **AI Sequential Workflow:**
```
User → Frontend → API → Download from Cloudinary → AI Container → 
Process → Upload to Cloudinary → Update Database → Response
```

#### **Layer-Based Workflow:**
```
User → Frontend → API → Upload to Cloudinary → Auto-Separate (First Image) → 
Create Layers → Store in Database → Response
```

---

## Getting Started

### Prerequisites

1. **Node.js:** v16+ recommended
2. **MongoDB:** Running instance (local or cloud)
3. **Docker:** For AI model containers
4. **Cloudinary Account:** For image storage
5. **Gemini API Key:** For AI prompt analysis

### Environment Variables

Create a `.env` file in the backend directory:

```env
# Server
NODE_ENV=development
PORT=4000

# Database
MONGODB_URI=mongodb://localhost:27017/adobe-ps-clone

# JWT
JWT_SECRET=your_super_secret_jwt_key_here
JWT_EXPIRES_IN=30d

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Gemini AI
GEMINI_API_KEY=your_gemini_api_key_here

# Email (Optional)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_app_password
```

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Start production server
npm start
```

### Docker Setup

Start all required AI containers:

```bash
# Low-light enhancement
docker run -d --name lowlight-service sameer513/lowlight-cpu-bullseye tail -f /dev/null

# Face restoration
docker run -d --name codeformer-service sameer513/codeformer_app tail -f /dev/null

# Image enhancement (denoise/deblur)
docker run -d --name nafnet-service sameer513/nafnet-image tail -f /dev/null

# Style transfer
docker run -d --name style-transfer-service sameer513/pca-style-transfer-fixed tail -f /dev/null

# Background removal & segmentation
docker run -d --name background-removal-service sameer513/u2net-inference tail -f /dev/null

# Background harmonization (Replace Background)
docker run -d --name pct-net-service sameer513/pct-net-final tail -f /dev/null

# Object removal - SAM (Segmentation)
docker run -d --name object-masking-service sameer513/sam-cpu-final tail -f /dev/null

# Object removal - LaMa (Inpainting)
docker run -d --name object-remover-service sameer513/better-lama tail -f /dev/null
```

---

## Project Systems

The backend supports two independent project systems:

### 1. AI Sequential Projects (`AIProject` model)

**Purpose:** Chain AI operations with history tracking

**Key Features:**
- Single image workflow (currentImage updated after each operation)
- Full operation history with inputs/outputs
- Undo/redo capability
- Timeline visualization
- No layer separation

**Database Schema:**
```javascript
{
  user: ObjectId,
  title: String,
  description: String,
  originalImage: { publicId, imageUrl, width, height, format, size },
  currentImage: { publicId, imageUrl, width, height, format, size },
  thumbnail: String,
  operations: [{
    operation: String,
    prompt: String,
    inputImage: Object,
    outputImage: Object,
    timestamp: Date
  }],
  createdAt: Date,
  updatedAt: Date
}
```

**Typical Operations:**
1. Create project
2. Upload original image
3. Apply relight (currentImage updated)
4. Apply denoise (currentImage updated)
5. Apply face-restore (currentImage updated)
6. View history/undo

### 2. Layer-Based Projects (`Project` model)

**Purpose:** Multi-layer composition like Photoshop

**Key Features:**
- Multiple independent layers
- First image auto-separates into foreground + background
- Layer properties (opacity, blend modes, transformations)
- Layer reordering (z-index)
- Layer duplication
- History tracking

**Database Schema:**
```javascript
{
  user: ObjectId,
  title: String,
  description: String,
  width: Number,
  height: Number,
  backgroundColor: String,
  layers: [ObjectId],  // References to Layer documents
  thumbnail: String,
  history: [{
    action: String,
    layerId: ObjectId,
    description: String,
    timestamp: Date
  }],
  createdAt: Date,
  updatedAt: Date
}
```

**Layer Schema:**
```javascript
{
  project: ObjectId,
  name: String,
  type: String,  // 'background', 'foreground', 'object', 'text', 'custom'
  imageUrl: String,
  publicId: String,
  maskUrl: String,
  maskPublicId: String,
  order: Number,  // Stacking order (z-index)
  visible: Boolean,
  locked: Boolean,
  opacity: Number,  // 0-100
  blendMode: String,  // 'normal', 'multiply', 'screen', 'overlay', etc.
  position: { x: Number, y: Number },
  dimensions: { width: Number, height: Number },
  transformations: {
    rotation: Number,
    scaleX: Number,
    scaleY: Number,
    flipX: Boolean,
    flipY: Boolean
  },
  metadata: Object,
  createdAt: Date,
  updatedAt: Date
}
```

**Typical Operations:**
1. Create project
2. Upload first image → Auto-separates into 2 layers (foreground + background)
3. Upload additional images → Creates single layer per image
4. Update layer properties (opacity, position, etc.)
5. Reorder layers
6. Duplicate/delete layers

---

## AI Operations

All AI operations are in `aiOperationsController.js` and use Docker containers.

### Available Operations

| Operation | Endpoint | Purpose | Processing Time |
|-----------|----------|---------|-----------------|
| **Relight** | `POST /api/v1/adobe-ps/ai/relight` | Low-light enhancement | 30-60s |
| **Enhance** | `POST /api/v1/adobe-ps/ai/enhance` | Denoise/deblur | 30-60s |
| **Face Restore** | `POST /api/v1/adobe-ps/ai/face-restore` | Face enhancement | 30-60s |
| **Style Transfer** | `POST /api/v1/adobe-ps/ai/style-transfer` | Artistic style | 30-90s |
| **Remove Background** | `POST /api/v1/adobe-ps/ai/remove-background` | Background removal | 10-30s |
| **Object Removal** | `POST /api/v1/adobe-ps/ai/object-removal` | Remove objects | 30-90s |
| **Layer Separation** | Internal function | Auto-separate layers | 60-120s |

### Special: Gemini-Powered Object Removal

Object removal uses a **two-step interactive process**:

#### Step 1: Intent Detection
```javascript
POST /api/v1/adobe-ps/gemini/prompt
Body: {
  "publicId": "image_id",
  "prompt": "remove the cup from the table",
  "projectId": "project_id",
  "projectType": "ai-sequential"
}

Response: {
  "requiresInteraction": true,
  "message": "Please point out the object to remove"
}
```

#### Step 2: Coordinate-Based Removal
```javascript
POST /api/v1/adobe-ps/ai/object-removal
Body: {
  "publicId": "image_id",
  "x": 450,
  "y": 300
}

Response: {
  "success": true,
  "data": { outputImage: {...} }
}
```

**Frontend Flow:**
1. User types "remove the dog"
2. Backend detects object removal intent
3. Frontend shows image in interactive mode (crosshair cursor)
4. User clicks on dog
5. Frontend captures (x, y) coordinates
6. Backend removes object using SAM + LaMa

### Image Enhancement Operations

The backend supports multiple enhancement operations using state-of-the-art AI models:

#### 1. Enhance (Denoise/Deblur)

**Purpose:** Remove noise or blur from images using NAFNet model

**Endpoint:** `POST /api/v1/adobe-ps/ai/enhance`

**Request Body:**
```json
{
  "publicId": "image_public_id",
  "mode": "denoise"  // or "deblur"
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "enhancedImage": {
      "publicId": "enhanced_abc123_1234567890",
      "imageUrl": "https://res.cloudinary.com/.../enhanced_abc123.jpg",
      "width": 1920,
      "height": 1080,
      "format": "jpg",
      "size": 245678
    },
    "enhancedImageUrl": "https://res.cloudinary.com/.../enhanced_abc123.jpg",
    "mode": "denoise"
  }
}
```

**Supported Modes:**
- `denoise`: Remove noise from images (best for grainy/noisy photos)
- `deblur`: Remove motion blur or focus blur

**Processing Details:**
- Uses NAFNet (Nonlinear Activation Free Network)
- Container: `nafnet-service` (sameer513/nafnet-image)
- Processing time: 30-60 seconds
- Supports images up to 4K resolution

**Frontend Example:**
```javascript
const enhanceImage = async (publicId, mode = 'denoise') => {
  const response = await fetch('/api/v1/adobe-ps/ai/enhance', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ publicId, mode })
  });
  
  const { data } = await response.json();
  return data.enhancedImageUrl;
};

// Usage
const denoised = await enhanceImage('image_id', 'denoise');
const deblurred = await enhanceImage('image_id', 'deblur');
```

#### 2. Background Replacement with Harmonization

**Purpose:** Replace image background with realistic harmonization using PCT-Net

**Endpoint:** `POST /api/v1/adobe-ps/ai/replace-background`

**Request Body:**
```json
{
  "subjectImageUrl": "https://res.cloudinary.com/.../subject.jpg",
  "backgroundImageUrl": "https://res.cloudinary.com/.../background.jpg"
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "harmonizedImage": {
      "publicId": "bg_replaced_unique123_1234567890",
      "imageUrl": "https://res.cloudinary.com/.../bg_replaced_unique123.jpg",
      "width": 1920,
      "height": 1080,
      "format": "jpg",
      "size": 456789
    },
    "harmonizedImageUrl": "https://res.cloudinary.com/.../bg_replaced_unique123.jpg"
  }
}
```

**4-Step Processing Pipeline:**

1. **Composite Creation**
   - Merges subject and background using Sharp
   - Automatically resizes background to match subject dimensions
   - Centers subject on background

2. **Segmentation**
   - Uses U2Net model to segment the composite
   - Automatically detects humans vs. general objects
   - Generates high-quality foreground mask

3. **Mask Generation**
   - Converts foreground alpha channel to binary mask
   - Creates precise subject boundaries
   - Saves mask for harmonization step

4. **Harmonization**
   - Uses PCT-Net (Photorealistic Composite Transfer Network)
   - Adjusts lighting, color tone, and shadows
   - Creates realistic integration of subject with background
   - Container: `pct-net-service` (sameer513/pct-net-final)

**Processing Details:**
- Total processing time: 60-120 seconds
- Supports images up to 2048x2048 resolution
- Automatic cleanup of temporary files
- Works with both human subjects and objects

**Frontend Example:**
```javascript
const replaceBackground = async (subjectUrl, backgroundUrl) => {
  try {
    const response = await fetch('/api/v1/adobe-ps/ai/replace-background', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        subjectImageUrl: subjectUrl,
        backgroundImageUrl: backgroundUrl
      })
    });
    
    if (!response.ok) {
      throw new Error('Background replacement failed');
    }
    
    const { data } = await response.json();
    return data.harmonizedImageUrl;
    
  } catch (error) {
    console.error('Error:', error.message);
    throw error;
  }
};

// Usage in Layer-Based Workflow
const handleBackgroundReplace = async () => {
  // Get layer image URLs
  const subjectLayer = layers.find(l => l.type === 'foreground');
  const backgroundLayer = layers.find(l => l.type === 'background');
  
  // Replace background
  const resultUrl = await replaceBackground(
    subjectLayer.imageUrl,
    backgroundLayer.imageUrl
  );
  
  // Create new layer with result
  await addCustomLayer(resultUrl, projectId);
};
```

**React Component Example:**
```jsx
import React, { useState } from 'react';

function BackgroundReplacer({ subjectLayer, backgroundLayer, token }) {
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [progress, setProgress] = useState(0);
  
  const handleReplace = async () => {
    setProcessing(true);
    setProgress(0);
    
    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
      }, 6000);
      
      const response = await fetch('/api/v1/adobe-ps/ai/replace-background', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          subjectImageUrl: subjectLayer.imageUrl,
          backgroundImageUrl: backgroundLayer.imageUrl
        })
      });
      
      clearInterval(progressInterval);
      setProgress(100);
      
      const { data } = await response.json();
      setResult(data.harmonizedImageUrl);
      
    } catch (error) {
      console.error('Background replacement failed:', error);
      alert('Failed to replace background. Please try again.');
    } finally {
      setProcessing(false);
    }
  };
  
  return (
    <div className="background-replacer">
      <h3>Replace Background</h3>
      
      <div className="preview">
        <div className="layer-preview">
          <img src={subjectLayer.imageUrl} alt="Subject" />
          <span>Subject</span>
        </div>
        <div className="plus-icon">+</div>
        <div className="layer-preview">
          <img src={backgroundLayer.imageUrl} alt="Background" />
          <span>Background</span>
        </div>
      </div>
      
      <button 
        onClick={handleReplace} 
        disabled={processing}
        className="replace-btn"
      >
        {processing ? 'Processing...' : 'Replace Background'}
      </button>
      
      {processing && (
        <div className="progress-bar">
          <div 
            className="progress-fill" 
            style={{ width: `${progress}%` }}
          />
          <span>{progress}%</span>
        </div>
      )}
      
      {result && (
        <div className="result">
          <h4>Result:</h4>
          <img src={result} alt="Harmonized result" />
          <button onClick={() => createLayerWithResult(result)}>
            Add to Canvas
          </button>
        </div>
      )}
    </div>
  );
}

export default BackgroundReplacer;
```

**Use Cases:**
- Portrait photography with custom backgrounds
- Product photography on different backgrounds
- Creative compositions
- Real estate photography (furniture in different rooms)
- E-commerce product images

**Important Notes:**
- Requires both `background-removal-service` (U2Net) and `pct-net-service` (PCT-Net) containers
- Works best with clean subject images (no existing background artifacts)
- Background image should be larger than or equal to subject dimensions
- Automatic human detection for optimized segmentation
- Final result uploaded to Cloudinary for persistence

---

## API Endpoints - Complete Reference

### Authentication Routes (`/api/v1/adobe-ps/auth`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/signup` | Create new user account | No |
| POST | `/login` | Login and get JWT token | No |
| POST | `/verify-otp` | Verify email with OTP code | No |
| POST | `/resend-otp` | Resend OTP to email | No |
| POST | `/google` | Google OAuth authentication | No |
| GET | `/logout` | Logout user | No |

#### POST `/signup`
```json
// Request Body
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securePassword123"
}

// Response (201)
{
  "status": "success",
  "message": "OTP sent to your email. Please verify.",
  "data": {
    "user": {
      "id": "user_id",
      "name": "John Doe",
      "email": "john@example.com",
      "isVerified": false
    }
  }
}
```

#### POST `/login`
```json
// Request Body
{
  "email": "john@example.com",
  "password": "securePassword123"
}

// Response (200)
{
  "status": "success",
  "token": "jwt_token_here",
  "data": {
    "user": {
      "id": "user_id",
      "name": "John Doe",
      "email": "john@example.com"
    }
  }
}
```

#### POST `/verify-otp`
```json
// Request Body
{ "email": "john@example.com", "otp": "1234" }
```

#### POST `/google`
```json
// Request Body
{ "token": "google_oauth_token" }
```

---

### Image Routes (`/api/v1/adobe-ps/images`)

**All routes require authentication (Bearer token)**

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/upload` | Upload single image |
| POST | `/upload-multiple` | Upload multiple images (max 2) |
| PATCH | `/crop` | Crop an image |
| GET | `/:publicId` | Get image details |
| DELETE | `/:publicId` | Delete single image |
| DELETE | `/delete-all` | Delete all user images |

#### POST `/upload`
```bash
# Request (multipart/form-data)
Content-Type: multipart/form-data
Authorization: Bearer <token>

# Form fields:
image: <file> (jpg, jpeg, png, heif - max 20MB)
```

```json
// Response (201)
{
  "status": "success",
  "data": {
    "image": {
      "publicId": "adobe_ps/abc123",
      "imageUrl": "https://res.cloudinary.com/...",
      "format": "png",
      "width": 1920,
      "height": 1080,
      "size": 245678
    }
  }
}
```

#### PATCH `/crop`
```json
// Request Body
{
  "publicId": "adobe_ps/abc123",
  "x": 100,
  "y": 100,
  "width": 500,
  "height": 500
}
```

---

### AI Sequential Project Routes (`/api/v1/adobe-ps/ai-projects`)

**All routes require authentication**

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/create` | Create new AI project |
| GET | `/` | Get all user AI projects |
| GET | `/:projectId` | Get project details with operation history |
| PATCH | `/:projectId` | Update project metadata |
| DELETE | `/:projectId` | Delete project |
| POST | `/:projectId/operations` | Add AI operation result |
| POST | `/:projectId/undo` | Undo last operation |
| POST | `/:projectId/revert/:operationIndex` | Revert to specific operation |
| GET | `/:projectId/timeline` | Get operation timeline |

#### POST `/create`
```json
// Request Body
{
  "title": "AI Edit Project",
  "originalImage": {
    "imageUrl": "https://res.cloudinary.com/...",
    "publicId": "adobe_ps/abc123",
    "width": 1920,
    "height": 1080,
    "format": "png",
    "size": 245678
  }
}

// Response (201)
{
  "status": "success",
  "data": {
    "project": {
      "_id": "ai_project_id",
      "title": "AI Edit Project",
      "originalImage": {...},
      "currentImage": {...},
      "operations": [],
      "status": "active"
    }
  }
}
```

#### POST `/:projectId/operations`
```json
// Request Body
{
  "operationType": "enhance",  // relight|enhance|face-restore|style-transfer|remove-background|object-removal
  "prompt": { "intensity": 0.8 },
  "inputImage": { "imageUrl": "...", "publicId": "..." },
  "outputImage": {
    "imageUrl": "https://res.cloudinary.com/...",
    "publicId": "adobe_ps/enhanced123",
    "width": 1920,
    "height": 1080,
    "format": "png",
    "size": 267890
  }
}
```

#### POST `/:projectId/undo`
Removes the last operation and reverts `currentImage` to previous state.

#### POST `/:projectId/revert/:operationIndex`
- Use index `-1` to revert to original image
- Use index `0` to revert to after first operation

---

### Layer-Based Project Routes (`/api/v1/adobe-ps/projects`)

**All routes require authentication**

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/create` | Create new layer project |
| GET | `/` | Get all user projects |
| GET | `/:projectId` | Get project with all layers |
| PATCH | `/:projectId/title` | Update project title |
| DELETE | `/:projectId` | Delete project and all layers |

#### POST `/create`
```json
// Request Body
{
  "title": "My Project",
  "canvas": {
    "width": 1920,
    "height": 1080,
    "backgroundColor": "#ffffff"
  }
}

// Response (201)
{
  "status": "success",
  "data": {
    "project": {
      "_id": "project_id",
      "title": "My Project",
      "canvas": { "width": 1920, "height": 1080, "backgroundColor": "#ffffff" },
      "layers": [],
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

#### GET `/:projectId`
```json
// Response (200)
{
  "status": "success",
  "data": {
    "project": {
      "_id": "project_id",
      "title": "My Project",
      "canvas": {...},
      "layers": [
        {
          "_id": "layer_id",
          "name": "Background",
          "type": "background",
          "imageUrl": "...",
          "order": 0,
          "visible": true,
          "opacity": 100,
          "blendMode": "normal"
        }
      ]
    }
  }
}
```

---

### Layer Routes (`/api/v1/adobe-ps/layers`)

**All routes require authentication**

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/` | Create new layer |
| GET | `/project/:projectId` | Get all layers for project |
| GET | `/:layerId` | Get single layer details |
| PATCH | `/:layerId` | Update layer properties |
| DELETE | `/:layerId` | Delete layer |
| PATCH | `/project/:projectId/reorder` | Reorder layers (z-index) |
| POST | `/:layerId/duplicate` | Duplicate layer |

#### POST `/`
```json
// Request Body
{
  "projectId": "project_id",
  "name": "New Layer",
  "type": "object",  // background|foreground|object|text|adjustment|custom
  "imageUrl": "https://res.cloudinary.com/...",
  "publicId": "adobe_ps/abc123",
  "order": 1,
  "dimensions": { "width": 500, "height": 500 }
}

// Response (201)
{
  "status": "success",
  "data": {
    "layer": {
      "_id": "layer_id",
      "project": "project_id",
      "name": "New Layer",
      "type": "object",
      "imageUrl": "...",
      "order": 1,
      "visible": true,
      "locked": false,
      "opacity": 100,
      "blendMode": "normal",
      "position": { "x": 0, "y": 0 },
      "dimensions": { "width": 500, "height": 500 },
      "transformations": {
        "rotation": 0,
        "scaleX": 1,
        "scaleY": 1,
        "flipX": false,
        "flipY": false
      }
    }
  }
}
```

#### PATCH `/:layerId`
```json
// Request Body (all fields optional)
{
  "name": "Renamed Layer",
  "visible": false,
  "opacity": 75,
  "blendMode": "multiply",  // normal|multiply|screen|overlay|soft-light|hard-light
  "position": { "x": 100, "y": 50 },
  "transformations": {
    "rotation": 45,
    "scaleX": 1.5,
    "scaleY": 1.5,
    "flipX": true,
    "flipY": false
  }
}
```

#### PATCH `/project/:projectId/reorder`
```json
// Request Body
{
  "layerIds": ["layer_id_3", "layer_id_1", "layer_id_2"]
}
```

---

### AI Operation Routes (`/api/v1/adobe-ps/ai`)

**All routes require authentication**

| Method | Endpoint | Description | Docker Container |
|--------|----------|-------------|------------------|
| POST | `/separate-layers` | AI layer separation | background-removal-service |
| POST | `/relight` | Low-light enhancement | lowlight-service |
| POST | `/enhance` | Denoise/deblur | nafnet-service |
| POST | `/face-restore` | Face restoration | codeformer-service |
| POST | `/style-transfer` | Artistic style transfer | style-transfer-service |
| POST | `/remove-background` | Background removal | background-removal-service |
| POST | `/object-removal` | Remove objects | object-masking-service + object-remover-service |
| POST | `/replace-background` | Replace background | background-removal-service + pct-net-service |

#### POST `/separate-layers`
```json
// Request Body
{
  "imageUrl": "https://res.cloudinary.com/...",
  "publicId": "adobe_ps/abc123"
}

// Response
{
  "status": "success",
  "data": {
    "layers": [
      { "type": "background", "imageUrl": "...", "publicId": "..." },
      { "type": "foreground", "imageUrl": "...", "publicId": "..." }
    ]
  }
}
```

#### POST `/relight`
```json
// Request Body
{
  "publicId": "adobe_ps/abc123",
  "brightness": 1.5
}

// Response
{
  "status": "success",
  "data": {
    "relitImage": { "publicId": "...", "imageUrl": "...", "width": 1920, "height": 1080 },
    "relitImageUrl": "https://res.cloudinary.com/..."
  }
}
```

#### POST `/enhance`
```json
// Request Body
{
  "publicId": "adobe_ps/abc123",
  "mode": "denoise"  // or "deblur"
}

// Response
{
  "status": "success",
  "data": {
    "enhancedImage": { "publicId": "...", "imageUrl": "...", "width": 1920, "height": 1080 },
    "enhancedImageUrl": "https://res.cloudinary.com/...",
    "mode": "denoise"
  }
}
```

#### POST `/face-restore`
```json
// Request Body
{
  "publicId": "adobe_ps/abc123",
  "fidelity": 0.7
}
```

#### POST `/style-transfer`
```json
// Request Body
{
  "publicId": "adobe_ps/content123",
  "stylePublicId": "adobe_ps/style456"
}
```

#### POST `/remove-background`
```json
// Request Body
{
  "publicId": "adobe_ps/abc123"
}

// Response
{
  "status": "success",
  "data": {
    "foregroundImage": { "publicId": "...", "imageUrl": "..." },
    "foregroundImageUrl": "https://res.cloudinary.com/..."
  }
}
```

#### POST `/object-removal`
```json
// Request Body
{
  "publicId": "adobe_ps/abc123",
  "x": 450,
  "y": 300
}

// Response
{
  "status": "success",
  "data": {
    "outputImage": { "publicId": "...", "imageUrl": "..." }
  }
}
```

#### POST `/replace-background`
```json
// Request Body
{
  "subjectImageUrl": "https://res.cloudinary.com/.../subject.jpg",
  "backgroundImageUrl": "https://res.cloudinary.com/.../background.jpg"
}

// Response
{
  "status": "success",
  "data": {
    "harmonizedImage": { "publicId": "...", "imageUrl": "...", "width": 1920, "height": 1080 },
    "harmonizedImageUrl": "https://res.cloudinary.com/..."
  }
}
```

---

### Gemini AI Routes (`/api/v1/adobe-ps/gemini`)

**All routes require authentication**

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/analyze` | Analyze image content with Gemini vision |
| POST | `/prompt` | Process natural language prompt |
| POST | `/auto-enhance/:projectId` | Get AI enhancement suggestions |
| POST | `/apply-enhancements/:projectId` | Apply suggested enhancements |

#### POST `/analyze`
```json
// Request Body
{
  "imageUrl": "https://res.cloudinary.com/..."
}

// Response
{
  "status": "success",
  "data": {
    "analysis": {
      "subjectType": "human",
      "content": "A portrait photo of a person...",
      "suggestedOperations": ["face-restore", "enhance"]
    }
  }
}
```

#### POST `/prompt`
```json
// Request Body
{
  "publicId": "adobe_ps/abc123",
  "prompt": "remove the cup from the table",
  "projectId": "project_id",
  "projectType": "ai-sequential"
}

// Response (if object removal detected)
{
  "requiresInteraction": true,
  "message": "Please point out the object to remove"
}
```

#### POST `/auto-enhance/:projectId`
```json
// Response
{
  "status": "success",
  "data": {
    "suggestions": [
      { "operation": "enhance", "reason": "Image appears underexposed", "priority": 1 },
      { "operation": "denoise", "reason": "Noise detected in shadows", "priority": 2 }
    ]
  }
}
```

#### POST `/apply-enhancements/:projectId`
```json
// Request Body
{
  "enhancements": ["enhance", "denoise"]
}
```

---

### Settings Routes (`/api/v1/adobe-ps/settings`)

**All routes require authentication**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Get user settings |
| PATCH | `/max-versions` | Update max history versions (1-15) |

#### GET `/`
```json
// Response
{
  "status": "success",
  "data": {
    "settings": { "maxVersions": 10 }
  }
}
```

#### PATCH `/max-versions`
```json
// Request Body
{ "maxVersions": 15 }
```

---

## Frontend Integration Guides

### AI Sequential Editing Workflow

**Complete step-by-step implementation guide:**

```javascript
// ===== STEP 1: Create Project =====
const createProject = async () => {
  const response = await fetch('/api/v1/adobe-ps/ai-projects/create', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      title: "Photo Enhancement",
      description: "Portrait editing session"
    })
  });
  const { data } = await response.json();
  return data.projectId;
};

// ===== STEP 2: Upload Image =====
const uploadImage = async (file, projectId) => {
  const formData = new FormData();
  formData.append('image', file);
  formData.append('projectId', projectId);
  formData.append('projectType', 'ai-sequential');
  
  const response = await fetch('/api/v1/adobe-ps/images/upload', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData
  });
  const { data } = await response.json();
  return data.image.publicId;
};

// ===== STEP 3: Apply AI Operations =====

// Relight
const applyRelight = async (publicId) => {
  const response = await fetch('/api/v1/adobe-ps/ai/relight', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      publicId: publicId,
      brightness: 1.5
    })
  });
  const { data } = await response.json();
  return data.relitImageUrl;
};

// Enhance (denoise)
const applyEnhance = async (publicId) => {
  const response = await fetch('/api/v1/adobe-ps/ai/enhance', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      publicId: publicId,
      mode: 'denoise'
    })
  });
  const { data } = await response.json();
  return data.enhancedImageUrl;
};

// Face Restore
const applyFaceRestore = async (publicId) => {
  const response = await fetch('/api/v1/adobe-ps/ai/face-restore', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      publicId: publicId,
      fidelity: 0.7
    })
  });
  const { data } = await response.json();
  return data.restoredImageUrl;
};

// ===== STEP 4: View Project History =====
const getProjectHistory = async (projectId) => {
  const response = await fetch(`/api/v1/adobe-ps/ai-projects/${projectId}`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const { data } = await response.json();
  
  // Display timeline
  console.log('Original:', data.originalImage.imageUrl);
  data.operations.forEach((op, i) => {
    console.log(`Step ${i + 1}: ${op.operation}`, op.outputImage.imageUrl);
  });
  
  return data;
};

// ===== COMPLETE WORKFLOW =====
const runSequentialWorkflow = async (imageFile) => {
  try {
    // Create project
    const projectId = await createProject();
    
    // Upload image
    let currentPublicId = await uploadImage(imageFile, projectId);
    
    // Chain AI operations
    const relitUrl = await applyRelight(currentPublicId);
    currentPublicId = extractPublicId(relitUrl);
    
    const enhancedUrl = await applyEnhance(currentPublicId);
    currentPublicId = extractPublicId(enhancedUrl);
    
    const restoredUrl = await applyFaceRestore(currentPublicId);
    
    // View final result and history
    const project = await getProjectHistory(projectId);
    console.log('Final result:', project.currentImage.imageUrl);
    
  } catch (error) {
    console.error('Workflow error:', error);
  }
};
```

### Layer-Based Editing Workflow

**Complete step-by-step implementation guide:**

```javascript
// ===== STEP 1: Create Layer Project =====
const createLayerProject = async () => {
  const response = await fetch('/api/v1/adobe-ps/projects/create', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      title: "Photo Composition",
      width: 1920,
      height: 1080,
      backgroundColor: "#ffffff"
    })
  });
  const { data } = await response.json();
  return data.projectId;
};

// ===== STEP 2: Upload First Image (Auto-Separates) =====
const uploadFirstImage = async (file, projectId) => {
  const formData = new FormData();
  formData.append('image', file);
  formData.append('projectId', projectId);
  formData.append('projectType', 'layer-based');
  
  const response = await fetch('/api/v1/adobe-ps/images/upload', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData
  });
  const { data } = await response.json();
  
  // First upload creates 2 layers automatically
  // - Background layer (order: 0)
  // - Foreground/Subject layer (order: 1)
  
  return {
    backgroundLayer: data.layers[0],
    foregroundLayer: data.layers[1]
  };
};

// ===== STEP 3: Upload Additional Images (Single Layer Each) =====
const addCustomLayer = async (file, projectId) => {
  const formData = new FormData();
  formData.append('image', file);
  formData.append('projectId', projectId);
  formData.append('projectType', 'layer-based');
  formData.append('layerName', 'Custom Layer');
  formData.append('layerType', 'object');
  
  const response = await fetch('/api/v1/adobe-ps/images/upload', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData
  });
  const { data } = await response.json();
  return data.layer;
};

// ===== STEP 4: Get All Layers =====
const getProjectLayers = async (projectId) => {
  const response = await fetch(`/api/v1/adobe-ps/projects/${projectId}`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const { data } = await response.json();
  return data.layers;  // Sorted by order (bottom to top)
};

// ===== STEP 5: Update Layer Properties =====
const updateLayerOpacity = async (layerId, opacity) => {
  const response = await fetch(`/api/v1/adobe-ps/layers/${layerId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ opacity: opacity })
  });
  const { data } = await response.json();
  return data.layer;
};

const updateLayerPosition = async (layerId, x, y) => {
  const response = await fetch(`/api/v1/adobe-ps/layers/${layerId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      position: { x, y }
    })
  });
  const { data } = await response.json();
  return data.layer;
};

const updateLayerTransform = async (layerId, rotation, scaleX, scaleY) => {
  const response = await fetch(`/api/v1/adobe-ps/layers/${layerId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      transformations: {
        rotation: rotation,
        scaleX: scaleX,
        scaleY: scaleY,
        flipX: false,
        flipY: false
      }
    })
  });
  const { data } = await response.json();
  return data.layer;
};

// ===== STEP 6: Reorder Layers (Change Z-Index) =====
const reorderLayers = async (projectId, orderedLayerIds) => {
  const response = await fetch(`/api/v1/adobe-ps/layers/project/${projectId}/reorder`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      layerIds: orderedLayerIds  // Array of layer IDs in desired order
    })
  });
  const { data } = await response.json();
  return data.layers;
};

// ===== STEP 7: Duplicate Layer =====
const duplicateLayer = async (layerId) => {
  const response = await fetch(`/api/v1/adobe-ps/layers/${layerId}/duplicate`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const { data } = await response.json();
  return data.layer;
};

// ===== STEP 8: Delete Layer =====
const deleteLayer = async (layerId) => {
  const response = await fetch(`/api/v1/adobe-ps/layers/${layerId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const { message } = await response.json();
  return message;
};

// ===== COMPLETE WORKFLOW =====
const runLayerWorkflow = async (imageFile1, imageFile2) => {
  try {
    // Create project
    const projectId = await createLayerProject();
    
    // Upload first image (auto-separates into 2 layers)
    const { backgroundLayer, foregroundLayer } = await uploadFirstImage(imageFile1, projectId);
    console.log('Background layer:', backgroundLayer._id);
    console.log('Foreground layer:', foregroundLayer._id);
    
    // Add another image as custom layer
    const customLayer = await addCustomLayer(imageFile2, projectId);
    console.log('Custom layer:', customLayer._id);
    
    // Get all layers
    const layers = await getProjectLayers(projectId);
    console.log('Total layers:', layers.length);
    
    // Update foreground layer opacity
    await updateLayerOpacity(foregroundLayer._id, 80);
    
    // Move custom layer
    await updateLayerPosition(customLayer._id, 100, 50);
    
    // Reorder layers (move custom layer to top)
    const newOrder = [
      backgroundLayer._id,
      foregroundLayer._id,
      customLayer._id
    ];
    await reorderLayers(projectId, newOrder);
    
    console.log('Layer workflow complete!');
    
  } catch (error) {
    console.error('Workflow error:', error);
  }
};
```

### React Component Example

```jsx
import React, { useState, useEffect } from 'react';

function LayerEditor({ projectId, token }) {
  const [layers, setLayers] = useState([]);
  const [selectedLayer, setSelectedLayer] = useState(null);

  useEffect(() => {
    loadLayers();
  }, [projectId]);

  const loadLayers = async () => {
    const response = await fetch(`/api/v1/adobe-ps/projects/${projectId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const { data } = await response.json();
    setLayers(data.layers);
  };

  const updateOpacity = async (layerId, opacity) => {
    await fetch(`/api/v1/adobe-ps/layers/${layerId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ opacity })
    });
    loadLayers();
  };

  const toggleVisibility = async (layerId, visible) => {
    await fetch(`/api/v1/adobe-ps/layers/${layerId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ visible: !visible })
    });
    loadLayers();
  };

  return (
    <div className="layer-editor">
      <div className="canvas">
        {layers.map(layer => (
          layer.visible && (
            <img
              key={layer._id}
              src={layer.imageUrl}
              style={{
                position: 'absolute',
                left: layer.position.x,
                top: layer.position.y,
                opacity: layer.opacity / 100,
                transform: `rotate(${layer.transformations.rotation}deg) 
                           scaleX(${layer.transformations.scaleX}) 
                           scaleY(${layer.transformations.scaleY})`,
                zIndex: layer.order
              }}
              alt={layer.name}
            />
          )
        ))}
      </div>

      <div className="layer-panel">
        <h3>Layers</h3>
        {layers.map(layer => (
          <div 
            key={layer._id} 
            className={`layer-item ${selectedLayer === layer._id ? 'selected' : ''}`}
            onClick={() => setSelectedLayer(layer._id)}
          >
            <button onClick={() => toggleVisibility(layer._id, layer.visible)}>
              {layer.visible ? '👁️' : '🚫'}
            </button>
            <span>{layer.name}</span>
            <input
              type="range"
              min="0"
              max="100"
              value={layer.opacity}
              onChange={(e) => updateOpacity(layer._id, parseInt(e.target.value))}
            />
            <span>{layer.opacity}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default LayerEditor;
```

---

## Authentication

All protected routes require JWT authentication.

### Get Token

```javascript
// Login
const response = await fetch('/api/v1/adobe-ps/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'password123'
  })
});

const { token } = await response.json();
localStorage.setItem('token', token);
```

### Use Token

```javascript
// Include in all protected requests
const response = await fetch('/api/v1/adobe-ps/projects', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

### Token Expiry

Tokens expire after the duration set in `JWT_EXPIRES_IN` (default: 30 days). Handle expiry:

```javascript
const response = await fetch('/api/v1/adobe-ps/projects', {
  headers: { 'Authorization': `Bearer ${token}` }
});

if (response.status === 401) {
  // Token expired or invalid
  // Redirect to login
  window.location.href = '/login';
}
```

---

## Error Handling

All errors follow this format:

```json
{
  "status": "error",
  "message": "Descriptive error message",
  "statusCode": 400,
  "stack": "..." // Only in development
}
```

### Common HTTP Status Codes

| Code | Meaning | Common Causes |
|------|---------|---------------|
| 400 | Bad Request | Missing required fields, invalid parameters |
| 401 | Unauthorized | Missing/invalid JWT token |
| 403 | Forbidden | Not authorized to access resource |
| 404 | Not Found | Resource doesn't exist |
| 500 | Server Error | AI processing error, Docker issues, database errors |

### Frontend Error Handling

```javascript
try {
  const response = await fetch('/api/v1/adobe-ps/ai/relight', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ publicId, brightness: 1.5 })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }

  const data = await response.json();
  return data;

} catch (error) {
  if (error.message.includes('not found')) {
    console.error('Image not found. Please re-upload.');
  } else if (error.message.includes('unauthorized')) {
    console.error('Session expired. Please login again.');
    // Redirect to login
  } else {
    console.error('Processing error:', error.message);
  }
}
```

---

## Docker Requirements

### AI Model Containers

All AI operations require Docker containers to be running:

| Container Name | Image | Purpose |
|----------------|-------|---------|
| `lowlight-service` | `sameer513/lowlight-cpu-bullseye` | Low-light enhancement |
| `codeformer-service` | `sameer513/codeformer_app` | Face restoration |
| `nafnet-service` | `sameer513/nafnet-image` | Denoise/deblur |
| `style-transfer-service` | `sameer513/pca-style-transfer-fixed` | Style transfer |
| `background-removal-service` | `sameer513/u2net-inference` | Background removal |
| `object-masking-service` | `sameer513/sam-cpu-final` | Object segmentation (SAM) |
| `object-remover-service` | `sameer513/better-lama` | Object inpainting (LaMa) |

### Start All Containers

```bash
#!/bin/bash

# Start all AI containers
docker start lowlight-service || docker run -d --name lowlight-service sameer513/lowlight-cpu-bullseye tail -f /dev/null
docker start codeformer-service || docker run -d --name codeformer-service sameer513/codeformer_app tail -f /dev/null
docker start nafnet-service || docker run -d --name nafnet-service sameer513/nafnet-image tail -f /dev/null
docker start style-transfer-service || docker run -d --name style-transfer-service sameer513/pca-style-transfer-fixed tail -f /dev/null
docker start background-removal-service || docker run -d --name background-removal-service sameer513/u2net-inference tail -f /dev/null
docker start pct-net-service || docker run -d --name pct-net-service sameer513/pct-net-final tail -f /dev/null
docker start object-masking-service || docker run -d --name object-masking-service sameer513/sam-cpu-final tail -f /dev/null
docker start object-remover-service || docker run -d --name object-remover-service sameer513/better-lama tail -f /dev/null

echo "All AI containers started successfully!"
```

### Check Container Status

```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Image}}"
```

---

## Additional Resources

For detailed documentation on specific features:

- **[AI Sequential Workflow Guide](readMeFiles/AI_SEQUENTIAL_WORKFLOW_GUIDE.md)** - Complete frontend integration for AI sequential editing
- **[Layer Workflow Guide](readMeFiles/LAYER_WORKFLOW_GUIDE.md)** - Complete frontend integration for layer-based editing
- **[Auto-Enhancement with Gemini AI](readMeFiles/AUTO_ENHANCEMENT_GEMINI_GUIDE.md)** - Intelligent enhancement analysis and recommendations
- **[AI Operations Documentation](readMeFiles/AI_ROUTES_DOCUMENTATION.md)** - Detailed API reference for all AI operations
- **[Object Removal Workflow](readMeFiles/OBJECT_REMOVAL_GEMINI_WORKFLOW.md)** - Interactive object removal with Gemini AI
- **[Background Removal Guide](readMeFiles/BACKGROUND_REMOVAL_README.md)** - Background removal API documentation
- **[Image & Layer Management](readMeFiles/IMAGE_LAYER_DOCUMENTATION.md)** - Image upload and layer management
- **[Project Systems Documentation](readMeFiles/PROJECT_SYSTEMS_DOCUMENTATION.md)** - Project creation and management

---

## Support

For issues or questions:
- Check server logs for detailed error messages
- Verify Docker containers are running
- Ensure environment variables are set correctly
- Verify Cloudinary credentials
- Check MongoDB connection

**Last Updated:** December 4, 2025
