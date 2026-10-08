# FaceSort 📸✨

**FaceSort** is an AI-powered, browser-native web application that automatically organizes mixed photo albums into person-specific folders using facial recognition neural networks (`face-api.js` + WebGL).

> **100% Client-Side Privacy**: Photos are never uploaded to any external server. Neural network face detection, landmark alignment, 128-dimensional vector clustering, and ZIP archiving all execute locally inside your browser.

---

## 🚀 Features

- **One-Click Folder Selection**: Select a folder containing 50+ or 100+ photos (`.jpg`, `.jpeg`, `.png`, `.webp`) or drag-and-drop a folder directly.
- **Client-Side Face Detection**: Powered by SSD MobileNet V1 and 68-point facial landmarks. Automatically filters blurry or tiny faces (< 60px).
- **Fast Resizing**: Photos are downscaled to max 800px on off-screen canvases during AI inference to prevent browser freezing or memory limits. Original photos are preserved untouched.
- **Multi-Person Duplication**: Photos containing multiple recognized individuals are cleanly copied to each appearing person's folder.
- **No Face Detection**: Scenery, pets, food, or landscape photos with zero detected faces are grouped into a dedicated `No Face` folder.
- **Dynamic Threshold Slider**: Adjust sensitivity between `0.40` (stricter, more groups) and `0.60` (looser, more merged) with real-time re-clustering on cached 128-d descriptors.
- **Interactive Person Cards**:
  - Cropped avatar face previews.
  - Inline folder renaming (e.g. `Person 1` $\rightarrow$ `Rahul`).
  - Photo gallery inspector with full-size preview.
  - Reassign photos to any other person or `No Face`.
  - Merge two split groups together.
- **Structured ZIP Export**: Downloads a clean archive (`FaceSort_Organized_Photos.zip`) with sanitized folder paths containing your original photos.

---

## 🛠️ Quick Start

### 1. Requirements
- Node.js (v18 or higher)
- Modern web browser (Chrome, Edge, Firefox, Safari) with WebGL enabled

### 2. Start the Development Server
```bash
npm run dev
```
Open your browser at [http://localhost:5173](http://localhost:5173).

### 3. (Optional) Re-download AI Model Weights
Model weights are already saved in `/public/models/`. If you ever need to re-download them:
```bash
npm run download-models
```

### 4. Build for Production
```bash
npm run build
npm run preview
```

---

## 📂 Project Structure

```text
Face Folder/
├── public/
│   └── models/                      # Offline face-api weights (~12MB total)
│       ├── ssd_mobilenetv1_model*
│       ├── face_landmark_68_model*
│       └── face_recognition_model*
├── scripts/
│   ├── download-models.js           # Fetch script for model files
│   └── test-cluster.js              # Unit tests for clustering engine
├── src/
│   ├── components/
│   │   ├── Header.jsx               # Navigation bar & privacy indicator
│   │   ├── DropZone.jsx             # Folder & file dropzone with crawler
│   │   ├── ProgressBar.jsx          # Live scanning ticker & progress bar
│   │   ├── ThresholdSlider.jsx      # Real-time grouping sensitivity slider
│   │   ├── PersonCard.jsx           # Person card with cropped avatar & rename
│   │   ├── PersonModal.jsx          # Gallery viewer & photo reassignment
│   │   └── MergeModal.jsx           # Two-person merge confirmation dialog
│   ├── utils/
│   │   ├── imageUtils.js            # Image loading, downscaling & face cropping
│   │   ├── faceDetector.js          # face-api initialization & detection
│   │   ├── clusterEngine.js         # Euclidean distance & centroid clustering
│   │   └── zipExporter.js           # JSZip folder builder & FileSaver
│   ├── App.jsx                      # Primary state machine & coordinator
│   ├── App.css                      # Modern dark glassmorphic styling
│   ├── index.css                    # Design tokens & typography
│   └── main.jsx                     # React DOM entrypoint
├── package.json
└── vite.config.js
```
