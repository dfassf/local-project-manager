import { exec, spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import { getDb } from './db';
import type { RunningProcess } from '@/types';

const execAsync = promisify(exec);

const ALLOWED_COMMANDS = /^(npm|pnpm|yarn|npx|node|ts-node|tsx|python|bun)/;
const SYSTEM_COMMANDS = new Set(['rapportd', 'ControlCe', 'SystemUIS', 'Dropbox', 'Google', 'com.apple', 'mDNSRespo', 'loginwindo']);

// 대시보드에서 시작한 프로세스 추적 (메모리)
const managedProcesses = new Map<number, ChildProcess>();
// 서버 재시작 후 DB에서 복원된 managed PID
const restoredManagedPids = new Set<number>();
let managedStateRestored = false;

function ensureManagedStateRestored() {
  if (managedStateRestored) return;
  managedStateRestored = true;

  try {
    const db = getDb();
    const logs = db.prepare(
      'SELECT pid FROM process_logs WHERE stopped_at IS NULL'
    ).all() as { pid: number }[];

    for (const log of logs) {
      try {
        process.kill(log.pid, 0); // 생존 확인
        restoredManagedPids.add(log.pid);
      } catch {
        // 프로세스가 이미 죽었으면 DB 정리
        db.prepare(
          `UPDATE process_logs SET stopped_at = CURRENT_TIMESTAMP, stop_reason = 'crashed'
           WHERE pid = ? AND stopped_at IS NULL`
        ).run(log.pid);
      }
    }
  } catch { /* ignore */ }
}

export async function detectRunningProcesses(): Promise<RunningProcess[]> {
  ensureManagedStateRestored();

  try {
    const { stdout: output } = await execAsync(
      'lsof -iTCP -sTCP:LISTEN -P -n 2>/dev/null',
      { encoding: 'utf-8', timeout: 5000 }
    );

    const lines = output.split('\n').slice(1).filter(Boolean);
    const seen = new Map<number, RunningProcess>();
    const db = getDb();

    // DB에서 모든 프로젝트 경로 가져오기
    const projects = db.prepare('SELECT id, name, path FROM projects').all() as Array<{
      id: string; name: string; path: string;
    }>;

    // 각 PID의 cwd를 병렬로 조회
    const pidEntries: { pid: number; port: number; command: string }[] = [];
    for (const line of lines) {
      const parts = line.split(/\s+/);
      const command = parts[0];
      const pid = parseInt(parts[1]);
      const portMatch = parts[8]?.match(/:(\d+)$/);
      if (!portMatch || isNaN(pid)) continue;

      const port = parseInt(portMatch[1]);

      // 시스템 포트, 서비스 포트, 시스템 프로세스 제외
      if (port < 1024 || [5432, 27017, 6379, 3306, 9200].includes(port)) continue;
      if (SYSTEM_COMMANDS.has(command)) continue;
      if (seen.has(pid)) continue;

      seen.set(pid, { pid, port, command, cwd: '', project_id: null, project_name: null, is_managed: false });
      pidEntries.push({ pid, port, command });
    }

    // 각 PID의 cwd를 병렬 조회
    const cwdResults = await Promise.allSettled(
      pidEntries.map(async ({ pid }) => {
        const { stdout } = await execAsync(`lsof -p ${pid} -Fn 2>/dev/null`, {
          encoding: 'utf-8',
          timeout: 3000,
        });
        const lsofLines = stdout.split('\n');
        for (let i = 0; i < lsofLines.length; i++) {
          if (lsofLines[i] === 'fcwd' && lsofLines[i + 1]?.startsWith('n/')) {
            return { pid, cwd: lsofLines[i + 1].slice(1) };
          }
        }
        return { pid, cwd: '' };
      })
    );

    for (const result of cwdResults) {
      if (result.status !== 'fulfilled') continue;
      const { pid, cwd } = result.value;
      const entry = seen.get(pid);
      if (!entry) continue;

      entry.cwd = cwd;

      // 프로젝트 매핑
      for (const p of projects) {
        if (cwd && cwd.startsWith(p.path)) {
          entry.project_id = p.id;
          entry.project_name = p.name;
          break;
        }
      }

      // 대시보드에서 시작한 프로세스인지 확인 (메모리 + DB 복원)
      entry.is_managed = managedProcesses.has(pid) || restoredManagedPids.has(pid);
    }

    return Array.from(seen.values());
  } catch {
    return [];
  }
}

export async function startProcess(configId: number): Promise<{ pid: number; port: number | null }> {
  const db = getDb();
  const config = db.prepare(`
    SELECT pc.*, p.path as project_path
    FROM process_configs pc
    JOIN projects p ON p.id = pc.project_id
    WHERE pc.id = ?
  `).get(configId) as { id: number; command: string; cwd: string; port: number | null; project_path: string } | undefined;

  if (!config) throw new Error('프로세스 설정을 찾을 수 없습니다');

  // 안전 검사: 허용된 명령어인지
  if (!ALLOWED_COMMANDS.test(config.command)) {
    throw new Error(`허용되지 않은 명령어: ${config.command}`);
  }

  // 안전 검사: 작업 디렉토리가 프로젝트 내부인지
  if (!config.cwd.startsWith(config.project_path)) {
    throw new Error('작업 디렉토리가 프로젝트 경로 밖에 있습니다');
  }

  // 포트 충돌 확인
  if (config.port) {
    const running = await detectRunningProcesses();
    const conflict = running.find(p => p.port === config.port);
    if (conflict) {
      throw new Error(`포트 ${config.port}이 이미 사용 중입니다 (PID: ${conflict.pid})`);
    }
  }

  const [cmd, ...args] = config.command.split(/\s+/);
  const child = spawn(cmd, args, {
    cwd: config.cwd,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.unref();

  if (child.pid) {
    managedProcesses.set(child.pid, child);

    // DB에 로그
    db.prepare(`
      INSERT INTO process_logs (config_id, pid, started_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `).run(config.id, child.pid);
  }

  return { pid: child.pid || 0, port: config.port };
}

export function stopProcess(pid: number): void {
  const isManaged = managedProcesses.has(pid) || restoredManagedPids.has(pid);

  try {
    process.kill(pid, 'SIGTERM');

    // managed 프로세스는 5초 후에도 살아있으면 SIGKILL
    if (isManaged) {
      setTimeout(() => {
        try {
          process.kill(pid, 0);
          process.kill(pid, 'SIGKILL');
        } catch { /* 이미 종료됨 */ }
      }, 5000);
    }

    managedProcesses.delete(pid);
    restoredManagedPids.delete(pid);

    // DB 업데이트
    const db = getDb();
    db.prepare(`
      UPDATE process_logs
      SET stopped_at = CURRENT_TIMESTAMP, stop_reason = 'manual'
      WHERE pid = ? AND stopped_at IS NULL
    `).run(pid);
  } catch (err) {
    managedProcesses.delete(pid);
    restoredManagedPids.delete(pid);
    throw new Error(`프로세스 종료 실패: ${err}`);
  }
}

export function getProcessConfigs(projectId: string) {
  const db = getDb();
  return db.prepare('SELECT * FROM process_configs WHERE project_id = ?').all(projectId);
}
