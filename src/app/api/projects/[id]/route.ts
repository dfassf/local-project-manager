import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getRecentCommits, getBranches, getCurrentBranch, getUncommittedChanges, findTodosInCode } from '@/lib/git-utils';
import { detectRunningProcesses } from '@/lib/process-manager';
import { getCachedSummaries } from '@/lib/ai-analyzer';
import type { Project, Note, ClaudeSession } from '@/types';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as Project | undefined;

    if (!project) {
      return NextResponse.json({ error: '프로젝트를 찾을 수 없습니다' }, { status: 404 });
    }

    const commits = getRecentCommits(project.path, 20);
    const branches = getBranches(project.path);
    const currentBranch = getCurrentBranch(project.path);
    const uncommittedChanges = getUncommittedChanges(project.path);
    const todos = findTodosInCode(project.path);
    const notes = db.prepare('SELECT * FROM notes WHERE project_id = ? ORDER BY is_pinned DESC, updated_at DESC').all(id) as Note[];
    const aiSummaries = getCachedSummaries(id);
    const claudeSessions = db.prepare('SELECT * FROM claude_sessions WHERE project_id = ? ORDER BY last_activity DESC').all(id) as ClaudeSession[];

    const runningProcesses = detectRunningProcesses();
    const processStatus = runningProcesses.find(p => p.project_id === id) || null;

    return NextResponse.json({
      project,
      commits,
      branches,
      current_branch: currentBranch,
      uncommitted_changes: uncommittedChanges,
      todos,
      notes,
      ai_summaries: aiSummaries,
      claude_sessions: claudeSessions,
      process_status: processStatus,
    });
  } catch (error) {
    return NextResponse.json(
      { error: `프로젝트 상세 조회 실패: ${error}` },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const db = getDb();

    const fields: string[] = [];
    const values: unknown[] = [];

    for (const key of ['display_name', 'dev_command', 'dev_port', 'description']) {
      if (key in body) {
        fields.push(`${key} = ?`);
        values.push(body[key]);
      }
    }

    if (fields.length === 0) {
      return NextResponse.json({ error: '수정할 필드가 없습니다' }, { status: 400 });
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    db.prepare(`UPDATE projects SET ${fields.join(', ')} WHERE id = ?`).run(...values);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: `프로젝트 수정 실패: ${error}` },
      { status: 500 }
    );
  }
}
