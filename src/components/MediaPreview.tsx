'use client';
import { getMediaType } from '@/lib/media';
import { useState } from 'react';

interface MediaPreviewProps {
  url: string;
  filename?: string;
}

export default function MediaPreview({ url, filename }: MediaPreviewProps) {
  const type = getMediaType(url);
  const displayName = filename || url.split('/').pop() || 'file';
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);

  const handleDownload = async () => {
    setDownloadProgress(0);

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('Network response was not ok');

      const reader = res.body?.getReader();
      const contentLength = res.headers.get('content-length');
      const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;

      if (!reader) throw new Error('Response body reader is not available');

      let receivedBytes = 0;
      const chunks: Uint8Array[] = [];
      let writableStream: any = null;

      try {
        if ('showSaveFilePicker' in window) {
          const handle = await (window as any).showSaveFilePicker({
            suggestedName: displayName,
          });
          writableStream = await handle.createWritable();
        }
      } catch (err) {
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
        a.download = displayName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      }
    } catch (err) {
      console.warn('Direct stream download failed, falling back to new tab:', err);
      window.open(url, '_blank', 'noopener,noreferrer');
    } finally {
      setDownloadProgress(null);
    }
  };

  return (
    <div className="media-preview">
      {type === 'image' && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="Preview" loading="lazy" />
      )}
      {type === 'video' && (
        <video controls preload="metadata">
          <source src={url} />
          Your browser does not support the video tag.
        </video>
      )}
      <div className="media-preview-bar">
        <span className="text-muted" style={{ fontSize: '0.75rem', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {displayName}
        </span>
        <button
          onClick={handleDownload}
          className="btn btn-secondary btn-sm"
          disabled={downloadProgress !== null}
          id={`preview-download-${displayName}`}
          aria-label={downloadProgress !== null ? `Downloading (${downloadProgress}%)` : `Download ${displayName}`}
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
      </div>
    </div>
  );
}
