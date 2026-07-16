import { put, head } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';
import type { EncryptedPayload } from '@/lib/types';
import { SCHEMA_VERSION } from '@/lib/types';
import { validateStashId } from '@/lib/stash';

function blobKey(id: string): string {
  return `stashes/${id}.json`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      id: string;
      payload: EncryptedPayload;
    };

    const { id, payload } = body;

    if (!id || !validateStashId(id)) {
      return NextResponse.json(
        { error: 'Invalid stash ID.' },
        { status: 400 }
      );
    }

    // Check if stash already exists
    try {
      await head(blobKey(id));
      return NextResponse.json(
        { error: 'A stash with this ID already exists. Choose a different ID.' },
        { status: 409 }
      );
    } catch {
      // 404 = does not exist, continue with creation
    }

    const blob = await put(
      blobKey(id),
      JSON.stringify({ ...payload, schemaVersion: payload.schemaVersion || SCHEMA_VERSION }),
      {
        access: 'public',
        contentType: 'application/json',
        addRandomSuffix: false,
      }
    );

    return NextResponse.json({ success: true, url: blob.url }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/stash] Error:', err);
    return NextResponse.json(
      { error: 'Failed to create stash. Please try again.' },
      { status: 500 }
    );
  }
}
