'use client';
import type { StashLink } from '@/lib/types';
import { isMediaUrl, isInlinePreviewable, getMediaType } from '@/lib/media';
import MediaPreview from './MediaPreview';
import { useState } from 'react';

interface LinkItemProps {
  link: StashLink;
  onEdit: (link: StashLink) => void;
  onDelete: (id: string) => void;
}

export default function LinkItem({ link, onEdit, onDelete }: LinkItemProps) {
  const [showPreview, setShowPreview] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
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
            style={{ color: showPreview ? 'var(--green)' : undefined }}
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
              <path d="M1 7.5S3.5 3 7.5 3s6.5 4.5 6.5 4.5S11.5 12 7.5 12 1 7.5 1 7.5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
              <circle cx="7.5" cy="7.5" r="2" stroke="currentColor" strokeWidth="1.2"/>
            </svg>
          </button>
        )}

        {/* Edit */}
        <button className="btn-icon" title="Edit link" onClick={() => onEdit(link)} aria-label="Edit link">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M9.5 2.5l2 2-7 7H2.5v-2l7-7z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
          </svg>
        </button>

        {/* Delete */}
        <button className="btn-icon" title="Delete link" onClick={() => onDelete(link.id)} aria-label="Delete link" style={{ color: 'var(--error)' }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M2 3.5h10M5 3.5V2.5h4v1M5.5 6v4M8.5 6v4M3 3.5l.7 8h6.6l.7-8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
