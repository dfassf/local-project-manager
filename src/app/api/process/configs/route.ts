import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  const db = getDb();

  // projects에 dev_command가 있지만 process_configs에 없는 경우 자동 생성
  const missing = db.prepare(`
    SELECT p.id, COALESCE(p.display_name, p.name) as label, p.dev_command, p.path, p.dev_port
    FROM projects p
    WHERE p.dev_command IS NOT NULL
    AND p.id NOT IN (SELECT project_id FROM process_configs)
  `).all() as { id: string; label: string; dev_command: string; path: string; dev_port: number | null }[];

  const insert = db.prepare(
    'INSERT INTO process_configs (project_id, label, command, cwd, port) VALUES (?, ?, ?, ?, ?)'
  );
  for (const m of missing) {
    insert.run(m.id, m.label, m.dev_command, m.path, m.dev_port);
  }

  // 전체 configs 반환 (group_name 포함, 이름 중복 시 폴더명 추가)
  const configs = db.prepare(`
    SELECT pc.id, pc.project_id, pc.command, pc.port,
           COALESCE(p.display_name, p.name) as project_name,
           p.path, p.group_name
    FROM process_configs pc
    JOIN projects p ON p.id = pc.project_id
    ORDER BY p.group_name, p.updated_at DESC
  `).all() as { id: number; project_id: string; command: string; port: number | null; project_name: string; path: string; group_name: string }[];

  // 이름 중복 카운트
  const nameCounts = new Map<string, number>();
  for (const c of configs) {
    nameCounts.set(c.project_name, (nameCounts.get(c.project_name) || 0) + 1);
  }

  const result = configs.map(c => {
    const folder = c.path.split('/').pop() || '';
    return {
      id: c.id,
      project_id: c.project_id,
      command: c.command,
      port: c.port,
      group_name: c.group_name,
      project_name: nameCounts.get(c.project_name)! > 1
        ? `${c.project_name} (${folder})`
        : c.project_name,
    };
  });

  return NextResponse.json(result);
}
