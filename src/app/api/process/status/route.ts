import { NextResponse } from 'next/server';
import { detectRunningProcesses } from '@/lib/process-manager';

export async function GET() {
  try {
    const processes = await detectRunningProcesses();
    return NextResponse.json(processes);
  } catch (error) {
    return NextResponse.json(
      { error: `프로세스 상태 조회 실패: ${error}` },
      { status: 500 }
    );
  }
}
