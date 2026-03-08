import { NextRequest, NextResponse } from 'next/server';
import { stopProcess } from '@/lib/process-manager';

export async function POST(request: NextRequest) {
  try {
    const { pid } = await request.json();

    if (!pid) {
      return NextResponse.json({ error: 'pid가 필요합니다' }, { status: 400 });
    }

    stopProcess(pid);
    return NextResponse.json({ message: '프로세스 종료 요청이 전송되었습니다', pid });
  } catch (error) {
    return NextResponse.json(
      { error: `프로세스 종료 실패: ${error instanceof Error ? error.message : error}` },
      { status: 500 }
    );
  }
}
