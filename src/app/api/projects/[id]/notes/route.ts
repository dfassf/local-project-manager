import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const notes = db.prepare(
    'SELECT * FROM notes WHERE project_id = ? ORDER BY is_pinned DESC, updated_at DESC'
  ).all(id);
  return NextResponse.json(notes);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { content, note_type = 'memo' } = body;

    if (!content?.trim()) {
      return NextResponse.json({ error: '내용을 입력해주세요' }, { status: 400 });
    }

    const db = getDb();
    const result = db.prepare(`
      INSERT INTO notes (project_id, content, note_type)
      VALUES (?, ?, ?)
    `).run(id, content.trim(), note_type);

    const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(result.lastInsertRowid);
    return NextResponse.json(note, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: `메모 추가 실패: ${error}` },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { note_id, content, is_pinned } = body;

    if (!note_id) {
      return NextResponse.json({ error: 'note_id 필요' }, { status: 400 });
    }

    const db = getDb();
    const fields: string[] = [];
    const values: unknown[] = [];

    if (content !== undefined) {
      fields.push('content = ?');
      values.push(content);
    }
    if (is_pinned !== undefined) {
      fields.push('is_pinned = ?');
      values.push(is_pinned ? 1 : 0);
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(note_id);

    db.prepare(`UPDATE notes SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(note_id);
    return NextResponse.json(note);
  } catch (error) {
    return NextResponse.json(
      { error: `메모 수정 실패: ${error}` },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const noteId = searchParams.get('note_id');

    if (!noteId) {
      return NextResponse.json({ error: 'note_id 필요' }, { status: 400 });
    }

    const db = getDb();
    db.prepare('DELETE FROM notes WHERE id = ?').run(noteId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: `메모 삭제 실패: ${error}` },
      { status: 500 }
    );
  }
}
