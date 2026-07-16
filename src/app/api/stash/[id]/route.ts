import { put, head, del } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';
import type { EncryptedPayload, EncryptedPayloadV2 } from '@/lib/types';
import { hashEditToken } from '@/lib/crypto';

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

    let blobMeta;
    try {
      blobMeta = await head(blobKey(id));
    } catch {
      return NextResponse.json({ error: 'Stash not found.' }, { status: 404 });
    }

    const response = await fetch(blobMeta.url);
    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch stash data.' }, { status: 502 });
    }

    const payload = await response.json() as EncryptedPayload;
    return NextResponse.json(payload);
  } catch (err) {
    console.error('[GET /api/stash/[id]] Error:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

async function verifyAuth(id: string, request: NextRequest): Promise<NextResponse | null> {
  let existingBlobMeta;
  try {
    existingBlobMeta = await head(blobKey(id));
  } catch {
    return NextResponse.json({ error: 'Stash not found.' }, { status: 404 });
  }

  const response = await fetch(existingBlobMeta.url);
  if (!response.ok) {
    return NextResponse.json({ error: 'Failed to fetch existing stash.' }, { status: 502 });
  }
  
  const existingPayload = await response.json() as EncryptedPayload;

  // Schema v1 does not have auth locks
  if (existingPayload.schemaVersion === 1) {
    return null; // OK
  }

  if (existingPayload.schemaVersion === 2) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '').trim();
    const p2 = existingPayload as EncryptedPayloadV2;
    
    const computedHash = await hashEditToken(token, p2.authSalt);
    if (computedHash !== p2.authVerifyHash) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }
    return null; // OK
  }

  return NextResponse.json({ error: 'Unsupported schema version.' }, { status: 400 });
}

// PUT /api/stash/[id] — update (overwrite) an encrypted stash payload
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Auth check
    const authError = await verifyAuth(id, request);
    if (authError) return authError;

    const payload = await request.json() as EncryptedPayload;

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
    return NextResponse.json({ error: 'Failed to save stash. Please try again.' }, { status: 500 });
  }
}

// DELETE /api/stash/[id] — permanently delete a stash
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Auth check (requires admin editToken)
    const authError = await verifyAuth(id, request);
    if (authError) return authError;

    await del(blobKey(id));
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/stash/[id]] Error:', err);
    return NextResponse.json({ error: 'Failed to delete stash.' }, { status: 500 });
  }
}
