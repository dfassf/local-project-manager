import { NextRequest, NextResponse } from 'next/server';
import { startProcess } from '@/lib/process-manager';

export async function POST(request: NextRequest) {
  try {
    const { configId } = await request.json();

    if (!configId) {
      return NextResponse.json({ error: 'configId가 필요합니다' }, { status: 400 });
    }

    const result = await startProcess(configId);
    return NextResponse.json({
      message: '프로세스가 시작되었습니다',
      pid: result.pid,
      port: result.port,
    });
  } catch (error) {
    return NextResponse.json(
      { error: `프로세스 시작 실패: ${error instanceof Error ? error.message : error}` },
      { status: 500 }
    );
  }
}
