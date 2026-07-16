import { put, head } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';
import type { EncryptedPayload } from '@/lib/types';

function blobKey(id: string): string {
  return `stashes/${id}.json`;
}

// GET /api/stash/[id] — fetch encrypted stash payload
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Resolve the blob URL via head(), then fetch the JSON
    let blobMeta;
    try {
      blobMeta = await head(blobKey(id));
    } catch {
      return NextResponse.json(
        { error: 'Stash not found.' },
        { status: 404 }
      );
    }

    const response = await fetch(blobMeta.url);
    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch stash data.' },
        { status: 502 }
      );
    }

    const payload = await response.json() as EncryptedPayload;
    return NextResponse.json(payload);
  } catch (err) {
    console.error('[GET /api/stash/[id]] Error:', err);
    return NextResponse.json(
      { error: 'Internal server error.' },
      { status: 500 }
    );
  }
}

// PUT /api/stash/[id] — update (overwrite) an encrypted stash payload
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const payload = await request.json() as EncryptedPayload;

    // Verify it exists first
    try {
      await head(blobKey(id));
    } catch {
      return NextResponse.json(
        { error: 'Stash not found.' },
        { status: 404 }
      );
    }

    await put(
      blobKey(id),
      JSON.stringify(payload),
      {
        access: 'public',
        contentType: 'application/json',
        addRandomSuffix: false,
        allowOverwrite: true,
      }
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[PUT /api/stash/[id]] Error:', err);
    return NextResponse.json(
      { error: 'Failed to save stash. Please try again.' },
      { status: 500 }
    );
  }
}
