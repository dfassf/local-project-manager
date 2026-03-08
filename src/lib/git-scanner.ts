import { readdirSync, existsSync, statSync } from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import { getDb } from './db';
import { detectProjectType } from './project-detector';
import simpleGit from 'simple-git';

// 대시보드 자체 프로젝트는 제외
const EXCLUDE_DIRS = ['project-command-center', 'node_modules', '.git'];

export async function scanAllProjects(): Promise<number> {
  const db = getDb();
  let count = 0;

  const scanDirs = db.prepare(
    'SELECT path, label, slug FROM scan_directories WHERE is_active = 1'
  ).all() as { path: string; label: string; slug: string }[];

  for (const scanDir of scanDirs) {
    const group = scanDir.label;
    if (!existsSync(scanDir.path)) continue;

    const entries = readdirSync(scanDir.path, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (EXCLUDE_DIRS.includes(entry.name)) continue;
      if (entry.name.startsWith('.')) continue;

      const projectPath = path.join(scanDir.path, entry.name);
      const hasGit = existsSync(path.join(projectPath, '.git'));
      const hasPkg = existsSync(path.join(projectPath, 'package.json'));
      const hasPython = existsSync(path.join(projectPath, 'requirements.txt')) ||
                        existsSync(path.join(projectPath, 'pyproject.toml'));

      // 하위 디렉토리 확인 (frontend/backend 구조)
      let hasSubProject = false;
      if (!hasGit && !hasPkg && !hasPython) {
        try {
          const subEntries = readdirSync(projectPath, { withFileTypes: true });
          for (const sub of subEntries) {
            if (!sub.isDirectory()) continue;
            const subPath = path.join(projectPath, sub.name);
            if (existsSync(path.join(subPath, 'package.json')) ||
                existsSync(path.join(subPath, 'requirements.txt')) ||
                existsSync(path.join(subPath, 'pyproject.toml')) ||
                existsSync(path.join(subPath, '.git'))) {
              hasSubProject = true;
              break;
            }
          }
        } catch { /* ignore */ }
        if (!hasSubProject) continue;
      }

      let detection = detectProjectType(projectPath);

      // 루트에서 감지 실패하면 서브디렉토리 확인
      if (detection.type === 'unknown' || detection.type === 'node') {
        try {
          const subEntries = readdirSync(projectPath, { withFileTypes: true });
          const subTypes: string[] = [];
          for (const sub of subEntries) {
            if (!sub.isDirectory() || sub.name.startsWith('.') || sub.name === 'node_modules') continue;
            const subDetection = detectProjectType(path.join(projectPath, sub.name));
            if (subDetection.type !== 'unknown') subTypes.push(subDetection.type);
          }
          if (subTypes.length > 0) {
            detection = { ...detection, type: 'fullstack', isMonorepo: true };
          }
        } catch { /* ignore */ }
      }
      const id = `${scanDir.slug}__${entry.name}`;

      // 기존 프로젝트의 그룹 이름이 있으면 그걸 사용 (사용자가 변경했을 수 있음)
      const existing = db.prepare('SELECT group_name FROM projects WHERE id = ?').get(id) as { group_name: string } | undefined;
      const groupName = existing?.group_name || group;

      // git remote 가져오기
      let gitRemote: string | null = null;
      if (hasGit) {
        try {
          const git = simpleGit(projectPath);
          const remotes = await git.getRemotes(true);
          gitRemote = remotes.find(r => r.name === 'origin')?.refs.fetch || null;
        } catch { /* no remote */ }
      }

      const stmt = db.prepare(`
        INSERT INTO projects (id, name, display_name, path, group_name, project_type, is_monorepo, git_remote, dev_command, dev_port, description, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET
          project_type = excluded.project_type,
          is_monorepo = excluded.is_monorepo,
          git_remote = excluded.git_remote,
          dev_command = excluded.dev_command,
          dev_port = excluded.dev_port,
          description = COALESCE(projects.description, excluded.description),
          display_name = COALESCE(projects.display_name, excluded.display_name),
          updated_at = CURRENT_TIMESTAMP
      `);

      stmt.run(
        id,
        entry.name,
        detection.displayName,
        projectPath,
        groupName,
        detection.type,
        detection.isMonorepo ? 1 : 0,
        gitRemote,
        detection.devCommand || null,
        detection.expectedPort || null,
        detection.description,
      );

      // dev_command가 있으면 process_config도 자동 생성
      if (detection.devCommand) {
        const existingConfig = db.prepare(
          'SELECT id FROM process_configs WHERE project_id = ? AND cwd = ?'
        ).get(id, projectPath);

        if (!existingConfig) {
          db.prepare(`
            INSERT INTO process_configs (project_id, label, command, cwd, port)
            VALUES (?, ?, ?, ?, ?)
          `).run(id, 'Dev Server', detection.devCommand, projectPath, detection.expectedPort || null);
        }
      }

      count++;
    }
  }

  return count;
}

export function getProjectStats(projectPath: string): {
  lastCommitDate: string | null;
  lastCommitMessage: string | null;
} {
  if (!existsSync(path.join(projectPath, '.git'))) {
    return { lastCommitDate: null, lastCommitMessage: null };
  }

  try {
    const log = execSync(
      'git log -1 --format="%ai|||%s" 2>/dev/null',
      { cwd: projectPath, encoding: 'utf-8', timeout: 5000 }
    ).trim();

    if (!log) return { lastCommitDate: null, lastCommitMessage: null };
    const [date, ...msgParts] = log.split('|||');
    return { lastCommitDate: date, lastCommitMessage: msgParts.join('|||') };
  } catch {
    return { lastCommitDate: null, lastCommitMessage: null };
  }
}
