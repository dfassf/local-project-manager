import { createReadStream, readdirSync, existsSync, statSync } from 'fs';
import { createInterface } from 'readline';
import path from 'path';
import { getDb } from './db';

const CLAUDE_PROJECTS_DIR = path.join(
  process.env.HOME || '/Users/test',
  '.claude',
  'projects'
);

// Claude Code 디렉토리명 → 실제 경로 매핑
const DIR_MAPPINGS: Record<string, string> = {
  '-Users-test-Desktop-private-repo': '/Users/test/Desktop/private_repo',
  '-Users-test-Desktop-private_repo': '/Users/test/Desktop/private_repo',
};

interface ParsedMessage {
  type: string;
  timestamp: string;
  sessionId: string;
  cwd?: string;
  gitBranch?: string;
  text?: string;
}

interface ParsedSession {
  sessionId: string;
  projectPath: string;
  projectName: string;
  firstMessage: string;
  messageCount: number;
  startTime: string;
  endTime: string;
  filePath: string;
}

export async function parseAllSessions(): Promise<ParsedSession[]> {
  if (!existsSync(CLAUDE_PROJECTS_DIR)) return [];

  const sessions: ParsedSession[] = [];
  const dirs = readdirSync(CLAUDE_PROJECTS_DIR, { withFileTypes: true });

  for (const dir of dirs) {
    if (!dir.isDirectory()) continue;

    const dirPath = path.join(CLAUDE_PROJECTS_DIR, dir.name);
    const basePath = DIR_MAPPINGS[dir.name];
    if (!basePath) continue;

    let files: string[];
    try {
      files = readdirSync(dirPath).filter(f => f.endsWith('.jsonl'));
    } catch {
      continue;
    }

    for (const file of files) {
      const filePath = path.join(dirPath, file);

      try {
        const stat = statSync(filePath);
        if (stat.size === 0) continue;
      } catch {
        continue;
      }

      try {
        const session = await parseSessionFile(filePath, basePath);
        if (session && session.messageCount > 0) {
          sessions.push(session);
        }
      } catch {
        // 파싱 실패한 파일 무시
      }
    }
  }

  return sessions.sort((a, b) =>
    new Date(b.endTime).getTime() - new Date(a.endTime).getTime()
  );
}

async function parseSessionFile(filePath: string, basePath: string): Promise<ParsedSession | null> {
  const messages: ParsedMessage[] = [];
  const cwdCounts: Record<string, number> = {};

  const rl = createInterface({
    input: createReadStream(filePath),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (!line.trim()) continue;

    try {
      const obj = JSON.parse(line);

      if (obj.type === 'user' && obj.message?.content) {
        const texts = obj.message.content
          .filter((c: { type: string; text?: string }) =>
            c.type === 'text' && c.text && !c.text.startsWith('<ide_')
          )
          .map((c: { text: string }) => c.text);

        if (texts.length > 0) {
          messages.push({
            type: 'user',
            timestamp: obj.timestamp,
            sessionId: obj.sessionId,
            cwd: obj.cwd,
            gitBranch: obj.gitBranch,
            text: texts.join(' ').slice(0, 500),
          });

          if (obj.cwd) {
            cwdCounts[obj.cwd] = (cwdCounts[obj.cwd] || 0) + 1;
          }
        }
      }
    } catch {
      // JSON 파싱 실패 무시
    }
  }

  if (messages.length === 0) return null;

  // 가장 빈번한 cwd에서 프로젝트 매핑
  const primaryCwd = Object.entries(cwdCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || basePath;

  const relative = primaryCwd.replace(basePath + '/', '');
  const projectName = relative.split('/')[0] || path.basename(basePath);

  return {
    sessionId: path.basename(filePath, '.jsonl'),
    projectPath: path.join(basePath, projectName),
    projectName,
    firstMessage: messages[0]?.text || '(빈 세션)',
    messageCount: messages.length,
    startTime: messages[0]?.timestamp || '',
    endTime: messages[messages.length - 1]?.timestamp || '',
    filePath,
  };
}

export async function syncSessionsToDb(): Promise<number> {
  const db = getDb();
  const sessions = await parseAllSessions();
  let count = 0;

  // 프로젝트 경로 → ID 매핑
  const projects = db.prepare('SELECT id, path FROM projects').all() as Array<{
    id: string; path: string;
  }>;

  for (const session of sessions) {
    const project = projects.find(p => session.projectPath.startsWith(p.path));

    db.prepare(`
      INSERT INTO claude_sessions (id, project_id, file_path, first_message, message_count, started_at, last_activity)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        message_count = excluded.message_count,
        last_activity = excluded.last_activity
    `).run(
      session.sessionId,
      project?.id || null,
      session.filePath,
      session.firstMessage.slice(0, 200),
      session.messageCount,
      session.startTime,
      session.endTime,
    );

    count++;
  }

  return count;
}
