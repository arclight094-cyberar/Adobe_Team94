// API Service Utility
// Centralized API client for making backend requests

import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  getCachedApiUrl, 
  initializeApiUrl, 
  setCustomApiUrl,
  getCurrentApiUrl 
} from '../constants/api';

class ApiService {
  private baseURL: string;

  constructor() {
    // Use cached URL initially
    this.baseURL = getCachedApiUrl();
    // Initialize async URL loading
    this.initializeUrl();
  }

  private async initializeUrl() {
    const url = await initializeApiUrl();
    this.baseURL = url;
    console.log('ApiService initialized with URL:', this.baseURL);
  }

  // Add method to update base URL dynamically
  async updateBaseUrl(url: string) {
    await setCustomApiUrl(url);
    this.baseURL = url;
    console.log('ApiService base URL updated to:', this.baseURL);
  }

  // Get current base URL
  getBaseUrl(): string {
    return this.baseURL;
  }

  // Refresh base URL from storage
  async refreshBaseUrl() {
    const url = await getCurrentApiUrl();
    this.baseURL = url;
    console.log('ApiService base URL refreshed to:', this.baseURL);
    return url;
  }

  // Get stored JWT token
  private async getToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem('jwt_token');
    } catch (error) {
      console.error('Error getting token:', error);
      return null;
    }
  }

  // Make API request with automatic token handling
  async request(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const token = await this.getToken();
    
    // Don't set Content-Type for FormData (it will be set automatically with boundary)
    const isFormData = options.body instanceof FormData;
    const headers: Record<string, string> = isFormData
      ? {}
      : {
          'Content-Type': 'application/json',
        };
    
    // Merge with any provided headers
    if (options.headers) {
      Object.assign(headers, options.headers);
    }

    // Add authorization header if token exists
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const url = `${this.baseURL}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });
      
      return response;
    } catch (error: any) {
      // Only log network errors if they're not part of a retry sequence
      // (uploadImage handles its own error logging)
      if (!url.includes('/images/upload')) {
        console.error('API Request Error:', error);
        console.error('Request URL:', url);
      }
      
      // Provide more helpful error messages
      if (error.message?.includes('Network request failed') || error.message?.includes('Failed to fetch')) {
        const helpfulError = new Error(
          `Cannot connect to backend server at ${this.baseURL}\n\n` +
          `Possible issues:\n` +
          `1. Backend server is not running\n` +
          `2. Wrong IP address in constants/api.ts\n` +
          `3. Device/emulator not on same network\n` +
          `4. Firewall blocking port 4000\n\n` +
          `Check BACKEND_SETUP.md for setup instructions.`
        );
        helpfulError.name = 'NetworkError';
        throw helpfulError;
      }
      
      throw error;
    }
  }

  // Auth Methods
  async login(email: string, password: string) {
    const response = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    let data;
    try {
      data = await response.json();
    } catch (error) {
      // If response is not valid JSON, create error object
      data = {
        success: false,
        message: response.statusText || 'An error occurred',
      };
    }
    
    if (response.ok && data.success === true) {
      // Store token and user data
      if (data.token) {
        await AsyncStorage.setItem('jwt_token', data.token);
      }
      if (data.data?.user) {
        await AsyncStorage.setItem('user_data', JSON.stringify(data.data.user));
      }
    }

    return { response, data };
  }

  async signup(name: string, email: string, password: string) {
    const response = await this.request('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });

    let data;
    try {
      data = await response.json();
    } catch (error) {
      // If response is not valid JSON, create error object
      data = {
        success: false,
        message: response.statusText || 'An error occurred',
      };
    }
    return { response, data };
  }

  async verifyOTP(email: string, otp: string) {
    const response = await this.request('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ email, otp }),
    });

    let data;
    try {
      data = await response.json();
    } catch (error) {
      // If response is not valid JSON, create error object
      data = {
        success: false,
        message: response.statusText || 'An error occurred',
      };
    }
    
    if (response.ok && data.success === true) {
      // Store token and user data after OTP verification
      if (data.token) {
        await AsyncStorage.setItem('jwt_token', data.token);
      }
      if (data.data?.user) {
        await AsyncStorage.setItem('user_data', JSON.stringify(data.data.user));
      }
    }

    return { response, data };
  }

  // Logout - clear stored tokens and user data
  async logout() {
    try {
      await AsyncStorage.removeItem('jwt_token');
      await AsyncStorage.removeItem('user_data');
      await AsyncStorage.removeItem('pending_email');
      await AsyncStorage.removeItem('pending_password');
    } catch (error) {
      console.error('Error during logout:', error);
    }
  }

  // Google Authentication
  async googleAuth(idToken: string) {
    console.log('=== API Service: Google Auth ===');
    console.log('Endpoint: /auth/google');
    console.log('ID Token provided:', idToken ? `Yes (length: ${idToken.length})` : 'NO - MISSING!');
    
    const response = await this.request('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    });

    console.log('Response status:', response.status);
    console.log('Response ok:', response.ok);

    let data;
    try {
      data = await response.json();
      console.log('Response data:', data);
    } catch (error) {
      console.error('Failed to parse response JSON:', error);
      // If response is not valid JSON, create error object
      data = {
        success: false,
        message: response.statusText || 'An error occurred',
      };
    }
    
    if (response.ok && data.success === true) {
      console.log('✅ Storing token and user data');
      // Store token and user data
      if (data.token) {
        await AsyncStorage.setItem('jwt_token', data.token);
      }
      if (data.data?.user) {
        await AsyncStorage.setItem('user_data', JSON.stringify(data.data.user));
      }
    } else {
      console.error('❌ Google auth failed:', {
        status: response.status,
        statusText: response.statusText,
        data: data
      });
    }

    return { response, data };
  }

  // Check if user is authenticated
  async isAuthenticated(): Promise<boolean> {
    const token = await this.getToken();
    return !!token;
  }

  // ============================================================
  // IMAGE UPLOAD
  // Upload image to backend with projectId and projectType
  // ============================================================
  async uploadImage(
    imageUri: string,
    projectId: string,
    projectType: 'layer-based' | 'ai-sequential',
    onRetry?: (attempt: number, maxRetries: number, message: string) => void
  ): Promise<{ response: Response; data: any }> {
    const token = await this.getToken();
    
    if (!token) {
      throw new Error('Authentication required. Please login first.');
    }

    if (!projectId) {
      throw new Error('Project ID is required. Please create a project first.');
    }

    if (!projectType) {
      throw new Error('Project type is required. Must be "layer-based" or "ai-sequential".');
    }

    // Extract filename from URI
    const filename = imageUri.split('/').pop() || 'image.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : 'image/jpeg';

    // Helper function to create FormData
    const createFormData = () => {
      const formData = new FormData();
      formData.append('image', {
        uri: imageUri,
        type: type,
        name: filename,
      } as any);
      formData.append('projectId', projectId);
      formData.append('projectType', projectType);
      return formData;
    };

    // Make request with FormData (don't set Content-Type, let fetch set it with boundary)
    // Image upload endpoint is at /api/v1/adobe-ps/images/upload
    // baseURL already includes /api/v1/adobe-ps, so use /images/upload
    const url = `${this.baseURL}/images/upload`;

    // Retry logic for network errors with longer waits
    const maxRetries = 5; // Increased from 3 to 5
    let response: Response | null = null;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Notify about retry attempt
        if (attempt > 1 && onRetry) {
          onRetry(attempt, maxRetries, `Retrying upload... (${attempt}/${maxRetries})`);
        } else if (onRetry) {
          onRetry(attempt, maxRetries, 'Uploading image...');
        }
        
        // Create fresh FormData for each attempt (FormData can only be used once)
        const formData = createFormData();
        
        // Add timeout to prevent hanging requests - 120 seconds for large images
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 120000);

        response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            // Don't set Content-Type - let fetch set it with boundary for FormData
          },
          body: formData,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        
        // If successful, break out of retry loop
        if (response.ok) {
          lastError = null; // Clear any previous errors
          if (onRetry) {
            onRetry(maxRetries, maxRetries, 'Upload complete!');
          }
          break;
        }
        
        // If non-network error (4xx), don't retry
        if (response.status >= 400 && response.status < 500) {
          lastError = null;
          break;
        }
        
        // For 5xx errors, retry with longer delay
        if (attempt < maxRetries && response.status >= 500) {
          const delay = Math.min(2000 * Math.pow(2, attempt - 1), 10000); // Exponential backoff, max 10s
          if (onRetry) {
            onRetry(attempt, maxRetries, `Server error. Waiting ${Math.round(delay/1000)}s before retry...`);
          }
          await new Promise(resolve => setTimeout(resolve, delay));
        } else if (attempt < maxRetries) {
          // For other non-ok responses, retry
          const delay = Math.min(2000 * Math.pow(2, attempt - 1), 10000);
          if (onRetry) {
            onRetry(attempt, maxRetries, `Unexpected response. Waiting ${Math.round(delay/1000)}s before retry...`);
          }
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (fetchError: any) {
        lastError = fetchError;
        
        // Only log errors on final attempt to avoid cluttering console
        if (attempt === maxRetries) {
          console.error(`=== Network Error (Final Attempt ${attempt}/${maxRetries}) ===`);
          console.error('Error type:', fetchError.name);
          console.error('Error message:', fetchError.message);
          console.error('Failed URL:', url);
        } else {
          // Silent retry - only log at debug level, not error level
          console.log(`[Retry ${attempt}/${maxRetries}] Connection issue, retrying...`);
        }
        
        // If aborted due to timeout, provide helpful message
        if (fetchError.name === 'AbortError') {
          if (attempt === maxRetries) {
            throw new Error('Upload timeout after 2 minutes. The image may be too large or connection is too slow. Please try:\n1. Use a smaller image\n2. Check your internet connection\n3. Move closer to WiFi router');
          }
          // Otherwise retry with longer delay
          const delay = 5000; // 5 second delay before retry
          if (onRetry) {
            onRetry(attempt, maxRetries, `Upload timed out. Waiting ${Math.round(delay/1000)}s before retry...`);
          }
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        // If last attempt, throw error
        if (attempt === maxRetries) {
          let errorMessage = 'Network request failed. ';
          if (fetchError.message?.includes('Network request failed') || fetchError.message?.includes('Failed to fetch')) {
            errorMessage += 'Please check:\n';
            errorMessage += '1. Backend server is running\n';
            errorMessage += `2. Backend URL is correct: ${this.baseURL}\n`;
            errorMessage += '3. Device/emulator can reach the server\n';
            errorMessage += '4. For physical device, use your computer\'s IP address instead of localhost\n';
            errorMessage += '5. Check your internet connection';
          } else {
            errorMessage += fetchError.message || 'Unknown network error';
          }
          
          throw new Error(errorMessage);
        }
        
        // Wait before retrying with exponential backoff (longer delays)
        const delay = Math.min(2000 * Math.pow(2, attempt - 1), 10000); // Max 10 seconds
        if (onRetry) {
          onRetry(attempt, maxRetries, `Connection failed. Waiting ${Math.round(delay/1000)}s before retry... (${attempt}/${maxRetries})`);
        }
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    if (!response) {
      throw new Error('Failed to upload image after multiple attempts');
    }

    let data;
    try {
      data = await response.json();
      console.log('Upload response data:', data);
    } catch (error) {
      console.error('Failed to parse upload response:', error);
      console.error('Response status:', response.status);
      console.error('Response statusText:', response.statusText);
      
      // Try to get response text for debugging
      try {
        const responseText = await response.text();
        console.error('Response text:', responseText);
      } catch (textError) {
        console.error('Could not read response text');
      }
      
      data = {
        success: false,
        message: response.statusText || 'Upload failed',
      };
    }

    return { response, data };
  }

  // ============================================================
  // CREATE LAYER-BASED PROJECT
  // Create a new empty layer-based project (for workspace)
  // ============================================================
  async createLayerProject(
    title: string,
    canvasWidth: number,
    canvasHeight: number,
    backgroundColor: string
  ): Promise<{ response: Response; data: any }> {
    const token = await this.getToken();
    
    if (!token) {
      throw new Error('Authentication required. Please login first.');
    }

    const response = await this.request('/projects/create', {
      method: 'POST',
      body: JSON.stringify({
        title: title || 'Untitled Project',
        canvasWidth: canvasWidth || 1920,
        canvasHeight: canvasHeight || 1080,
        backgroundColor: backgroundColor || '#ffffff',
      }),
    });

    let data;
    try {
      data = await response.json();
      console.log('Create layer project response:', data);
    } catch (error) {
      console.error('Failed to parse create layer project response:', error);
      data = {
        success: false,
        message: response.statusText || 'Failed to create project',
      };
    }

    return { response, data };
  }

  // ============================================================
  // CREATE AI SEQUENTIAL PROJECT
  // Create a new empty AI sequential project (for labspace)
  // ============================================================
  async createAIProject(
    title: string,
    canvasWidth: number,
    canvasHeight: number,
    backgroundColor: string,
    description?: string
  ): Promise<{ response: Response; data: any }> {
    const token = await this.getToken();
    
    if (!token) {
      throw new Error('Authentication required. Please login first.');
    }

    const response = await this.request('/ai-projects/create', {
      method: 'POST',
      body: JSON.stringify({
        title: title || 'AI Edit Project',
        description: description || '',
        canvasWidth: canvasWidth || 1920,
        canvasHeight: canvasHeight || 1080,
        backgroundColor: backgroundColor || '#ffffff',
      }),
    });

    let data;
    try {
      data = await response.json();
      console.log('Create AI project response:', data);
    } catch (error) {
      console.error('Failed to parse create AI project response:', error);
      data = {
        success: false,
        message: response.statusText || 'Failed to create AI project',
      };
    }

    return { response, data };
  }

  // ============================================================
  // ENHANCE IMAGE
  // Removes noise or motion blur using NAFNet AI model
  // 
  // Endpoint: POST /api/v1/adobe-ps/ai/enhance
  // 
  // Request Body:
  //   {
  //     "publicId": "adobe-ps-uploads/abc123xyz",
  //     "mode": "denoise" | "deblur"
  //   }
  // 
  // Parameters:
  //   - publicId (required): Cloudinary public ID of the uploaded image
  //   - mode (required): Enhancement mode
  //     - "denoise": Remove noise/grain from images (High ISO photos, scanned documents, old photos)
  //     - "deblur": Remove motion blur (Motion blur, camera shake, out-of-focus images)
  // 
  // Success Response (200):
  //   {
  //     "success": true,
  //     "message": "Image denoised successfully",
  //     "data": {
  //       "originalImageId": "...",
  //       "originalImageUrl": "...",
  //       "enhancedImageId": "...",
  //       "enhancedImageUrl": "...",
  //       "publicId": "...",
  //       "mode": "denoise",
  //       "format": "jpg",
  //       "width": 1920,
  //       "height": 1080,
  //       "size": 456789,
  //       "createdAt": "..."
  //     }
  //   }
  // 
  // Processing Time: 30-60 seconds
  // Backend: aiController.enhanceImage() -> Docker: nafnet-service (sameer513/nafnet-image)
  // ============================================================
  async enhanceImage(publicId: string, mode: 'denoise' | 'deblur'): Promise<{ response: Response; data: any }> {
    const token = await this.getToken();
    
    if (!token) {
      throw new Error('Authentication required. Please login first.');
    }

    // Validate mode parameter according to API spec
    if (!['denoise', 'deblur'].includes(mode)) {
      throw new Error('Mode must be either "denoise" or "deblur"');
    }

    console.log('=== Enhance Image API Call ===');
    console.log('Endpoint: POST /api/v1/adobe-ps/ai/enhance');
    console.log('PublicId:', publicId);
    console.log('Mode:', mode);
    console.log('Use Cases:');
    console.log('  - denoise: High ISO photos, scanned documents, old photos');
    console.log('  - deblur: Motion blur, camera shake, out-of-focus images');

    // Call the enhance endpoint
    // Backend flow:
    // 1. Validates publicId and mode
    // 2. Finds image in database by publicId
    // 3. Ensures Docker container (nafnet-service) is running
    // 4. Copies image to container
    // 5. Runs NAFNet AI model with appropriate config:
    //    - denoise: options/test/SIDD/NAFNet-width64.yml
    //    - deblur: options/test/REDS/NAFNet-width64.yml
    // 6. Copies result back from container
    // 7. Uploads enhanced image to Cloudinary
    // 8. Saves to database
    // 9. Returns success response with enhancedImageUrl
    const response = await this.request('/ai/enhance', {
      method: 'POST',
      body: JSON.stringify({
        publicId,
        mode,
      }),
    });

    let data;
    try {
      // Try to parse JSON response
      const text = await response.text();
      if (text) {
        data = JSON.parse(text);
        console.log('Enhance image response:', data);
      } else {
        // Empty response
        data = {
          success: false,
          message: 'Empty response from server',
        };
      }
    } catch (error) {
      console.error('Failed to parse enhance image response:', error);
      // If JSON parsing fails, check if it's an error response
      // Backend error format: { status: 'fail', message: '...' } or { success: false, message: '...' }
      data = {
        success: false,
        message: response.statusText || 'Failed to enhance image',
      };
    }

    return { response, data };
  }

  // ============================================================
  // REMOVE BACKGROUND
  // Remove background from image using rembg
  // Route: POST /api/ai/remove-background
  // Backend: aiController.removeBackground
  // 
  // Parameters:
  //   - publicId: Cloudinary public ID of the image
  //   - mode: 'human' for subject removal, 'object' for object removal
  // 
  // Returns:
  //   - Image with background removed (transparent PNG)
  // ============================================================
  async removeBackground(publicId: string, mode: 'human' | 'object'): Promise<{ response: Response; data: any }> {
    const token = await this.getToken();
    
    if (!token) {
      throw new Error('Authentication required. Please login first.');
    }

    // Validate mode parameter
    if (!['human', 'object'].includes(mode)) {
      throw new Error('Mode must be either "human" or "object"');
    }

    console.log('=== Remove Background API Call ===');
    console.log('PublicId:', publicId);
    console.log('Mode:', mode);

    // Call the remove-background route in aiRoutes.js
    // This route calls aiController.removeBackground which:
    // 1. Finds image in database by publicId
    // 2. Uses rembg tool with appropriate model:
    //    - human: u2net_human_seg (for subject removal)
    //    - object: u2netp (for object removal)
    // 3. Removes background and creates transparent PNG
    // 4. Uploads to Cloudinary
    // 5. Saves to database
    // 6. Returns processed image URL
    const response = await this.request('/ai/remove-background', {
      method: 'POST',
      body: JSON.stringify({
        publicId,
        mode,
      }),
    });

    let data;
    try {
      data = await response.json();
      console.log('Remove background response:', data);
    } catch (error) {
      console.error('Failed to parse remove background response:', error);
      data = {
        success: false,
        message: response.statusText || 'Failed to remove background',
      };
    }

    return { response, data };
  }

  // ============================================================
  // OBJECT REMOVAL
  // Remove object from image using coordinates
  // 
  // Endpoint: POST /api/v1/adobe-ps/ai/object-removal
  // 
  // Request Body:
  //   {
  //     "publicId": "adobe-ps-uploads/abc123xyz",
  //     "x": 512,  // X coordinate of object to remove (top-left origin)
  //     "y": 384   // Y coordinate of object to remove (top-left origin)
  //   }
  // 
  // Success Response (200):
  //   {
  //     "success": true,
  //     "message": "Object removed successfully",
  //     "data": {
  //       "inputImage": {
  //         "publicId": "...",
  //         "imageUrl": "..."
  //       },
  //       "outputImage": {
  //         "publicId": "...",
  //         "imageUrl": "...",
  //         "width": 2048,
  //         "height": 1536,
  //         "format": "png",
  //         "size": 445678
  //       },
  //       "coordinates": { "x": 512, "y": 384 }
  //     }
  //   }
  // 
  // Processing Time: 5-15 seconds
  // Backend: aiController.objectRemoval() -> Docker: object removal service
  // ============================================================
  async removeObject(publicId: string, x: number, y: number): Promise<{ response: Response; data: any }> {
    const token = await this.getToken();
    
    if (!token) {
      throw new Error('Authentication required. Please login first.');
    }

    // Validate coordinates
    if (typeof x !== 'number' || typeof y !== 'number' || x < 0 || y < 0) {
      throw new Error('Valid x and y coordinates are required (non-negative numbers)');
    }

    console.log('=== Object Removal API Call ===');
    console.log('Endpoint: POST /api/v1/adobe-ps/ai/object-removal');
    console.log('PublicId:', publicId);
    console.log('Coordinates:', { x, y });

    const response = await this.request('/ai/object-removal', {
      method: 'POST',
      body: JSON.stringify({
        publicId,
        x,
        y,
      }),
    });

    let data;
    try {
      data = await response.json();
      console.log('Object removal response:', data);
    } catch (error) {
      console.error('Failed to parse object removal response:', error);
      data = {
        success: false,
        message: response.statusText || 'Failed to remove object',
      };
    }

    return { response, data };
  }

  // ============================================================
  // RELIGHT
  // Adjust lighting/brightness of image using AI model
  // 
  // Endpoint: POST /api/v1/adobe-ps/ai/relight
  // 
  // Request Body:
  //   {
  //     "publicId": "adobe-ps-uploads/abc123xyz",
  //     "brightness": 1.5  // Range: 0.1 - 3.0, default: 0.5
  //   }
  // 
  // Success Response (200):
  //   {
  //     "success": true,
  //     "message": "Image relit successfully",
  //     "data": {
  //       "inputImage": {
  //         "publicId": "...",
  //         "imageUrl": "..."
  //       },
  //       "outputImage": {
  //         "publicId": "...",
  //         "imageUrl": "...",
  //         "width": 1920,
  //         "height": 1080,
  //         "format": "jpg",
  //         "size": 456789
  //       },
  //       "brightness": 1.5
  //     }
  //   }
  // 
  // Processing Time: 10-30 seconds
  // Backend: aiController.relight() -> Docker: relight service
  // ============================================================
  async relight(publicId: string, brightness: number = 0.5): Promise<{ response: Response; data: any }> {
    const token = await this.getToken();
    
    if (!token) {
      throw new Error('Authentication required. Please login first.');
    }

    // Validate brightness parameter
    if (brightness < 0.1 || brightness > 3.0) {
      throw new Error('Brightness must be between 0.1 and 3.0');
    }

    console.log('=== Relight API Call ===');
    console.log('Endpoint: POST /api/v1/adobe-ps/ai/relight');
    console.log('PublicId:', publicId);
    console.log('Brightness:', brightness);

    const response = await this.request('/ai/relight', {
      method: 'POST',
      body: JSON.stringify({
        publicId,
        brightness,
      }),
    });

    let data;
    try {
      const text = await response.text();
      if (text) {
        data = JSON.parse(text);
        console.log('Relight response:', data);
      } else {
        data = {
          success: false,
          message: 'Empty response from server',
        };
      }
    } catch (error) {
      console.error('Failed to parse relight response:', error);
      data = {
        success: false,
        message: response.statusText || 'Failed to relight image',
      };
    }

    return { response, data };
  }

  // ============================================================
  // FACE RESTORE
  // Restore facial details using AI model
  // 
  // Endpoint: POST /api/v1/adobe-ps/ai/face-restore
  // 
  // Request Body:
  //   {
  //     "publicId": "adobe-ps-uploads/abc123xyz",
  //     "fidelity": 0.7  // Range: 0 - 1, default: 0.7
  //   }
  // 
  // Success Response (200):
  //   {
  //     "success": true,
  //     "message": "Face restored successfully",
  //     "data": {
  //       "outputImage": {
  //         "publicId": "...",
  //         "imageUrl": "..."
  //       },
  //       "fidelity": 0.7
  //     }
  //   }
  // 
  // Processing Time: 10-30 seconds
  // Backend: aiController.faceRestore() -> Docker: face-restoration service
  // ============================================================
  async faceRestore(publicId: string, fidelity: number = 0.7): Promise<{ response: Response; data: any }> {
    const token = await this.getToken();
    
    if (!token) {
      throw new Error('Authentication required. Please login first.');
    }

    if (fidelity < 0 || fidelity > 1) {
      throw new Error('Fidelity must be between 0 and 1');
    }

    console.log('=== Face Restore API Call ===');
    console.log('PublicId:', publicId);
    console.log('Fidelity:', fidelity);

    const response = await this.request('/ai/face-restore', {
      method: 'POST',
      body: JSON.stringify({
        publicId,
        fidelity,
      }),
    });

    let data;
    try {
      data = await response.json();
      console.log('Face restore response:', data);
    } catch (error) {
      console.error('Failed to parse face restore response:', error);
      data = {
        success: false,
        message: response.statusText || 'Failed to restore face',
      };
    }

    return { response, data };
  }

  // ============================================================
  // STYLE TRANSFER
  // Apply artistic style from reference image to base image
  // Route: POST /api/v1/adobe-ps/ai/style-transfer
  // Backend: aiController.styleTransfer
  // Docker: style-transfer-service (sameer513/pca-style-transfer-fixed)
  // 
  // Parameters:
  //   - contentPublicId: Base image (first image) that will be styled
  //   - stylePublicId: Reference image (second image) that provides the style
  // 
  // Returns:
  //   - Styled image URL (style from reference applied to base)
  //   - Processing takes 30-90 seconds (Docker container processing)
  // ============================================================
  async styleTransfer(contentPublicId: string, stylePublicId: string): Promise<{ response: Response; data: any }> {
    const token = await this.getToken();
    
    if (!token) {
      throw new Error('Authentication required. Please login first.');
    }

    console.log('=== Style Transfer API Call ===');
    console.log('Content PublicId (Base Image):', contentPublicId);
    console.log('Style PublicId (Reference Image):', stylePublicId);

    // Call the style-transfer route in aiRoutes.js
    // This route calls aiController.styleTransfer which:
    // 1. Finds both images in database
    // 2. Ensures Docker container (style-transfer-service) is running
    // 3. Copies both images to container
    // 4. Runs style transfer AI model
    // 5. Copies result back from container
    // 6. Uploads to Cloudinary
    // 7. Saves to database
    // 8. Returns styled image URL
    const response = await this.request('/ai/style-transfer', {
      method: 'POST',
      body: JSON.stringify({
        contentPublicId, // Base image that will be styled
        stylePublicId,   // Reference image that provides the style
      }),
    });

    let data;
    try {
      data = await response.json();
      console.log('Style transfer response:', data);
    } catch (error) {
      console.error('Failed to parse style transfer response:', error);
      data = {
        success: false,
        message: response.statusText || 'Failed to transfer style',
      };
    }

    return { response, data };
  }

  // ============================================================
  // LAYER-BASED PROJECT MANAGEMENT API METHODS
  // ============================================================

  // Get all layer-based projects for user
  async getAllProjects(params?: {
    sort?: string;
    limit?: number;
    page?: number;
  }): Promise<{ response: Response; data: any }> {
    const token = await this.getToken();
    
    if (!token) {
      throw new Error('Authentication required. Please login first.');
    }

    // Build query string
    const queryParams = new URLSearchParams();
    if (params?.sort) queryParams.append('sort', params.sort);
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.page) queryParams.append('page', params.page.toString());
    
    const queryString = queryParams.toString();
    const endpoint = queryString ? `/projects?${queryString}` : '/projects';

    const response = await this.request(endpoint, {
      method: 'GET',
    });

    let data;
    try {
      data = await response.json();
      console.log('Get all projects response:', data);
    } catch (error) {
      console.error('Failed to parse get all projects response:', error);
      data = {
        success: false,
        message: response.statusText || 'Failed to get projects',
      };
    }

    return { response, data };
  }

  // Get project details by ID
  async getProjectDetails(projectId: string): Promise<{ response: Response; data: any }> {
    const token = await this.getToken();
    
    if (!token) {
      throw new Error('Authentication required. Please login first.');
    }

    const response = await this.request(`/projects/${projectId}`, {
      method: 'GET',
    });

    let data;
    try {
      data = await response.json();
      console.log('Get project details response:', data);
    } catch (error) {
      console.error('Failed to parse get project details response:', error);
      data = {
        success: false,
        message: response.statusText || 'Failed to get project details',
      };
    }

    return { response, data };
  }

  // Update project title
  async updateProjectTitle(projectId: string, title: string): Promise<{ response: Response; data: any }> {
    const token = await this.getToken();
    
    if (!token) {
      throw new Error('Authentication required. Please login first.');
    }

    const response = await this.request(`/projects/${projectId}/title`, {
      method: 'PATCH',
      body: JSON.stringify({ title }),
    });

    let data;
    try {
      data = await response.json();
      console.log('Update project title response:', data);
    } catch (error) {
      console.error('Failed to parse update project title response:', error);
      data = {
        success: false,
        message: response.statusText || 'Failed to update project title',
      };
    }

    return { response, data };
  }

  // Delete project
  async deleteProject(projectId: string): Promise<{ response: Response; data: any }> {
    const token = await this.getToken();
    
    if (!token) {
      throw new Error('Authentication required. Please login first.');
    }

    const response = await this.request(`/projects/${projectId}`, {
      method: 'DELETE',
    });

    // DELETE returns 204 No Content on success
    let data;
    if (response.status === 204) {
      data = {
        success: true,
        message: 'Project deleted successfully',
      };
    } else {
      try {
        data = await response.json();
      } catch (error) {
        data = {
          success: false,
          message: response.statusText || 'Failed to delete project',
        };
      }
    }

    return { response, data };
  }

  // ============================================================
  // AI PROJECT MANAGEMENT API METHODS
  // ============================================================

  // Get all AI sequential projects for user
  async getAllAIProjects(params?: {
    status?: 'active' | 'archived' | 'deleted';
  }): Promise<{ response: Response; data: any }> {
    const token = await this.getToken();
    
    if (!token) {
      throw new Error('Authentication required. Please login first.');
    }

    // Build query string
    const queryParams = new URLSearchParams();
    if (params?.status) queryParams.append('status', params.status);
    
    const queryString = queryParams.toString();
    const endpoint = queryString ? `/ai-projects?${queryString}` : '/ai-projects';

    const response = await this.request(endpoint, {
      method: 'GET',
    });

    let data;
    try {
      data = await response.json();
      console.log('Get all AI projects response:', data);
    } catch (error) {
      console.error('Failed to parse get all AI projects response:', error);
      data = {
        success: false,
        message: response.statusText || 'Failed to get AI projects',
      };
    }

    return { response, data };
  }

  // Get AI project details by ID
  async getAIProjectDetails(projectId: string): Promise<{ response: Response; data: any }> {
    const token = await this.getToken();
    
    if (!token) {
      throw new Error('Authentication required. Please login first.');
    }

    const response = await this.request(`/ai-projects/${projectId}`, {
      method: 'GET',
    });

    let data;
    try {
      data = await response.json();
      console.log('Get AI project details response:', data);
    } catch (error) {
      console.error('Failed to parse get AI project details response:', error);
      data = {
        success: false,
        message: response.statusText || 'Failed to get AI project details',
      };
    }

    return { response, data };
  }

  // Update AI project metadata
  async updateAIProject(
    projectId: string,
    updates: {
      title?: string;
      description?: string;
      status?: 'active' | 'archived' | 'deleted';
    }
  ): Promise<{ response: Response; data: any }> {
    const token = await this.getToken();
    
    if (!token) {
      throw new Error('Authentication required. Please login first.');
    }

    const response = await this.request(`/ai-projects/${projectId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });

    let data;
    try {
      data = await response.json();
      console.log('Update AI project response:', data);
    } catch (error) {
      console.error('Failed to parse update AI project response:', error);
      data = {
        success: false,
        message: response.statusText || 'Failed to update AI project',
      };
    }

    return { response, data };
  }

  // Delete AI project
  async deleteAIProject(projectId: string, permanent: boolean = false): Promise<{ response: Response; data: any }> {
    const token = await this.getToken();
    
    if (!token) {
      throw new Error('Authentication required. Please login first.');
    }

    const queryString = permanent ? '?permanent=true' : '';
    const response = await this.request(`/ai-projects/${projectId}${queryString}`, {
      method: 'DELETE',
    });

    // DELETE may return 204 No Content on success
    let data;
    if (response.status === 204) {
      data = {
        success: true,
        message: permanent ? 'Project permanently deleted' : 'Project moved to trash',
      };
    } else {
      try {
        data = await response.json();
      } catch (error) {
        data = {
          success: false,
          message: response.statusText || 'Failed to delete AI project',
        };
      }
    }

    return { response, data };
  }

  // Add operation to AI project
  async addAIProjectOperation(
    projectId: string,
    operationData: {
      operationType: string;
      prompt: any;
      inputImage: {
        imageUrl: string;
        publicId: string;
        width?: number;
        height?: number;
      };
      outputImage: {
        imageUrl: string;
        publicId: string;
        width?: number;
        height?: number;
      };
      processingTime?: number;
      status: 'completed' | 'failed';
      errorMessage?: string;
    }
  ): Promise<{ response: Response; data: any }> {
    const token = await this.getToken();
    
    if (!token) {
      throw new Error('Authentication required. Please login first.');
    }

    const response = await this.request(`/ai-projects/${projectId}/operations`, {
      method: 'POST',
      body: JSON.stringify(operationData),
    });

    let data;
    try {
      data = await response.json();
      console.log('Add AI project operation response:', data);
    } catch (error) {
      console.error('Failed to parse add operation response:', error);
      data = {
        success: false,
        message: response.statusText || 'Failed to add operation',
      };
    }

    return { response, data };
  }

  // Undo last operation in AI project
  async undoAIProjectOperation(projectId: string): Promise<{ response: Response; data: any }> {
    const token = await this.getToken();
    
    if (!token) {
      throw new Error('Authentication required. Please login first.');
    }

    const response = await this.request(`/ai-projects/${projectId}/undo`, {
      method: 'POST',
    });

    let data;
    try {
      data = await response.json();
      console.log('Undo AI project operation response:', data);
    } catch (error) {
      console.error('Failed to parse undo operation response:', error);
      data = {
        success: false,
        message: response.statusText || 'Failed to undo operation',
      };
    }

    return { response, data };
  }

  // Revert AI project to specific operation
  async revertAIProject(projectId: string, operationIndex: number): Promise<{ response: Response; data: any }> {
    const token = await this.getToken();
    
    if (!token) {
      throw new Error('Authentication required. Please login first.');
    }

    const response = await this.request(`/ai-projects/${projectId}/revert/${operationIndex}`, {
      method: 'POST',
    });

    let data;
    try {
      data = await response.json();
      console.log('Revert AI project response:', data);
    } catch (error) {
      console.error('Failed to parse revert response:', error);
      data = {
        success: false,
        message: response.statusText || 'Failed to revert project',
      };
    }

    return { response, data };
  }

  // ============================================================
  // GEMINI PROMPT PROCESSING
  // Process user text prompt with Gemini AI and automatically execute actions
  // 
  // Endpoint: POST /api/v1/adobe-ps/gemini/prompt
  // 
  // Request Body:
  //   {
  //     "publicId": "adobe-ps-uploads/abc123",
  //     "prompt": "enhance this image",
  //     "projectId": "project123",
  //     "projectType": "ai-sequential"
  //   }
  // 
  // Response:
  //   - If requiresInteraction: true (object removal) → returns message and inputImage
  //   - If automatic → returns processed image result
  // ============================================================
  async processGeminiPrompt(
    publicId: string,
    prompt: string,
    projectId?: string,
    projectType?: 'layer-based' | 'ai-sequential'
  ): Promise<{ response: Response; data: any }> {
    const token = await this.getToken();
    
    if (!token) {
      throw new Error('Authentication required. Please login first.');
    }

    if (!publicId) {
      throw new Error('Image publicId is required');
    }

    if (!prompt || prompt.trim().length === 0) {
      throw new Error('Prompt is required');
    }

    console.log('=== Gemini Prompt API Call ===');
    console.log('PublicId:', publicId);
    console.log('Prompt:', prompt);
    console.log('ProjectId:', projectId);
    console.log('ProjectType:', projectType);

    const requestBody: any = {
      publicId,
      prompt: prompt.trim(),
    };

    // Add projectId and projectType if provided
    if (projectId && projectType) {
      requestBody.projectId = projectId;
      requestBody.projectType = projectType;
    }

    const response = await this.request('/gemini/prompt', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    let data;
    try {
      data = await response.json();
      console.log('Gemini prompt response:', data);
    } catch (error) {
      console.error('Failed to parse Gemini prompt response:', error);
      data = {
        success: false,
        message: response.statusText || 'Failed to process prompt',
      };
    }

    return { response, data };
  }

  // Get AI project operation timeline
  async getAIProjectTimeline(projectId: string): Promise<{ response: Response; data: any }> {
    const token = await this.getToken();
    
    if (!token) {
      throw new Error('Authentication required. Please login first.');
    }

    const response = await this.request(`/ai-projects/${projectId}/timeline`, {
      method: 'GET',
    });

    let data;
    try {
      data = await response.json();
      console.log('Get AI project timeline response:', data);
    } catch (error) {
      console.error('Failed to parse timeline response:', error);
      data = {
        success: false,
        message: response.statusText || 'Failed to get timeline',
      };
    }

    return { response, data };
  }

  // ============================================================
  // AUTO-ENHANCEMENT
  // Analyze project layers and get AI recommendations for enhancements
  // 
  // Endpoint: POST /api/v1/adobe-ps/gemini/auto-enhance/:projectId
  // 
  // Response:
  //   {
  //     "success": true,
  //     "data": {
  //       "analysis": {
  //         "needs_enhancement": boolean,
  //         "enhancements": string[],
  //         "priority_order": string[],
  //         "overall_quality": "good" | "fair" | "poor",
  //         "detailed_analysis": { ... }
  //       },
  //       "recommendations": {
  //         "apply_in_order": string[],
  //         "total_steps": number,
  //         "enhancement_details": Array<{
  //           type: string,
  //           severity: string,
  //           needed: boolean
  //         }>
  //       }
  //     }
  //   }
  // ============================================================
  async autoEnhanceAnalysis(projectId: string): Promise<{ response: Response; data: any }> {
    const token = await this.getToken();
    
    if (!token) {
      throw new Error('Authentication required. Please login first.');
    }

    if (!projectId) {
      throw new Error('Project ID is required');
    }

    console.log('=== Auto-Enhancement Analysis API Call ===');
    console.log('ProjectId:', projectId);

    const response = await this.request(`/gemini/auto-enhance/${projectId}`, {
      method: 'POST',
    });

    let data;
    try {
      data = await response.json();
      console.log('Auto-enhance analysis response:', data);
    } catch (error) {
      console.error('Failed to parse auto-enhance response:', error);
      data = {
        success: false,
        message: response.statusText || 'Failed to analyze for enhancements',
      };
    }

    return { response, data };
  }

  // Apply enhancements sequentially
  // Endpoint: POST /api/v1/adobe-ps/gemini/apply-enhancements/:projectId
  async applyEnhancements(
    projectId: string,
    enhancementOrder: string[]
  ): Promise<{ response: Response; data: any }> {
    const token = await this.getToken();
    
    if (!token) {
      throw new Error('Authentication required. Please login first.');
    }

    if (!projectId) {
      throw new Error('Project ID is required');
    }

    if (!enhancementOrder || !Array.isArray(enhancementOrder) || enhancementOrder.length === 0) {
      throw new Error('Enhancement order array is required');
    }

    console.log('=== Apply Enhancements API Call ===');
    console.log('ProjectId:', projectId);
    console.log('Enhancement Order:', enhancementOrder);

    const response = await this.request(`/gemini/apply-enhancements/${projectId}`, {
      method: 'POST',
      body: JSON.stringify({
        enhancementOrder,
      }),
    });

    let data;
    try {
      data = await response.json();
      console.log('Apply enhancements response:', data);
    } catch (error) {
      console.error('Failed to parse apply enhancements response:', error);
      data = {
        success: false,
        message: response.statusText || 'Failed to apply enhancements',
      };
    }
    return { response, data };
  }

  // Replace background with harmonization
  // Endpoint: POST /api/v1/adobe-ps/ai/replace-background
  async replaceBackground(
    subjectImageUrl: string,
    backgroundImageUrl: string
  ): Promise<{ response: Response; data: any }> {
    const token = await this.getToken();
    
    if (!token) {
      throw new Error('Authentication required. Please login first.');
    }

    if (!subjectImageUrl || !backgroundImageUrl) {
      throw new Error('Both subject and background image URLs are required');
    }

    console.log('=== Replace Background API Call ===');
    console.log('Subject Image URL:', subjectImageUrl);
    console.log('Background Image URL:', backgroundImageUrl);

    const response = await this.request('/ai/replace-background', {
      method: 'POST',
      body: JSON.stringify({
        subjectImageUrl,
        backgroundImageUrl,
      }),
    });

    let data;
    try {
      data = await response.json();
      console.log('Replace background response:', data);
    } catch (error) {
      console.error('Failed to parse replace background response:', error);
      data = {
        success: false,
        message: response.statusText || 'Failed to replace background',
      };
    }
    return { response, data };
  }

  // ============================================================
  // LAYER MANAGEMENT API METHODS
  // ============================================================

  // Get all layers for a project
  async getProjectLayers(projectId: string): Promise<{ response: Response; data: any }> {
    const token = await this.getToken();
    
    if (!token) {
      throw new Error('Authentication required. Please login first.');
    }

    const response = await fetch(`${this.baseURL}/layers/project/${projectId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    let data;
    try {
      data = await response.json();
      console.log('Get project layers response:', data);
    } catch (error) {
      console.error('Failed to parse get project layers response:', error);
      data = {
        success: false,
        message: response.statusText || 'Failed to get project layers',
      };
    }

    return { response, data };
  }

  // Get single layer details
  async getLayer(layerId: string): Promise<{ response: Response; data: any }> {
    const token = await this.getToken();
    
    if (!token) {
      throw new Error('Authentication required. Please login first.');
    }

    const response = await fetch(`${this.baseURL}/layers/${layerId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    let data;
    try {
      data = await response.json();
      console.log('Get layer response:', data);
    } catch (error) {
      console.error('Failed to parse get layer response:', error);
      data = {
        success: false,
        message: response.statusText || 'Failed to get layer',
      };
    }

    return { response, data };
  }

  // Update layer properties
  async updateLayer(
    layerId: string,
    updates: {
      name?: string;
      visible?: boolean;
      locked?: boolean;
      opacity?: number;
      blendMode?: string;
      position?: { x: number; y: number };
      transformations?: {
        rotation?: number;
        scaleX?: number;
        scaleY?: number;
        flipX?: boolean;
        flipY?: boolean;
      };
      order?: number;
    }
  ): Promise<{ response: Response; data: any }> {
    const token = await this.getToken();
    
    if (!token) {
      throw new Error('Authentication required. Please login first.');
    }

    const response = await fetch(`${this.baseURL}/layers/${layerId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });

    let data;
    try {
      data = await response.json();
      console.log('Update layer response:', data);
    } catch (error) {
      console.error('Failed to parse update layer response:', error);
      data = {
        success: false,
        message: response.statusText || 'Failed to update layer',
      };
    }

    return { response, data };
  }

  // Reorder all layers in a project
  async reorderLayers(projectId: string, layerIds: string[]): Promise<{ response: Response; data: any }> {
    const token = await this.getToken();
    
    if (!token) {
      throw new Error('Authentication required. Please login first.');
    }

    if (!Array.isArray(layerIds) || layerIds.length === 0) {
      throw new Error('layerIds must be a non-empty array');
    }

    const response = await fetch(`${this.baseURL}/layers/project/${projectId}/reorder`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ layerIds }),
    });

    let data;
    try {
      data = await response.json();
      console.log('Reorder layers response:', data);
    } catch (error) {
      console.error('Failed to parse reorder layers response:', error);
      data = {
        success: false,
        message: response.statusText || 'Failed to reorder layers',
      };
    }

    return { response, data };
  }

  // Delete a layer
  async deleteLayer(layerId: string): Promise<{ response: Response; data: any }> {
    const token = await this.getToken();
    
    if (!token) {
      throw new Error('Authentication required. Please login first.');
    }

    const response = await fetch(`${this.baseURL}/layers/${layerId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    let data;
    if (response.status === 204 || response.status === 200) {
      data = {
        success: true,
        message: 'Layer deleted successfully',
      };
    } else {
      try {
        data = await response.json();
      } catch (error) {
        data = {
          success: false,
          message: response.statusText || 'Failed to delete layer',
        };
      }
    }

    return { response, data };
  }

  // Duplicate a layer
  async duplicateLayer(layerId: string): Promise<{ response: Response; data: any }> {
    const token = await this.getToken();
    
    if (!token) {
      throw new Error('Authentication required. Please login first.');
    }

    const response = await fetch(`${this.baseURL}/layers/${layerId}/duplicate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    let data;
    try {
      data = await response.json();
      console.log('Duplicate layer response:', data);
    } catch (error) {
      console.error('Failed to parse duplicate layer response:', error);
      data = {
        success: false,
        message: response.statusText || 'Failed to duplicate layer',
      };
    }

    return { response, data };
  }
}

// Export singleton instance
export default new ApiService();

