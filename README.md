# Arclight - Submission of Team 94

A complete image processing application featuring AI powered enhancement capabilities and layer based editing workflows, envisioned for 2030.

## Table of Contents

1. [Overview](#overview)
2. [System Requirements](#system-requirements)
3. [Installation](#installation)
4. [Configuration](#configuration)
5. [Running the Application](#running-the-application)
6. [Docker Containers](#docker-containers)
7. [AI Models and Compute Profile](#ai-models-and-compute-profile)
8. [Inference Guide](#inference-guide)
9. [API Reference](#api-reference)
10. [Project Structure](#project-structure)
11. [Troubleshooting](#troubleshooting)
12. [Citations](#citations)

## Overview

This backend powers an image editing application with two distinct editing workflows.

**AI Sequential Editing** enables chaining multiple AI operations on a single image with full history tracking and undo capability. Users can apply operations such as relight, denoise, face restoration, and style transfer in sequence.

**Layer Based Editing** provides a multi layer composition system similar to Adobe Photoshop. Users can work with multiple independent image layers, each with individual properties including opacity, blend modes, and transformations.

**AI Auto Enhancement** leverages Google Gemini AI to intelligently analyze composite canvases and recommend enhancement priorities. The system automatically detects which enhancements are needed and suggests the optimal application order.

---

## Note

This README provides a consolidated overview of the project setup and usage. For detailed documentation, please refer to the following resources available in this repository.

| Document | Location | Description |
|----------|----------|-------------|
| Backend Documentation | `backend/README.md` | Detailed API documentation, database schemas, and server configuration |
| Frontend Documentation | `frontend/README.md` | React Native setup, component architecture, and UI guidelines |
| Frontend-Backend Report | `Documentation/Frontend_Backend_Report_Team94.pdf` | Comprehensive technical report covering frontend and backend architecture |
| Design & AI Report | `Documentation/Design_AI_Report_Team94` | Comprehensive design and AI report with pipeline workflows |

---
## Demo Video

A detailed demonstration video is available, showcasing the complete feature set, workflows, and overall user experience of the application.  
You can watch the demo using the link below:

**Google Drive Link:**  
https://drive.google.com/file/d/1VY3GP7fmDuoLLP7Q7UgQ60c2IofsqpPC/view?usp=sharing

---
## System Requirements

Before installation, ensure your system meets the following requirements.

A computer running Windows, macOS, or Linux with at least 10GB of free disk space for Docker images. An active internet connection is required for downloading dependencies and Docker images. Basic familiarity with terminal or command prompt operations is assumed.

## Installation

### Node.js

Node.js is the runtime environment required to execute the backend server.

1. Navigate to https://nodejs.org/ and download the LTS version
2. Execute the installer and complete the installation wizard
3. Verify the installation by opening a terminal and running `node --version` and `npm --version`

### MongoDB

MongoDB serves as the database for storing user data, projects, and image metadata.

**Cloud Installation (MongoDB Atlas)**

1. Navigate to https://www.mongodb.com/cloud/atlas and create a free account
2. Create a free tier cluster
3. Create a database user and record the credentials
4. Obtain the connection string in the format `mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/`

**Local Installation**

1. Download MongoDB Community Edition from https://www.mongodb.com/try/download/community
2. Install and start the MongoDB service
3. The default connection string is `mongodb://localhost:27017`

### Docker Desktop

Docker is required to run the AI model containers.

1. Download Docker Desktop from https://www.docker.com/products/docker-desktop/
2. Install the application (installation may require 10 to 15 minutes)
3. Restart your computer after installation
4. Launch Docker Desktop and wait for the service to initialize

### Expo Go (Mobile Testing)

Expo Go enables testing the React Native frontend on physical devices.

1. Install Expo Go from the Google Play Store (Android) or App Store (iOS)
2. Keep the application installed for later use during development

### Backend Dependencies

1. Open a terminal and navigate to the backend directory: `cd backend`
2. Execute `npm install` to install all required packages
3. Wait for the installation to complete (typically 2 to 5 minutes)

### Frontend Dependencies

1. Open a new terminal and navigate to the frontend directory: `cd frontend`
2. Execute `npm install` to install all required packages
3. Wait for the installation to complete (typically 5 to 10 minutes)

## Configuration

### Backend Environment Variables

Create or modify the `.env` file in the backend directory with the following configuration.

```
NODE_ENV=development
PORT=4000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_random_secret_key
JWT_EXPIRES_IN=30d
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
GEMINI_API_KEY=your_gemini_api_key
```

**Obtaining API Keys**

| Service | Source |
|---------|--------|
| MongoDB | MongoDB Atlas Dashboard at mongodb.com/cloud/atlas |
| Cloudinary | Cloudinary Console at cloudinary.com/console |
| Gemini AI | Google AI Studio at makersuite.google.com/app/apikey |
| JWT Secret | Any random string generator such as randomkeygen.com |

### Frontend API URL Configuration

1. Determine your computer's IP address by running `ipconfig` (Windows) or `ifconfig` (macOS/Linux)
2. Open `frontend/constants/api.ts`
3. Update the API URL with your IP address

```typescript
const DEFAULT_DEVELOPMENT_API_URL = 'http://YOUR_IP_ADDRESS:4000/api/v1/adobe-ps';
const ANDROID_EMULATOR_API_URL = 'http://YOUR_IP_ADDRESS:4000/api/v1/adobe-ps';
```

For Android Emulator, use `http://10.0.2.2:4000/api/v1/adobe-ps`. For iOS Simulator, use `http://localhost:4000/api/v1/adobe-ps`. For physical devices, ensure both the device and computer are connected to the same WiFi network.

## Running the Application

### Starting the Backend Server

1. Open a terminal and navigate to the backend directory
2. Execute `npm start`
3. Verify the output displays "Server running on port 4000" and "Database connected successfully"
4. Keep this terminal window open

### Starting the Frontend Server

1. Open a new terminal and navigate to the frontend directory
2. Execute `npm start` or `expo start`
3. A QR code will appear in the terminal

### Running on Physical Devices

1. Ensure your phone and computer are on the same WiFi network
2. Open the Expo Go application on your phone
3. Scan the QR code displayed in the terminal
4. The application will load on your device

### Running on Emulators

For Android Emulator, press `a` in the Expo terminal. For iOS Simulator (macOS only), press `i` in the Expo terminal. For web browser, press `w` in the Expo terminal.

## Docker Containers

The application requires eight Docker containers for AI image processing operations.

### Container Reference

| Container Name | Docker Image | Purpose |
|----------------|--------------|---------|
| lowlight-service | sameer513/lowlight-cpu-bullseye | Low light image enhancement |
| codeformer-service | sameer513/codeformer_app | Face restoration |
| nafnet-service | sameer513/nafnet-image | Denoise and deblur |
| style-transfer-service | sameer513/pca-style-transfer-fixed | Artistic style transfer |
| background-removal-service | sameer513/u2net-inference | Background removal |
| pct-net-service | sameer513/pct-net-final | Background harmonization |
| object-masking-service | sameer513/sam-cpu-final | Object segmentation |
| object-remover-service | sameer513/better-lama | Object inpainting |

Verify all containers are running by executing `docker ps`. Eight containers should be listed with status "Up".

## AI Models and Compute Profile

| Metric | CodeFormer | LaMa | U²-Net | SAM (ViT-B) | PCA-KD | LYT-Net | NAFNet-width64 | PCT-Net ViT |
|--------|------------|------|--------|-------------|--------|---------|----------------|-------------|
| **Task** | Face Restoration | Image Inpainting | Salient Object Segmentation | Promptable Segmentation | Style Transfer | Low-Light Enhancement | Image Denoise/Deblur | Image Harmonization |
| | | | | | | | | |
| **PARAMETERS** | | | | | | | | |
| Total | 94.11M | 51.06M | 44.0M (main) / 1.13M (lite) | 93.74M | 72.84K | 44.92K | 67.89M | 4.81M |
| | | | | | | | | |
| **MODEL SIZE** | | | | | | | | |
| Checkpoint | 376.64 MB | 410.05 MB | 167.8 MB / 4.7 MB (lite) | 357 MB | 0.29 MB | 0.20 MB | 258.98 MB | 18.39 MB |
| | | | | | | | | |
| **INPUT/OUTPUT** | | | | | | | | |
| Input Resolution | 512×512 (FIXED) | Variable + Mask | Variable (opt 320×320) | Variable → 1024 | Variable (÷32) | Variable | Variable | Variable (composite + mask) |
| Output Resolution | 512×512×3 | Same as input | Same (1 channel) | 3 masks @ input res | Same as input | Same as input | Same as input | Same as input |
| | | | | | | | | |
| **CPU INFERENCE** | | | | | | | | |
| Latency (256×256) | - | - | ~200 ms | 9,009 ms | **65.67 ms** | 245.06 ms | 2,013.88 ms | 126 ms |
| Latency (512×512) | 4,761 ms | 2,437 ms | ~600 ms | 9,009 ms | **95.58 ms** | 1,006.31 ms | 8,975.93 ms | 356 ms |
| Latency (Native) | 4,761 ms @512 | 2,437 ms @512 | ~600 ms @320 | 9,009 ms @1024 | 65.67 ms @256 | 245.06 ms @256 | 2,013.88 ms @256 | 659 ms @512 |
| Throughput (FPS) | 0.21 | 0.41 | ~1.5 | 0.11 | **15.23** | 4.08 | 0.50 | 2.4 |
| | | | | | | | | |
| **GPU INFERENCE** | | | | | | | | |
| GPU Latency (mean) | 70 ms (V100) | ~50-100 ms | 19.73 ms | ~50 ms (A100) | 40 ms (GTX 1080) | 2.3 ms | 8.4% SOTA cost | 25.68 ms |
| | | | | | | | | |
| **ACCURACY** | | | | | | | | |
| Benchmark Dataset | CelebA-Test | Places2 | DUTS-TE | SA-1B (23 datasets) | COCO | LOLv1 | GoPro / SIDD | iHarmony4 |
| | | | | | | | | |
| **ARCHITECTURE** | | | | | | | | |
| Type | Transformer + VQGAN | FFT-based CNN | Nested U-Net | Vision Transformer | Distilled CNN | YUV Transformer | UNet + NAFBlocks | Vision Transformer |
| | | | | | | | | |
| **EFFICIENCY** | | | | | | | | |
| FLOPs/GMACs | ~100 GFLOPs | ~50 GFLOPs | ~30 GFLOPs | ~180 GFLOPs | 0.72% of WCT2 | 3.49 GFLOPs | 1.1-65 GMACs | ~10 GFLOPs |
| Speed Rank (CPU) | 7th | 5th | 3rd | 8th (slowest) | **1st (fastest)** | 2nd | 4th | 5th |
| | | | | | | | | |
| **TRAINING DATA** | | | | | | | | |
| Dataset | FFHQ | Places2 | DUTS-TR | SA-1B (11M images) | COCO | LOL | GoPro/SIDD | iHarmony4 |
| | | | | | | | | |
| **VARIANTS** | | | | | | | | |
| Available | CodeFormer | LaMa | U²-Net, U²-Net-lite | ViT-B, ViT-L, ViT-H | MobileNet, VGG | LYT | width32, width64, SIDD | ViT_pct, CNN_pct, sym, polynomial, identity, mul, add |
| Tested Variant | Base | Big-LaMa | Full | ViT-B (93.74M) | MobileNet (72.84K) | Base (44.92K) | width64 (67.89M) | ViT_pct (4.81M) |

---
`-` means that data couldn't be computed of models at the metric.



### CPU Performance at 512x512 Resolution

| Model | Latency | FPS |
|-------|---------|-----|
| PCA-KD | 95.58 ms | 10.46 |
| PCT-Net | 356 ms | 2.81 |
| U2Net | 600 ms | 1.67 |
| LYT-Net | 1,006.31 ms | 0.99 |
| LaMa | 2,437 ms | 0.41 |
| CodeFormer | 4,761 ms | 0.21 |
| NAFNet | 8,975.93 ms | 0.11 |
| SAM | 9,009 ms | 0.11 |

### Model Size Rankings (Smallest to Largest)

| Rank | Model | Parameters | Checkpoint |
|------|-------|------------|------------|
| 1 | LYT-Net | 44.92K | 0.20 MB |
| 2 | PCA-KD | 72.84K | 0.29 MB |
| 3 | U2Net-lite | 1.13M | 4.7 MB |
| 4 | PCT-Net ViT | 4.81M | 18.39 MB |
| 5 | U2Net | 44.0M | 167.8 MB |
| 6 | LaMa | 51.06M | 410.05 MB |
| 7 | NAFNet | 67.89M | 258.98 MB |
| 8 | SAM | 93.74M | 357 MB |
| 9 | CodeFormer | 94.11M | 376.64 MB |

### Key Observations

LYT-Net and PCA-KD are approximately 1000 times smaller than the larger models. PCA-KD achieves the fastest CPU inference at 15.23 FPS at 256x256 resolution, which is 10 times faster than the next best performer. CodeFormer is the only model with a fixed input resolution requirement of 512x512. SAM is a foundation model trained on 1.1 billion masks with zero-shot capability. PCA-KD and PCT-Net are viable for interactive real-time use cases.

## Inference Guide

### NAFNet (Denoising and Deblurring)

```
docker pull sameer513/nafnet-image
docker run -it sameer513/nafnet-image
```

Inside the container:
```
export PYTHONPATH=/app:$PYTHONPATH

# For denoising
python basicsr/demo.py \
  -opt options/test/SIDD/NAFNet-width64.yml \
  --input_path ./demo/input.png \
  --output_path ./demo/denoised_output.png

# For deblurring
python basicsr/demo.py \
  -opt options/test/REDS/NAFNet-width64.yml \
  --input_path ./demo/input.jpg \
  --output_path ./demo/deblurred_output.png
```

Copy output: `docker cp nafnet:/app/demo/denoised_output.png ./output/`

### PCA-KD (Style Transfer)

```
docker pull sameer513/pca-style-transfer-fixed
docker run -it sameer513/pca-style-transfer-fixed
```

Copy input images:
```
docker cp content_image.jpg pca-style:/app/figures/content/
docker cp style_image.jpg pca-style:/app/figures/style/
```

Inside the container:
```
python demo.py \
  --content figures/content/content_image.jpg \
  --style figures/style/style_image.jpg
```

Copy output: `docker cp pca-style:/app/results/output.jpg ./output/`

### CodeFormer (Face Restoration)

Input images are processed at 512x512 resolution.

```
docker pull sameer513/codeformer_app
docker run -it sameer513/codeformer_app
```

Copy input: `docker cp face_image.jpg codeformer:/cf/input/`

Inside the container:
```
cd /cf/CodeFormer
python inference_codeformer.py \
  --w 0.7 \
  --test_path /cf/input \
  --face_upsample \
  --has_aligned
```

The `--w` parameter controls fidelity weight (0.0 to 1.0). Higher values produce output more faithful to the input while lower values apply more enhancement.

Copy output: `docker cp codeformer:/cf/output/input_0.7/final_results ./output/`

### U2Net (Background Removal)

```
docker pull sameer513/u2net-inference
docker run -it sameer513/u2net-inference
```

Copy input: `docker cp image.jpg u2net:/app/samples/`

Inside the container:
```
# General background removal
python app.py \
  samples/image.jpg \
  samples/output.png \
  models/u2net.onnx

# Human segmentation
python app.py \
  samples/image.jpg \
  samples/output.png \
  models/u2net_human_seg.onnx
```

Copy output: `docker cp u2net:/app/samples/output.png ./output/`

### SAM (Segment Anything Model)

```
docker pull sameer513/sam-cpu-final
docker run -it sameer513/sam-cpu-final
```

Copy input: `docker cp image.jpg sam:/app/`

Inside the container:
```
python sam_inference.py \
  --image image.jpg \
  --point 500,300 \
  --output mask.png \
  --checkpoint sam_vit_b_01ec64.pth

# Optional mask dilation
python dialate.py \
  --mask mask.png \
  --kernel 7 \
  --iter 2 \
  --out dilated_mask.png
```

Copy output: `docker cp sam:/app/dilated_mask.png ./output/`

### LaMa (Image Inpainting)

```
docker pull sameer513/better-lama
docker run -it sameer513/better-lama
```

Copy inputs:
```
docker cp image.jpg lama:/app/input/
docker cp mask.png lama:/app/input/
```

Inside the container:
```
python simple_infer.py \
  --model /app/models/big-lama \
  --image /app/input/image.jpg \
  --mask /app/input/mask.png \
  --out /app/output/result.png \
  --dilate 15
```

Copy output: `docker cp lama:/app/output/result.png ./output/`

### LYT-Net (Low Light Enhancement)

```
docker pull sameer513/lowlight-cpu-bullseye
docker run -it sameer513/lowlight-cpu-bullseye
```

Copy input: `docker cp dark_image.jpg lytnet:/app/`

Inside the container:
```
python infer.py \
  --weights best_model_LOLv1.pth \
  --input dark_image.jpg \
  --output output.jpg \
  --brightness 0.5
```

Copy output: `docker cp lytnet:/app/output.jpg ./output/`

### PCT-Net (Image Harmonization)

```
docker pull sameer513/pct-net-final
docker run -it sameer513/pct-net-final
```

Copy inputs:
```
docker cp composite.jpg pctnet:/workspace/examples/composites/
docker cp mask.png pctnet:/workspace/examples/composites/
```

Inside the container:
```
python3 run_inference.py \
  --image /workspace/examples/composites/composite.jpg \
  --mask /workspace/examples/composites/mask.png \
  --weights pretrained_models/PCTNet_ViT.pth \
  --model_type ViT_pct \
  --out /workspace/examples/composites/output.jpg
```

Copy output: `docker cp pctnet:/workspace/examples/composites/output.jpg ./output/`

## API Reference

### Base URL

```
http://localhost:4000/api/v1/adobe-ps
```

All protected routes require a JWT token in the Authorization header: `Authorization: Bearer YOUR_JWT_TOKEN`

### Authentication Routes

**POST /auth/signup** creates a new user account.

Request body:
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123"
}
```

**POST /auth/login** authenticates a user and returns a JWT token.

Request body:
```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

**POST /auth/verify-otp** verifies the OTP sent during signup.

**POST /auth/resend-otp** resends the OTP to the user's email.

**POST /auth/google** authenticates via Google OAuth.

**GET /auth/logout** terminates the user session.

### Layer Based Project Routes

**POST /projects/create** creates a new layer based project.

Request body:
```json
{
  "title": "My Design Project",
  "canvas": {
    "width": 1920,
    "height": 1080,
    "backgroundColor": "#ffffff"
  }
}
```

### Gemini AI Routes

**POST /gemini/interpret** interprets user commands using Gemini AI.

**POST /gemini/auto-enhance/:projectId** analyzes a project and recommends enhancements.

**POST /gemini/apply-enhancements/:projectId** applies recommended enhancements sequentially.

### Settings Routes

**GET /settings** retrieves user settings.

**PATCH /settings/max-versions** updates the maximum versions limit (1 to 15).

## Project Structure

```
Inter-IIT-tech-Adobe-PS/
    backend/
        .env
        package.json
        server.js
    frontend/
        constants/
            api.ts
        package.json
    README.md
```

## Troubleshooting

### Connection Issues

If the frontend cannot connect to the backend, verify that the backend server is running on port 4000. Confirm that the API URL in `frontend/constants/api.ts` matches your IP address. Ensure both devices are on the same WiFi network. Consider temporarily disabling the firewall for testing.

### Database Issues

If MongoDB connection fails, verify the `MONGODB_URI` in the backend `.env` file. For MongoDB Atlas, ensure your IP address is whitelisted. For local MongoDB, confirm the service is running.

### Docker Issues

If containers are not found, verify Docker Desktop is running. List all containers with `docker ps -a`. Start stopped containers with `docker start container-name`.

### Dependency Issues

If npm install fails, verify Node.js is installed correctly. Delete the `node_modules` folder and `package-lock.json`, then run `npm install` again.

### AI Operation Issues

If AI operations are not working, verify all eight Docker containers are running with `docker ps`. Check backend logs for specific errors. Confirm the `GEMINI_API_KEY` is set in the `.env` file.

### Useful Commands

```
# List running containers
docker ps

# List all containers
docker ps -a

# Start a container
docker start container-name

# Stop a container
docker stop container-name

# View container logs
docker logs container-name

# Enter a running container
docker exec -it container-name bash
```
---
## GitHub Repositories for Incorporated Models

| Model | Original Repository |
|-------|---------------------|
| NAFNet | [github.com/megvii-research/NAFNet](https://github.com/megvii-research/NAFNet) |
| PCA-KD | [github.com/chiutaiyin/PCA-Knowledge-Distillation](https://github.com/chiutaiyin/PCA-Knowledge-Distillation) |
| CodeFormer | [github.com/sczhou/CodeFormer](https://github.com/sczhou/CodeFormer) |
| U²-Net | [github.com/xuebinqin/U-2-Net](https://github.com/xuebinqin/U-2-Net) |
| SAM | [github.com/facebookresearch/segment-anything](https://github.com/facebookresearch/segment-anything) |
| LaMa | [github.com/advimman/lama](https://github.com/advimman/lama) |
| LYT-Net | [github.com/albrateanu/LYT-Net](https://github.com/albrateanu/LYT-Net) |
| PCT-Net | [https://github.com/rakutentech/PCT-Net-Image-Harmonization](https://github.com/rakutentech/PCT-Net-Image-Harmonization) |
---

## Citations

If you use this project or any of the integrated models in your research, please cite the appropriate papers.

### NAFNet

```bibtex
@article{chen2022simple,
  title={Simple Baselines for Image Restoration},
  author={Chen, Liangyu and Chu, Xiaojie and Zhang, Xiangyu and Sun, Jian},
  journal={arXiv preprint arXiv:2204.04676},
  year={2022}
}
```

### LYT-Net

```bibtex
@article{brateanu2025lyt,
  author={Brateanu, Alexandru and Balmez, Raul and Avram, Adrian and Orhei, Ciprian and Ancuti, Cosmin},
  journal={IEEE Signal Processing Letters},
  title={LYT-NET: Lightweight YUV Transformer-based Network for Low-light Image Enhancement},
  year={2025},
  volume={},
  number={},
  pages={1-5},
  doi={10.1109/LSP.2025.3563125}
}
```

```bibtex
@article{brateanu2024lyt,
  title={LYT-Net: Lightweight YUV Transformer-based Network for Low-Light Image Enhancement},
  author={Brateanu, Alexandru and Balmez, Raul and Avram, Adrian and Orhei, Ciprian and Cosmin, Ancuti},
  journal={arXiv preprint arXiv:2401.15204},
  year={2024}
}
```

### U2Net

```bibtex
@InProceedings{Qin_2020_PR,
  title={U2-Net: Going Deeper with Nested U-Structure for Salient Object Detection},
  author={Qin, Xuebin and Zhang, Zichen and Huang, Chenyang and Dehghan, Masood and Zaiane, Osmar and Jagersand, Martin},
  journal={Pattern Recognition},
  volume={106},
  pages={107404},
  year={2020}
}
```

### CodeFormer

```bibtex
@inproceedings{zhou2022codeformer,
  author={Zhou, Shangchen and Chan, Kelvin C.K. and Li, Chongyi and Loy, Chen Change},
  title={Towards Robust Blind Face Restoration with Codebook Lookup TransFormer},
  booktitle={NeurIPS},
  year={2022}
}
```

```bibtex
@misc{basicsr,
  author={Xintao Wang and Liangbin Xie and Ke Yu and Kelvin C.K. Chan and Chen Change Loy and Chao Dong},
  title={{BasicSR}: Open Source Image and Video Restoration Toolbox},
  howpublished={\url{https://github.com/XPixelGroup/BasicSR}},
  year={2022}
}
```

### LaMa

```bibtex
@article{suvorov2021resolution,
  title={Resolution-robust Large Mask Inpainting with Fourier Convolutions},
  author={Suvorov, Roman and Logacheva, Elizaveta and Mashikhin, Anton and Remizova, Anastasia and Ashukha, Arsenii and Silvestrov, Aleksei and Kong, Naejin and Goka, Harshith and Park, Kiwoong and Lempitsky, Victor},
  journal={arXiv preprint arXiv:2109.07161},
  year={2021}
}
```

### SAM

```bibtex
@article{kirillov2023segany,
  title={Segment Anything},
  author={Kirillov, Alexander and Mintun, Eric and Ravi, Nikhila and Mao, Hanzi and Rolland, Chloe and Gustafson, Laura and Xiao, Tete and Whitehead, Spencer and Berg, Alexander C. and Lo, Wan-Yen and Doll{\'a}r, Piotr and Girshick, Ross},
  journal={arXiv:2304.02643},
  year={2023}
}
```

### PCA-KD (PhotoWCT2)

```bibtex
@InProceedings{Chiu_2022_CVPR,
  author={Chiu, Tai-Yin and Gurari, Danna},
  title={PCA-Based Knowledge Distillation Towards Lightweight and Content-Style Balanced Photorealistic Style Transfer Models},
  booktitle={Proceedings of the IEEE/CVF Conference on Computer Vision and Pattern Recognition (CVPR)},
  month={June},
  year={2022},
  pages={7844-7853}
}
```

### PCT-Net

```bibtex
@InProceedings{Guerreiro_2023_CVPR,
  author={Guerreiro, Julian Jorge Andrade and Nakazawa, Mitsuru and Stenger, Bj\"orn},
  title={PCT-Net: Full Resolution Image Harmonization Using Pixel-Wise Color Transformations},
  booktitle={Proceedings of the IEEE/CVF Conference on Computer Vision and Pattern Recognition (CVPR)},
  month={June},
  year={2023},
  pages={5917-5926}
}
```
