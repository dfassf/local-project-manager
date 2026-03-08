import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import type { ClaudeSession } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project_id');
    const db = getDb();

    let sessions: ClaudeSession[];
    if (projectId) {
      sessions = db.prepare(
        'SELECT * FROM claude_sessions WHERE project_id = ? ORDER BY last_activity DESC'
      ).all(projectId) as ClaudeSession[];
    } else {
      sessions = db.prepare(
        'SELECT * FROM claude_sessions ORDER BY last_activity DESC LIMIT 100'
      ).all() as ClaudeSession[];
    }

    return NextResponse.json(sessions);
  } catch (error) {
    return NextResponse.json(
      { error: `세션 조회 실패: ${error}` },
      { status: 500 }
    );
  }
}
