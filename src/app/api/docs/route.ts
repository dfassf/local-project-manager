import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, writeFileSync, unlinkSync, existsSync, statSync } from 'fs';
import path from 'path';
import { getDb } from '@/lib/db';
import { homedir } from 'os';

// Claude: CLAUDE.md, Codex: AGENTS.md
const ALLOWED_FILES = new Set(['CLAUDE.md', 'AGENTS.md']);
const PROJECT_DOC_FILES = ['CLAUDE.md', 'AGENTS.md'] as const;

interface DocFileInfo {
  name: string;
  exists: boolean;
  size: number | null;
  path: string;
}

interface DocLevel {
  level: 'global' | 'workspace' | 'project';
  label: string;
  dirPath: string;
  id?: string;
  group_name?: string;
  files: DocFileInfo[];
}

function scanFile(filePath: string, name: string): DocFileInfo {
  const exists = existsSync(filePath);
  let size: number | null = null;
  if (exists) {
    try { size = statSync(filePath).size; } catch { /* */ }
  }
  return { name, exists, size, path: filePath };
}

function scanDir(dirPath: string): DocFileInfo[] {
  return PROJECT_DOC_FILES.map(name => scanFile(path.join(dirPath, name), name));
}

export async function GET() {
  const db = getDb();
  const levels: DocLevel[] = [];

  // 1. 전역: ~/.claude/CLAUDE.md + ~/.codex/AGENTS.md (디렉토리가 다름)
  const home = homedir();
  levels.push({
    level: 'global',
    label: '전역 설정',
    dirPath: home,
    files: [
      scanFile(path.join(home, '.claude', 'CLAUDE.md'), 'CLAUDE.md'),
      scanFile(path.join(home, '.codex', 'AGENTS.md'), 'AGENTS.md'),
    ],
  });

  // 2. 워크스페이스: scan_directories
  const scanDirs = db.prepare(
    'SELECT path, label FROM scan_directories ORDER BY created_at'
  ).all() as { path: string; label: string }[];

  for (const dir of scanDirs) {
    levels.push({
      level: 'workspace',
      label: dir.label,
      dirPath: dir.path,
      files: scanDir(dir.path),
    });
  }

  // 3. 프로젝트별
  const projects = db.prepare(`
    SELECT id, COALESCE(display_name, name) as name, path, group_name
    FROM projects
    ORDER BY group_name, updated_at DESC
  `).all() as { id: string; name: string; path: string; group_name: string }[];

  for (const project of projects) {
    levels.push({
      level: 'project',
      label: project.name,
      dirPath: project.path,
      id: project.id,
      group_name: project.group_name,
      files: scanDir(project.path),
    });
  }

  return NextResponse.json(levels);
}

// 파일 내용 읽기
export async function POST(request: NextRequest) {
  try {
    const { filePath } = await request.json();
    if (!filePath) {
      return NextResponse.json({ error: '경로 필요' }, { status: 400 });
    }

    const fileName = path.basename(filePath);
    if (!ALLOWED_FILES.has(fileName)) {
      return NextResponse.json({ error: '허용되지 않는 파일' }, { status: 400 });
    }

    if (!existsSync(filePath)) {
      return NextResponse.json({ content: '', isNew: true });
    }

    const content = readFileSync(filePath, 'utf-8');
    return NextResponse.json({ content, isNew: false });
  } catch {
    return NextResponse.json({ error: '파일 읽기 실패' }, { status: 500 });
  }
}

// 파일 저장 (생성 포함)
export async function PUT(request: NextRequest) {
  try {
    const { filePath, content } = await request.json();
    if (!filePath || content === undefined) {
      return NextResponse.json({ error: '경로와 내용 필요' }, { status: 400 });
    }

    const fileName = path.basename(filePath);
    if (!ALLOWED_FILES.has(fileName)) {
      return NextResponse.json({ error: '허용되지 않는 파일' }, { status: 400 });
    }

    writeFileSync(filePath, content, 'utf-8');
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: '파일 저장 실패' }, { status: 500 });
  }
}

// 파일 삭제
export async function DELETE(request: NextRequest) {
  try {
    const { filePath } = await request.json();
    if (!filePath) {
      return NextResponse.json({ error: '경로 필요' }, { status: 400 });
    }

    const fileName = path.basename(filePath);
    if (!ALLOWED_FILES.has(fileName)) {
      return NextResponse.json({ error: '허용되지 않는 파일' }, { status: 400 });
    }

    if (!existsSync(filePath)) {
      return NextResponse.json({ error: '파일이 없습니다' }, { status: 404 });
    }

    unlinkSync(filePath);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: '파일 삭제 실패' }, { status: 500 });
  }
}
