import { spawn } from 'child_process';
import { getDb } from './db';
import { getRecentCommits, getCurrentBranch, findTodosInCode, getGitStatus } from './git-utils';
import type { Project, AISummary } from '@/types';

function runClaude(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const env = { ...process.env };
    delete env.CLAUDECODE;

    // 프롬프트를 shell에서 echo로 pipe
    const child = spawn('sh', [
      '-c',
      `echo ${JSON.stringify(prompt)} | claude -p --model haiku --effort low --output-format text --no-session-persistence`
    ], {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data: Buffer) => { stdout += data.toString(); });
    child.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });

    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(`claude 종료 코드 ${code}: ${stderr}`));
      }
    });

    child.on('error', reject);

    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error('AI 분석 타임아웃 (120초)'));
    }, 120000);

    child.on('close', () => clearTimeout(timer));
  });
}

export async function analyzeProject(project: Project): Promise<{
  status: string;
  nextSteps: string[];
}> {
  // 캐시 확인 (24시간 이내)
  const db = getDb();
  const cached = db.prepare(`
    SELECT content, summary_type FROM ai_summaries
    WHERE project_id = ? AND expires_at > datetime('now')
    ORDER BY created_at DESC
  `).all(project.id) as AISummary[];

  if (cached.length >= 2) {
    const statusEntry = cached.find(c => c.summary_type === 'status');
    const stepsEntry = cached.find(c => c.summary_type === 'next_steps');
    if (statusEntry && stepsEntry) {
      return {
        status: statusEntry.content,
        nextSteps: stepsEntry.content.split('\n').filter(Boolean),
      };
    }
  }

  // 데이터 수집
  const commits = getRecentCommits(project.path, 15);
  const branch = getCurrentBranch(project.path);
  const todos = findTodosInCode(project.path, 10);
  const gitStatus = getGitStatus(project.path);

  // Claude 세션 정보
  const sessions = db.prepare(`
    SELECT first_message, last_activity FROM claude_sessions
    WHERE project_id = ?
    ORDER BY last_activity DESC
    LIMIT 5
  `).all(project.id) as Array<{ first_message: string; last_activity: string }>;

  const prompt = `다음 프로젝트의 현재 상태를 분석하고 다음에 할 작업을 제안해주세요.

프로젝트: ${project.display_name || project.name}
타입: ${project.project_type || '알 수 없음'}
${project.description ? `설명: ${project.description}` : ''}

현재 브랜치: ${branch || '없음'}
Git 상태: staged ${gitStatus.staged}, modified ${gitStatus.modified}, untracked ${gitStatus.untracked}

최근 커밋 (최신순):
${commits.length > 0 ? commits.map(c => `- ${c.relative_date}: ${c.message}`).join('\n') : '(커밋 없음)'}

코드 내 TODO (${todos.length}건):
${todos.slice(0, 5).map(t => `- ${t.file}:${t.line} ${t.type}: ${t.text}`).join('\n') || '(없음)'}

${sessions.length > 0 ? `최근 Claude Code 작업:\n${sessions.map(s => `- ${s.first_message}`).join('\n')}` : ''}

반드시 아래 JSON 형식으로만 응답해주세요 (다른 텍스트 없이):
{
  "status": "현재 상태 요약 (2-3문장, 한국어)",
  "nextSteps": ["다음 단계 1", "다음 단계 2", "다음 단계 3"]
}`;

  try {
    const text = await runClaude(prompt);

    // JSON 추출
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('AI 응답에서 JSON을 찾을 수 없습니다');

    const parsed = JSON.parse(jsonMatch[0]);

    // 캐시에 저장 (24시간)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    db.prepare(`
      INSERT INTO ai_summaries (project_id, summary_type, content, model, expires_at)
      VALUES (?, 'status', ?, 'claude-local', ?)
    `).run(project.id, parsed.status, expiresAt);

    db.prepare(`
      INSERT INTO ai_summaries (project_id, summary_type, content, model, expires_at)
      VALUES (?, 'next_steps', ?, 'claude-local', ?)
    `).run(project.id, parsed.nextSteps.join('\n'), expiresAt);

    return parsed;
  } catch (err) {
    return {
      status: `AI 분석 실패: ${err instanceof Error ? err.message : '알 수 없는 오류'}`,
      nextSteps: [],
    };
  }
}

export function getCachedSummaries(projectId: string): AISummary[] {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM ai_summaries
    WHERE project_id = ? AND expires_at > datetime('now')
    ORDER BY created_at DESC
  `).all(projectId) as AISummary[];
}
