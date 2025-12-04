# Arclight

> AI-powered image editing application with layer-based and sequential AI workflows

---

## Overview

**Arclight** is a full-stack image editing application that combines traditional layer-based editing with AI-powered image processing. The application offers two distinct editing modes:

- **Workspace (Layer-Based)**: Photoshop-like layer composition with real-time filters and transformations
- **Flowspace (AI Sequential)**: Chain AI operations with full history and undo/redo capabilities

## Project Structure

```
├── frontend/          # React Native Expo mobile application
├── backend/           # Node.js/Express API server
└── Documentation/     # Additional project documentation
```

## Quick Start

### Backend Setup

```bash
cd backend
npm install
npm start
```

See [backend/README.md](backend/README.md) for detailed setup, API documentation, and Docker requirements.

### Frontend Setup

```bash
cd frontend
npm install
npx expo start
```

See [frontend/README.md](frontend/README.md) for detailed setup, architecture, and component documentation.

## Key Features

- **Authentication**: Email/password and Google OAuth support
- **Layer Management**: Create, reorder, duplicate, and transform layers
- **AI Operations**: Relight, enhance, face-restore, style-transfer, background removal
- **Real-time Filters**: GPU-accelerated image processing
- **Project Management**: Save and load both layer-based and AI sequential projects
- **Theme System**: Light and dark mode support

## Tech Stack

### Frontend
- React Native + Expo
- TypeScript
- Expo Router (file-based routing)
- Expo GL (GPU-accelerated rendering)

### Backend
- Node.js + Express
- MongoDB (Mongoose ODM)
- Cloudinary (image storage)
- Replicate API (AI operations)
- JWT authentication

## Documentation

For detailed documentation, refer to:
- **Frontend**: [frontend/README.md](frontend/README.md) - Complete UI/UX architecture, routing, components, and API integration
- **Backend**: [backend/README.md](backend/README.md) - API endpoints, authentication flows, AI operations, and database schemas

## License

This project is part of Team 94's development efforts.
