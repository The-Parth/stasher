import type { MediaType } from './types';

// Formats browsers can render inline
const PREVIEWABLE_IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.svg'];
const PREVIEWABLE_VIDEO_EXTS = ['.mp4', '.webm', '.ogg'];

// All known media extensions (get a download button)
const ALL_VIDEO_EXTS = ['.mp4', '.webm', '.ogg', '.mov', '.m4v', '.mkv', '.avi', '.flv', '.wmv', '.ts'];
const ALL_IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.svg', '.bmp', '.tiff', '.ico'];

function getExtension(url: string): string {
  try {
    // Strip query string before getting extension
    const pathname = new URL(url).pathname;
    const lastDot = pathname.lastIndexOf('.');
    return lastDot >= 0 ? pathname.slice(lastDot).toLowerCase() : '';
  } catch {
    return '';
  }
}

/** Returns 'video', 'image', or 'other' based on file extension */
export function getMediaType(url: string): MediaType {
  const ext = getExtension(url);
  if (ALL_IMAGE_EXTS.includes(ext)) return 'image';
  if (ALL_VIDEO_EXTS.includes(ext)) return 'video';
  return 'other';
}

/** True if the URL points to any media file (video or image) — gets a download button */
export function isMediaUrl(url: string): boolean {
  const type = getMediaType(url);
  return type === 'image' || type === 'video';
}

/**
 * True if the media can be rendered inline in the browser.
 * MKV, AVI, MOV etc. are not browser-playable so only get a download button.
 */
export function isInlinePreviewable(url: string): boolean {
  const ext = getExtension(url);
  return PREVIEWABLE_IMAGE_EXTS.includes(ext) || PREVIEWABLE_VIDEO_EXTS.includes(ext);
}

// Keep for backwards compatibility
export function isPreviewable(url: string): boolean {
  return isMediaUrl(url);
}

// Legacy — kept in case anything imports it
export function isVercelBlobUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return hostname.endsWith('.public.blob.vercel-storage.com');
  } catch {
    return false;
  }
}
