import { NextRequest, NextResponse } from 'next/server';
import { fetchAndDecrypt, encryptAndSave, updateItemInStash, deleteItemFromStash } from '@/lib/stashApiHelpers';

export const dynamic = 'force-dynamic';

function getPassword(req: NextRequest) {
  return req.headers.get('X-Stash-Password');
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const password = getPassword(request);
    
    if (!password) {
      return NextResponse.json({ error: 'Missing X-Stash-Password header.' }, { status: 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
    }

    const { id: itemId, ...updates } = body;
    if (!itemId) {
      return NextResponse.json({ error: 'Item ID (id) is required.' }, { status: 400 });
    }

    const { stash, role, masterKey, payload } = await fetchAndDecrypt(id, password);

    if (role === 'read') {
      return NextResponse.json({ error: 'Read-only access. Cannot modify.' }, { status: 403 });
    }

    let result;
    try {
      result = updateItemInStash(stash, itemId, updates);
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }

    await encryptAndSave(id, result.stash, password, role, masterKey, payload);

    return NextResponse.json({ success: true, item: result.item });
  } catch (err: any) {
    console.error('[PUT /api/v1/stash/[id]/item] Error:', err);
    if (err.message === 'Stash not found.') return NextResponse.json({ error: err.message }, { status: 404 });
    if (err.message === 'Incorrect password.') return NextResponse.json({ error: err.message }, { status: 401 });
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const password = getPassword(request);
    
    if (!password) {
      return NextResponse.json({ error: 'Missing X-Stash-Password header.' }, { status: 401 });
    }

    const itemId = request.nextUrl.searchParams.get('id');
    if (!itemId) {
      return NextResponse.json({ error: 'Item ID (?id=...) is required.' }, { status: 400 });
    }

    const { stash, role, masterKey, payload } = await fetchAndDecrypt(id, password);

    if (role === 'read') {
      return NextResponse.json({ error: 'Read-only access. Cannot modify.' }, { status: 403 });
    }

    let updatedStash;
    try {
      updatedStash = deleteItemFromStash(stash, itemId);
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }

    await encryptAndSave(id, updatedStash, password, role, masterKey, payload);

    return NextResponse.json({ success: true, deletedId: itemId });
  } catch (err: any) {
    console.error('[DELETE /api/v1/stash/[id]/item] Error:', err);
    if (err.message === 'Stash not found.') return NextResponse.json({ error: err.message }, { status: 404 });
    if (err.message === 'Incorrect password.') return NextResponse.json({ error: err.message }, { status: 401 });
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
