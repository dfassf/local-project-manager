import { NextResponse } from 'next/server';
import { scanAllProjects } from '@/lib/git-scanner';
import { syncSessionsToDb } from '@/lib/claude-history-parser';

export async function GET() {
  try {
    const projectCount = await scanAllProjects();
    let sessionCount = 0;

    try {
      sessionCount = await syncSessionsToDb();
    } catch {
      // Claude 이력 파싱 실패해도 계속 진행
    }

    return NextResponse.json({
      message: `${projectCount}개 프로젝트 스캔 완료, ${sessionCount}개 Claude 세션 동기화`,
      projectCount,
      sessionCount,
    });
  } catch (error) {
    return NextResponse.json(
      { error: `스캔 실패: ${error}` },
      { status: 500 }
    );
  }
}
