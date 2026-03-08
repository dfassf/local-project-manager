import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { existsSync } from 'fs';

export async function GET() {
  const db = getDb();
  const dirs = db.prepare('SELECT * FROM scan_directories ORDER BY created_at').all();
  return NextResponse.json(dirs);
}

export async function POST(request: NextRequest) {
  try {
    const { path, label } = await request.json();
    if (!path || !label) {
      return NextResponse.json({ error: '경로와 라벨은 필수입니다' }, { status: 400 });
    }
    if (!existsSync(path)) {
      return NextResponse.json({ error: '존재하지 않는 경로입니다' }, { status: 400 });
    }
    const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `dir-${Date.now()}`;
    const db = getDb();
    const result = db.prepare(
      'INSERT INTO scan_directories (path, label, slug) VALUES (?, ?, ?)'
    ).run(path, label, slug);
    return NextResponse.json({ id: result.lastInsertRowid });
  } catch (error) {
    const msg = error instanceof Error && error.message.includes('UNIQUE')
      ? '이미 등록된 경로입니다'
      : `추가 실패: ${error}`;
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { id, path, label, is_active } = await request.json();
    if (!id) return NextResponse.json({ error: 'id 필수' }, { status: 400 });

    if (path && !existsSync(path)) {
      return NextResponse.json({ error: '존재하지 않는 경로입니다' }, { status: 400 });
    }

    const db = getDb();
    const fields: string[] = [];
    const values: unknown[] = [];

    if (path !== undefined) { fields.push('path = ?'); values.push(path); }
    if (label !== undefined) { fields.push('label = ?'); values.push(label); }
    if (is_active !== undefined) { fields.push('is_active = ?'); values.push(is_active ? 1 : 0); }

    if (fields.length === 0) return NextResponse.json({ error: '변경할 항목 없음' }, { status: 400 });

    values.push(id);
    db.prepare(`UPDATE scan_directories SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: `수정 실패: ${error}` }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: 'id 필수' }, { status: 400 });
    const db = getDb();
    db.prepare('DELETE FROM scan_directories WHERE id = ?').run(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: `삭제 실패: ${error}` }, { status: 500 });
  }
}
