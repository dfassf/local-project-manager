import { execSync, spawn, ChildProcess } from 'child_process';
import { getDb } from './db';
import type { RunningProcess } from '@/types';

const ALLOWED_COMMANDS = /^(npm|pnpm|yarn|npx|node|ts-node|tsx|python|bun)/;

// 대시보드에서 시작한 프로세스 추적 (메모리)
const managedProcesses = new Map<number, ChildProcess>();

export function detectRunningProcesses(): RunningProcess[] {
  try {
    const output = execSync(
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

    for (const line of lines) {
      const parts = line.split(/\s+/);
      const command = parts[0];
      const pid = parseInt(parts[1]);
      const portMatch = parts[8]?.match(/:(\d+)$/);
      if (!portMatch || isNaN(pid)) continue;

      const port = parseInt(portMatch[1]);

      // 시스템 포트나 잘 알려진 서비스 포트 제외
      if (port < 1024 || [5432, 27017, 6379, 3306, 9200].includes(port)) continue;

      if (seen.has(pid)) continue;

      // PID의 작업 디렉토리 확인 (macOS lsof 출력 파싱)
      // lsof -p PID -Fn 출력 형태:
      //   pPID
      //   fcwd
      //   n/actual/cwd/path
      //   ftxt
      //   ...
      let cwd = '';
      try {
        const lsofOutput = execSync(`lsof -p ${pid} -Fn 2>/dev/null`, {
          encoding: 'utf-8',
          timeout: 3000,
        });
        const lsofLines = lsofOutput.split('\n');
        for (let i = 0; i < lsofLines.length; i++) {
          if (lsofLines[i] === 'fcwd' && lsofLines[i + 1]?.startsWith('n/')) {
            cwd = lsofLines[i + 1].slice(1); // 'n' 접두사 제거
            break;
          }
        }
      } catch { /* ignore */ }

      // 프로젝트 매핑
      let projectId: string | null = null;
      let projectName: string | null = null;
      for (const p of projects) {
        if (cwd && cwd.startsWith(p.path)) {
          projectId = p.id;
          projectName = p.name;
          break;
        }
      }

      // 대시보드에서 시작한 프로세스인지 확인
      const isManaged = managedProcesses.has(pid);

      seen.set(pid, {
        pid,
        port,
        command,
        cwd,
        project_id: projectId,
        project_name: projectName,
        is_managed: isManaged,
      });
    }

    return Array.from(seen.values());
  } catch {
    return [];
  }
}

export function startProcess(configId: number): { pid: number; port: number | null } {
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
    const running = detectRunningProcesses();
    const conflict = running.find(p => p.port === config.port);
    if (conflict) {
      throw new Error(`포트 ${config.port}이 이미 사용 중입니다 (PID: ${conflict.pid})`);
    }
  }

  const child = spawn(config.command, [], {
    cwd: config.cwd,
    shell: true,
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
  // 안전 검사: managed process인지 확인
  const isManaged = managedProcesses.has(pid);
  if (!isManaged) {
    throw new Error(`관리 대상이 아닌 프로세스입니다: ${pid}. 대시보드에서 시작한 프로세스만 중지할 수 있습니다.`);
  }

  try {
    // SIGTERM으로 우아하게 종료
    process.kill(pid, 'SIGTERM');

    // 5초 후에도 살아있으면 SIGKILL
    setTimeout(() => {
      try {
        process.kill(pid, 0); // 생존 확인
        process.kill(pid, 'SIGKILL');
      } catch {
        // 이미 종료됨
      }
    }, 5000);

    managedProcesses.delete(pid);

    // DB 업데이트
    const db = getDb();
    db.prepare(`
      UPDATE process_logs
      SET stopped_at = CURRENT_TIMESTAMP, stop_reason = 'manual'
      WHERE pid = ? AND stopped_at IS NULL
    `).run(pid);
  } catch (err) {
    managedProcesses.delete(pid);
    throw new Error(`프로세스 종료 실패: ${err}`);
  }
}

export function getProcessConfigs(projectId: string) {
  const db = getDb();
  return db.prepare('SELECT * FROM process_configs WHERE project_id = ?').all(projectId);
}
