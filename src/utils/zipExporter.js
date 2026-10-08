import JSZip from 'jszip';
import { saveAs } from 'file-saver';

/**
 * Sanitizes folder names for operating systems (Windows/Mac/Linux)
 * @param {string} name 
 * @returns {string}
 */
function sanitizeFolderName(name) {
  if (!name || typeof name !== 'string') return 'Unnamed_Person';
  return name
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .trim()
    .slice(0, 100) || 'Person';
}

/**
 * Generates and downloads a ZIP file containing organized folders.
 * 
 * @param {Array<object>} persons Array of person cluster objects
 * @param {Array<object>} blurPhotos Photos with unmatched/blurry faces
 * @param {Array<object>} noFacePhotos Photos without detected faces
 * @param {Function} [onProgress] Progress callback (0 - 100, statusText)
 * @returns {Promise<void>}
 */
export async function downloadOrganizedZip(persons, blurPhotos, noFacePhotos, onProgress = () => {}) {
  const zip = new JSZip();

  // Keep track of folder names to avoid naming collisions
  const usedFolderNames = new Map();

  // 1. Add Person Folders
  for (const person of persons) {
    let folderName = sanitizeFolderName(person.name);
    if (usedFolderNames.has(folderName)) {
      const count = usedFolderNames.get(folderName) + 1;
      usedFolderNames.set(folderName, count);
      folderName = `${folderName}_${count}`;
    } else {
      usedFolderNames.set(folderName, 1);
    }

    const folder = zip.folder(folderName);
    const existingFileNames = new Set();

    for (const photo of person.photos) {
      let fileName = photo.name || photo.file?.name || 'photo.jpg';
      if (existingFileNames.has(fileName)) {
        const extIndex = fileName.lastIndexOf('.');
        const baseName = extIndex !== -1 ? fileName.slice(0, extIndex) : fileName;
        const ext = extIndex !== -1 ? fileName.slice(extIndex) : '';
        let counter = 1;
        while (existingFileNames.has(`${baseName}_${counter}${ext}`)) {
          counter++;
        }
        fileName = `${baseName}_${counter}${ext}`;
      }
      existingFileNames.add(fileName);

      // Add untouched raw File/Blob
      folder.file(fileName, photo.file);
    }
  }

  // 2. Add "Blur" Folder if photos exist
  if (blurPhotos && blurPhotos.length > 0) {
    const blurFolder = zip.folder('Blur');
    const existingFileNames = new Set();

    for (const photo of blurPhotos) {
      let fileName = photo.name || photo.file?.name || 'photo.jpg';
      if (existingFileNames.has(fileName)) {
        const extIndex = fileName.lastIndexOf('.');
        const baseName = extIndex !== -1 ? fileName.slice(0, extIndex) : fileName;
        const ext = extIndex !== -1 ? fileName.slice(extIndex) : '';
        let counter = 1;
        while (existingFileNames.has(`${baseName}_${counter}${ext}`)) {
          counter++;
        }
        fileName = `${baseName}_${counter}${ext}`;
      }
      existingFileNames.add(fileName);

      blurFolder.file(fileName, photo.file);
    }
  }

  // 3. Add "No Face" Folder if photos exist
  if (noFacePhotos && noFacePhotos.length > 0) {
    const noFaceFolder = zip.folder('No Face');
    const existingFileNames = new Set();

    for (const photo of noFacePhotos) {
      let fileName = photo.name || photo.file?.name || 'photo.jpg';
      if (existingFileNames.has(fileName)) {
        const extIndex = fileName.lastIndexOf('.');
        const baseName = extIndex !== -1 ? fileName.slice(0, extIndex) : fileName;
        const ext = extIndex !== -1 ? fileName.slice(extIndex) : '';
        let counter = 1;
        while (existingFileNames.has(`${baseName}_${counter}${ext}`)) {
          counter++;
        }
        fileName = `${baseName}_${counter}${ext}`;
      }
      existingFileNames.add(fileName);

      noFaceFolder.file(fileName, photo.file);
    }
  }

  onProgress(10, 'Compacting files into ZIP...');

  // 3. Generate ZIP stream with progress reporting
  const content = await zip.generateAsync(
    {
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 4 } // balanced speed & compression
    },
    (metadata) => {
      const percent = Math.round(10 + metadata.percent * 0.9);
      onProgress(percent, `Packaging ZIP: ${metadata.percent.toFixed(0)}% (${metadata.currentFile || 'creating archive'})`);
    }
  );

  onProgress(100, 'Saving download...');
  const timestamp = new Date().toISOString().slice(0, 10);
  saveAs(content, `FaceSort_Organized_Photos_${timestamp}.zip`);
}
