import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { analyzeProject } from '@/lib/ai-analyzer';
import type { Project } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const { projectId } = await request.json();

    if (!projectId) {
      return NextResponse.json({ error: 'projectId가 필요합니다' }, { status: 400 });
    }

    const db = getDb();
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as Project | undefined;

    if (!project) {
      return NextResponse.json({ error: '프로젝트를 찾을 수 없습니다' }, { status: 404 });
    }

    const result = await analyzeProject(project);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: `AI 분석 실패: ${error instanceof Error ? error.message : error}` },
      { status: 500 }
    );
  }
}
