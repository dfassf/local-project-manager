import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function PATCH(request: NextRequest) {
  try {
    const { oldName, newName } = await request.json();

    if (!oldName || !newName || oldName === newName) {
      return NextResponse.json({ error: '유효하지 않은 이름' }, { status: 400 });
    }

    const db = getDb();
    const result = db.prepare(
      'UPDATE projects SET group_name = ? WHERE group_name = ?'
    ).run(newName, oldName);

    return NextResponse.json({ updated: result.changes });
  } catch (error) {
    return NextResponse.json(
      { error: `그룹 이름 변경 실패: ${error}` },
      { status: 500 }
    );
  }
}
