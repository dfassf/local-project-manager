import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getProjectStats } from '@/lib/git-scanner';
import { detectRunningProcesses } from '@/lib/process-manager';
import type { Project, ProjectWithStatus } from '@/types';

export async function GET() {
  try {
    const db = getDb();
    const projects = db.prepare('SELECT * FROM projects ORDER BY group_name, name').all() as Project[];
    const runningProcesses = await detectRunningProcesses();

    const projectsWithStatus: ProjectWithStatus[] = projects.map(project => {
      const stats = getProjectStats(project.path);
      const running = runningProcesses.find(p => p.project_id === project.id);
      const noteCount = (db.prepare('SELECT COUNT(*) as count FROM notes WHERE project_id = ?').get(project.id) as { count: number }).count;

      return {
        ...project,
        is_monorepo: !!project.is_monorepo,
        last_commit_date: stats.lastCommitDate,
        last_commit_message: stats.lastCommitMessage,
        current_branch: null,
        uncommitted_changes: 0,
        running_port: running?.port || null,
        running_pid: running?.pid || null,
        note_count: noteCount,
      };
    });

    return NextResponse.json(projectsWithStatus);
  } catch (error) {
    return NextResponse.json(
      { error: `프로젝트 목록 조회 실패: ${error}` },
      { status: 500 }
    );
  }
}
