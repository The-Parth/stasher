'use client';
import type { StashLink } from '@/lib/types';
import { isMediaUrl, isInlinePreviewable, getMediaType } from '@/lib/media';
import MediaPreview from './MediaPreview';
import { useState } from 'react';

interface LinkItemProps {
  link: StashLink;
  onEdit?: (link: StashLink) => void;
  onDelete?: (id: string) => void;
  dragHandleProps?: Record<string, unknown>;
}

export default function LinkItem({ link, onEdit, onDelete, dragHandleProps }: LinkItemProps) {
  const [showPreview, setShowPreview] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const isMedia = isMediaUrl(link.url);
  const canPreview = isInlinePreviewable(link.url);
  const mediaType = getMediaType(link.url);

  let displayLabel = link.label;
  if (!displayLabel) {
    try { displayLabel = new URL(link.url).hostname; } catch { displayLabel = link.url; }
  }

  // Derive a filename from the URL for the download attribute
  let filename = 'file';
  try { filename = decodeURIComponent(new URL(link.url).pathname.split('/').pop() || 'file'); } catch { /* ignore */ }

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setDownloadProgress(0);

    try {
      const res = await fetch(link.url);
      if (!res.ok) throw new Error('Network response was not ok');

      const reader = res.body?.getReader();
      const contentLength = res.headers.get('content-length');
      const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;

      if (!reader) throw new Error('Response body reader is not available');

      let receivedBytes = 0;
      const chunks: Uint8Array[] = [];
      let writableStream: any = null;

      // Try FileSystem Access API first to stream directly to disk (Chrome/Edge/Opera)
      try {
        if ('showSaveFilePicker' in window) {
          const handle = await (window as any).showSaveFilePicker({
            suggestedName: filename,
          });
          writableStream = await handle.createWritable();
        }
      } catch (err) {
        // User canceled file picker or browser does not support it
        console.log('Skipping direct-to-disk stream:', err);
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        if (writableStream) {
          await writableStream.write(value);
        } else {
          chunks.push(value);
        }

        receivedBytes += value.length;
        if (totalBytes > 0) {
          const percent = Math.round((receivedBytes / totalBytes) * 100);
          setDownloadProgress(percent);
        }
      }

      if (writableStream) {
        await writableStream.close();
      } else {
        const blob = new Blob(chunks as BlobPart[]);
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      }
    } catch (err) {
      console.warn('Direct stream download failed, falling back to new tab:', err);
      window.open(link.url, '_blank', 'noopener,noreferrer');
    } finally {
      setDownloadProgress(null);
    }
  };

  return (
    <div className="link-item">
      {dragHandleProps && (
        <span className="drag-handle" {...dragHandleProps} aria-label="Drag to reorder">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <circle cx="5" cy="3" r="1.5" /><circle cx="11" cy="3" r="1.5" />
            <circle cx="5" cy="8" r="1.5" /><circle cx="11" cy="8" r="1.5" />
            <circle cx="5" cy="13" r="1.5" /><circle cx="11" cy="13" r="1.5" />
          </svg>
        </span>
      )}
      <div className="link-item-main">
        {/* Media type badge */}
        {isMedia && (
          <span className={`badge ${mediaType === 'video' ? 'badge-purple' : 'badge-green'}`} style={{ marginBottom: '4px', width: 'fit-content' }}>
            {mediaType === 'video' ? '▶ video' : '⬡ image'}
          </span>
        )}
        <div className="link-item-label" title={link.label}>{displayLabel}</div>
        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="link-item-url"
          title={link.url}
          onClick={e => e.stopPropagation()}
        >
          {link.url}
        </a>
        {link.previewText && <div className="link-item-preview">{link.previewText}</div>}
        {showPreview && canPreview && (
          <MediaPreview url={link.url} filename={filename} />
        )}
      </div>

      <div className="link-item-actions" style={{ opacity: 1 }}>
        {/* Copy Link */}
        <button
          className="btn-icon"
          title={copied ? 'Copied!' : 'Copy link'}
          onClick={handleCopy}
          aria-label={copied ? 'Copied link' : 'Copy link'}
          style={{ color: copied ? 'var(--accent)' : undefined }}
        >
          {copied ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          )}
        </button>

        {/* Download button — always visible for any media link */}
        {isMedia && (
          <button
            onClick={handleDownload}
            className="btn btn-secondary btn-sm"
            disabled={downloadProgress !== null}
            title={downloadProgress !== null ? `Downloading (${downloadProgress}%)` : `Download ${filename}`}
            aria-label={downloadProgress !== null ? `Downloading (${downloadProgress}%)` : `Download ${filename}`}
            id={`download-${link.id}`}
          >
            {downloadProgress !== null ? (
              <>
                <span className="spinner spinner-sm" />
                {downloadProgress}%
              </>
            ) : (
              <>
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                  <path d="M6.5 1v8M3.5 6l3 3 3-3M1 11h11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Download
              </>
            )}
          </button>
        )}

        {/* Preview toggle — only for browser-renderable formats */}
        {canPreview && (
          <button
            className="btn-icon"
            title={showPreview ? 'Hide preview' : 'Preview'}
            onClick={() => setShowPreview(v => !v)}
            aria-label={showPreview ? 'Hide preview' : 'Preview'}
            style={{ color: showPreview ? 'var(--accent)' : undefined }}
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
              <path d="M1 7.5S3.5 3 7.5 3s6.5 4.5 6.5 4.5S11.5 12 7.5 12 1 7.5 1 7.5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
              <circle cx="7.5" cy="7.5" r="2" stroke="currentColor" strokeWidth="1.2"/>
            </svg>
          </button>
        )}

        {/* Edit & Delete */}
        {onEdit && (
          <button className="btn-icon" title="Edit link" onClick={() => onEdit(link)} aria-label="Edit link">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M9.5 2.5l2 2-7 7H2.5v-2l7-7z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
            </svg>
          </button>
        )}
        {onDelete && (
          <button className="btn-icon" title="Delete link" onClick={() => onDelete(link.id)} aria-label="Delete link" style={{ color: 'var(--error)' }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M2 3.5h10M5 3.5V2.5h4v1M5.5 6v4M8.5 6v4M3 3.5l.7 8h6.6l.7-8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
