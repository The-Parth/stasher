import { NextRequest, NextResponse } from 'next/server';
import { fetchAndDecrypt, encryptAndSave, addSectionToStash } from '@/lib/stashApiHelpers';

export const dynamic = 'force-dynamic';

function getPassword(req: NextRequest) {
  return req.headers.get('X-Stash-Password');
}

export async function POST(
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

    const { title, description, parentSectionId } = body;
    if (!title) {
      return NextResponse.json({ error: 'Title is required.' }, { status: 400 });
    }

    const { stash, role, masterKey, payload } = await fetchAndDecrypt(id, password);

    if (role === 'read') {
      return NextResponse.json({ error: 'Read-only access. Cannot modify.' }, { status: 403 });
    }

    let result;
    try {
      result = addSectionToStash(stash, title, description || '', parentSectionId);
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }

    await encryptAndSave(id, result.stash, password, role, masterKey, payload);

    return NextResponse.json({ success: true, section: result.section }, { status: 201 });
  } catch (err: any) {
    console.error('[POST /api/v1/stash/[id]/section] Error:', err);
    if (err.message === 'Stash not found.') return NextResponse.json({ error: err.message }, { status: 404 });
    if (err.message === 'Incorrect password.') return NextResponse.json({ error: err.message }, { status: 401 });
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
