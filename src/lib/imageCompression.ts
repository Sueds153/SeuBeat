/**
 * Utility to compress client-side images before saving to sessionStorage/localStorage or sending to backend.
 * Resizes large smartphone camera photos to max maxDimension (default 1000px) and compresses to JPEG ~80% quality.
 * Reduces 5MB+ photos to ~100-200KB, preventing QuotaExceededError and loss on mobile tab refreshes.
 */
export function compressImage(
  file: File,
  maxDimension = 1000,
  quality = 0.8
): Promise<{ file: File; base64: string }> {
  return new Promise((resolve, reject) => {
    // If it's not an image, resolve directly
    if (!file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => resolve({ file, base64: reader.result as string });
      reader.onerror = reject;
      reader.readAsDataURL(file);
      return;
    }

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;

      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        // Fallback to original reader if canvas fails
        const reader = new FileReader();
        reader.onloadend = () => resolve({ file, base64: reader.result as string });
        reader.onerror = reject;
        reader.readAsDataURL(file);
        return;
      }

      // Draw and compress image
      ctx.drawImage(img, 0, 0, width, height);
      const base64 = canvas.toDataURL('image/jpeg', quality);

      // Convert compressed base64 back to Blob/File for consistency
      try {
        const byteString = atob(base64.split(',')[1]);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
          ia[i] = byteString.charCodeAt(i);
        }
        const blob = new Blob([ab], { type: 'image/jpeg' });
        const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, '') + '.jpg', {
          type: 'image/jpeg'
        });
        resolve({ file: compressedFile, base64 });
      } catch {
        resolve({ file, base64 });
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      // Fallback
      const reader = new FileReader();
      reader.onloadend = () => resolve({ file, base64: reader.result as string });
      reader.onerror = reject;
      reader.readAsDataURL(file);
    };

    img.src = objectUrl;
  });
}
