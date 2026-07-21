import { NextRequest, NextResponse } from 'next/server';
import { fetchAndDecrypt } from '@/lib/stashApiHelpers';
import { StashSection } from '@/lib/types';

export const dynamic = 'force-dynamic';

function getPassword(req: NextRequest) {
  return req.headers.get('X-Stash-Password');
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const password = getPassword(request);
    
    if (!password) {
      return NextResponse.json({ error: 'Missing X-Stash-Password header.' }, { status: 401 });
    }

    const { stash } = await fetchAndDecrypt(id, password);

    const sectionId = request.nextUrl.searchParams.get('sectionId');
    if (sectionId) {
      // Find section
      let foundSection: StashSection | null = null;
      const searchSections = (sections: StashSection[]) => {
        for (const s of sections) {
          if (s.id === sectionId) {
            foundSection = s;
            return;
          }
          searchSections(s.children);
        }
      };
      searchSections(stash.sections);
      
      if (!foundSection) {
        return NextResponse.json({ error: 'Section not found.' }, { status: 404 });
      }
      return NextResponse.json(foundSection);
    }

    return NextResponse.json(stash);
  } catch (err: any) {
    console.error('[GET /api/v1/stash/[id]] Error:', err);
    if (err.message === 'Stash not found.') return NextResponse.json({ error: err.message }, { status: 404 });
    if (err.message === 'Incorrect password.') return NextResponse.json({ error: err.message }, { status: 401 });
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
