import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ChildProcess } from 'child_process';

// ── mock 설정 ──

const mockDb = {
  prepare: vi.fn(),
};
vi.mock('./db', () => ({
  getDb: () => mockDb,
}));

const mockExecAsync = vi.fn();
const mockSpawn = vi.fn();
vi.mock('child_process', () => ({
  exec: vi.fn(), // promisify용 placeholder
  spawn: (...args: unknown[]) => mockSpawn(...args),
}));
vi.mock('util', () => ({
  promisify: () => (...args: unknown[]) => mockExecAsync(...args),
}));

// 모듈 임포트 (mock 후)
let detectRunningProcesses: typeof import('./process-manager').detectRunningProcesses;
let startProcess: typeof import('./process-manager').startProcess;
let stopProcess: typeof import('./process-manager').stopProcess;
let getProcessConfigs: typeof import('./process-manager').getProcessConfigs;

beforeEach(async () => {
  vi.resetModules();

  // DB mock 초기화
  mockDb.prepare.mockReturnValue({
    all: vi.fn().mockReturnValue([]),
    get: vi.fn().mockReturnValue(undefined),
    run: vi.fn(),
  });

  // mock 재설정
  mockExecAsync.mockReset();
  mockSpawn.mockReset();

  // 모듈 재로드 (managed state 초기화)
  const mod = await import('./process-manager');
  detectRunningProcesses = mod.detectRunningProcesses;
  startProcess = mod.startProcess;
  stopProcess = mod.stopProcess;
  getProcessConfigs = mod.getProcessConfigs;
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── detectRunningProcesses ──

describe('detectRunningProcesses', () => {
  it('lsof 실패 시 빈 배열 반환', async () => {
    mockExecAsync.mockRejectedValue(new Error('lsof failed'));
    expect(await detectRunningProcesses()).toEqual([]);
  });

  it('lsof 출력 파싱', async () => {
    const lsofListenOutput = [
      'COMMAND  PID  USER  FD  TYPE  DEVICE  SIZE/OFF  NODE  NAME',
      'node    1234  user  30u  IPv4  0x1234  0t0  TCP  127.0.0.1:3000 (LISTEN)',
    ].join('\n');

    mockDb.prepare.mockImplementation((sql: string) => {
      if (sql.includes('process_logs')) {
        return { all: vi.fn().mockReturnValue([]) };
      }
      if (sql.includes('projects')) {
        return { all: vi.fn().mockReturnValue([]) };
      }
      return { all: vi.fn().mockReturnValue([]), run: vi.fn() };
    });

    let callCount = 0;
    mockExecAsync.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve({ stdout: lsofListenOutput });
      return Promise.resolve({ stdout: 'p1234\nfcwd\nn/Users/test/myproject\nftxt\n' });
    });

    const result = await detectRunningProcesses();
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      pid: 1234,
      port: 3000,
      command: 'node',
      cwd: '/Users/test/myproject',
    });
  });

  it('시스템 프로세스 필터링', async () => {
    const output = [
      'COMMAND  PID  USER  FD  TYPE  DEVICE  SIZE/OFF  NODE  NAME',
      'rapportd 500  user  30u  IPv4  0x1234  0t0  TCP  *:5000 (LISTEN)',
      'node    1234  user  30u  IPv4  0x1234  0t0  TCP  *:3000 (LISTEN)',
    ].join('\n');

    mockDb.prepare.mockImplementation((sql: string) => {
      if (sql.includes('process_logs')) return { all: vi.fn().mockReturnValue([]) };
      if (sql.includes('projects')) return { all: vi.fn().mockReturnValue([]) };
      return { all: vi.fn().mockReturnValue([]), run: vi.fn() };
    });

    let callCount = 0;
    mockExecAsync.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve({ stdout: output });
      return Promise.resolve({ stdout: '' });
    });

    const result = await detectRunningProcesses();
    expect(result).toHaveLength(1);
    expect(result[0].command).toBe('node');
  });

  it('시스템 포트(< 1024) 제외', async () => {
    const output = [
      'COMMAND  PID  USER  FD  TYPE  DEVICE  SIZE/OFF  NODE  NAME',
      'nginx   1000  user  30u  IPv4  0x1234  0t0  TCP  *:443 (LISTEN)',
    ].join('\n');

    mockDb.prepare.mockImplementation((sql: string) => {
      if (sql.includes('process_logs')) return { all: vi.fn().mockReturnValue([]) };
      if (sql.includes('projects')) return { all: vi.fn().mockReturnValue([]) };
      return { all: vi.fn().mockReturnValue([]), run: vi.fn() };
    });

    mockExecAsync.mockResolvedValue({ stdout: output });

    const result = await detectRunningProcesses();
    expect(result).toHaveLength(0);
  });

  it('DB 포트(5432, 27017 등) 제외', async () => {
    const output = [
      'COMMAND  PID  USER  FD  TYPE  DEVICE  SIZE/OFF  NODE  NAME',
      'postgres 2000 user  30u  IPv4  0x1234  0t0  TCP  *:5432 (LISTEN)',
    ].join('\n');

    mockDb.prepare.mockImplementation((sql: string) => {
      if (sql.includes('process_logs')) return { all: vi.fn().mockReturnValue([]) };
      if (sql.includes('projects')) return { all: vi.fn().mockReturnValue([]) };
      return { all: vi.fn().mockReturnValue([]), run: vi.fn() };
    });

    mockExecAsync.mockResolvedValue({ stdout: output });

    const result = await detectRunningProcesses();
    expect(result).toHaveLength(0);
  });

  it('프로젝트 매핑', async () => {
    const output = [
      'COMMAND  PID  USER  FD  TYPE  DEVICE  SIZE/OFF  NODE  NAME',
      'node    1234  user  30u  IPv4  0x1234  0t0  TCP  *:3000 (LISTEN)',
    ].join('\n');

    mockDb.prepare.mockImplementation((sql: string) => {
      if (sql.includes('process_logs')) return { all: vi.fn().mockReturnValue([]) };
      if (sql.includes('projects')) {
        return {
          all: vi.fn().mockReturnValue([
            { id: 'proj1', name: 'my-app', path: '/Users/test/projects/my-app' },
          ]),
        };
      }
      return { all: vi.fn().mockReturnValue([]), run: vi.fn() };
    });

    let callCount = 0;
    mockExecAsync.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve({ stdout: output });
      return Promise.resolve({ stdout: 'p1234\nfcwd\nn/Users/test/projects/my-app\n' });
    });

    const result = await detectRunningProcesses();
    expect(result[0].project_id).toBe('proj1');
    expect(result[0].project_name).toBe('my-app');
  });

  it('같은 PID 중복 제거', async () => {
    const output = [
      'COMMAND  PID  USER  FD  TYPE  DEVICE  SIZE/OFF  NODE  NAME',
      'node    1234  user  30u  IPv4  0x1234  0t0  TCP  *:3000 (LISTEN)',
      'node    1234  user  31u  IPv6  0x5678  0t0  TCP  *:3000 (LISTEN)',
    ].join('\n');

    mockDb.prepare.mockImplementation((sql: string) => {
      if (sql.includes('process_logs')) return { all: vi.fn().mockReturnValue([]) };
      if (sql.includes('projects')) return { all: vi.fn().mockReturnValue([]) };
      return { all: vi.fn().mockReturnValue([]), run: vi.fn() };
    });

    let callCount = 0;
    mockExecAsync.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve({ stdout: output });
      return Promise.resolve({ stdout: '' });
    });

    const result = await detectRunningProcesses();
    expect(result).toHaveLength(1);
  });

  it('cwd 병렬 조회 (Promise.allSettled)', async () => {
    const output = [
      'COMMAND  PID  USER  FD  TYPE  DEVICE  SIZE/OFF  NODE  NAME',
      'node    1111  user  30u  IPv4  0x1234  0t0  TCP  *:3000 (LISTEN)',
      'node    2222  user  30u  IPv4  0x5678  0t0  TCP  *:3001 (LISTEN)',
    ].join('\n');

    mockDb.prepare.mockImplementation((sql: string) => {
      if (sql.includes('process_logs')) return { all: vi.fn().mockReturnValue([]) };
      if (sql.includes('projects')) return { all: vi.fn().mockReturnValue([]) };
      return { all: vi.fn().mockReturnValue([]), run: vi.fn() };
    });

    let callCount = 0;
    mockExecAsync.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve({ stdout: output });
      if (callCount === 2) return Promise.resolve({ stdout: 'p1111\nfcwd\nn/path/a\n' });
      // 두 번째 pid cwd 조회 실패
      return Promise.reject(new Error('timeout'));
    });

    const result = await detectRunningProcesses();
    expect(result).toHaveLength(2);
    expect(result[0].cwd).toBe('/path/a');
    expect(result[1].cwd).toBe(''); // 실패한 것은 빈 문자열
  });
});

// ── startProcess ──

describe('startProcess', () => {
  it('존재하지 않는 config ID → 에러', async () => {
    mockDb.prepare.mockImplementation((sql: string) => {
      if (sql.includes('process_logs')) return { all: vi.fn().mockReturnValue([]) };
      return {
        get: vi.fn().mockReturnValue(undefined),
        all: vi.fn().mockReturnValue([]),
        run: vi.fn(),
      };
    });

    await expect(startProcess(999)).rejects.toThrow('프로세스 설정을 찾을 수 없습니다');
  });

  it('허용되지 않은 명령어 → 에러', async () => {
    mockDb.prepare.mockImplementation((sql: string) => {
      if (sql.includes('process_logs')) return { all: vi.fn().mockReturnValue([]) };
      if (sql.includes('process_configs')) {
        return {
          get: vi.fn().mockReturnValue({
            id: 1,
            command: 'rm -rf /',
            cwd: '/Users/test/project',
            port: 3000,
            project_path: '/Users/test/project',
          }),
        };
      }
      return { get: vi.fn().mockReturnValue(undefined), all: vi.fn().mockReturnValue([]), run: vi.fn() };
    });

    await expect(startProcess(1)).rejects.toThrow('허용되지 않은 명령어');
  });

  it('cwd가 프로젝트 경로 밖이면 에러', async () => {
    mockDb.prepare.mockImplementation((sql: string) => {
      if (sql.includes('process_logs')) return { all: vi.fn().mockReturnValue([]) };
      if (sql.includes('process_configs')) {
        return {
          get: vi.fn().mockReturnValue({
            id: 1,
            command: 'pnpm dev',
            cwd: '/etc/malicious',
            port: 3000,
            project_path: '/Users/test/project',
          }),
        };
      }
      return { get: vi.fn().mockReturnValue(undefined), all: vi.fn().mockReturnValue([]), run: vi.fn() };
    });

    await expect(startProcess(1)).rejects.toThrow('작업 디렉토리가 프로젝트 경로 밖에 있습니다');
  });

  it('정상 시작 시 spawn 호출 + DB 로그', async () => {
    const mockChild = {
      pid: 5678,
      unref: vi.fn(),
      stdout: null,
      stderr: null,
    } as unknown as ChildProcess;

    mockSpawn.mockReturnValue(mockChild);

    const mockRun = vi.fn();
    mockDb.prepare.mockImplementation((sql: string) => {
      if (sql.includes('process_logs') && sql.includes('SELECT')) {
        return { all: vi.fn().mockReturnValue([]) };
      }
      if (sql.includes('process_configs') || sql.includes('SELECT pc')) {
        return {
          get: vi.fn().mockReturnValue({
            id: 1,
            command: 'pnpm dev',
            cwd: '/Users/test/project',
            port: 3000,
            project_path: '/Users/test/project',
          }),
        };
      }
      if (sql.includes('INSERT INTO process_logs')) {
        return { run: mockRun };
      }
      return { all: vi.fn().mockReturnValue([]), get: vi.fn(), run: vi.fn() };
    });

    // detectRunningProcesses가 포트 충돌 확인 시 호출
    mockExecAsync.mockResolvedValue({ stdout: '' });

    const result = await startProcess(1);
    expect(result).toEqual({ pid: 5678, port: 3000 });
    expect(mockSpawn).toHaveBeenCalledWith('pnpm', ['dev'], expect.objectContaining({
      cwd: '/Users/test/project',
      detached: true,
    }));
    expect(mockRun).toHaveBeenCalledWith(1, 5678);
  });

  it('포트 충돌 시 에러', async () => {
    const lsofOutput = [
      'COMMAND  PID  USER  FD  TYPE  DEVICE  SIZE/OFF  NODE  NAME',
      'node    9999  user  30u  IPv4  0x1234  0t0  TCP  *:3000 (LISTEN)',
    ].join('\n');

    mockDb.prepare.mockImplementation((sql: string) => {
      if (sql.includes('process_logs') && sql.includes('SELECT')) {
        return { all: vi.fn().mockReturnValue([]) };
      }
      if (sql.includes('process_configs') || sql.includes('SELECT pc')) {
        return {
          get: vi.fn().mockReturnValue({
            id: 1,
            command: 'pnpm dev',
            cwd: '/Users/test/project',
            port: 3000,
            project_path: '/Users/test/project',
          }),
        };
      }
      if (sql.includes('projects')) {
        return { all: vi.fn().mockReturnValue([]) };
      }
      return { all: vi.fn().mockReturnValue([]), get: vi.fn(), run: vi.fn() };
    });

    let callCount = 0;
    mockExecAsync.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve({ stdout: lsofOutput });
      return Promise.resolve({ stdout: '' });
    });

    await expect(startProcess(1)).rejects.toThrow('포트 3000이 이미 사용 중입니다');
  });
});

// ── stopProcess ──

describe('stopProcess', () => {
  it('SIGTERM 전송 + DB 업데이트', () => {
    const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true);
    const mockRun = vi.fn();

    mockDb.prepare.mockImplementation((sql: string) => {
      if (sql.includes('process_logs') && sql.includes('SELECT')) {
        return { all: vi.fn().mockReturnValue([]) };
      }
      if (sql.includes('UPDATE process_logs')) {
        return { run: mockRun };
      }
      return { all: vi.fn().mockReturnValue([]), run: vi.fn() };
    });

    stopProcess(1234);

    expect(killSpy).toHaveBeenCalledWith(1234, 'SIGTERM');
    expect(mockRun).toHaveBeenCalledWith(1234);
    killSpy.mockRestore();
  });

  it('process.kill 실패 시 에러', () => {
    const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => {
      throw new Error('ESRCH');
    });

    mockDb.prepare.mockImplementation((sql: string) => {
      if (sql.includes('process_logs') && sql.includes('SELECT')) {
        return { all: vi.fn().mockReturnValue([]) };
      }
      return { all: vi.fn().mockReturnValue([]), run: vi.fn() };
    });

    expect(() => stopProcess(1234)).toThrow('프로세스 종료 실패');
    killSpy.mockRestore();
  });
});

// ── getProcessConfigs ──

describe('getProcessConfigs', () => {
  it('프로젝트 ID로 configs 조회', () => {
    const mockConfigs = [{ id: 1, label: 'Dev Server', command: 'pnpm dev' }];
    mockDb.prepare.mockImplementation((sql: string) => {
      if (sql.includes('process_logs')) return { all: vi.fn().mockReturnValue([]) };
      if (sql.includes('process_configs')) {
        return { all: vi.fn().mockReturnValue(mockConfigs) };
      }
      return { all: vi.fn().mockReturnValue([]) };
    });

    const result = getProcessConfigs('proj1');
    expect(result).toEqual(mockConfigs);
  });
});

// ── managed state restoration ──

describe('managed state restoration', () => {
  it('DB에서 실행 중인 pid 복원', async () => {
    const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true);

    mockDb.prepare.mockImplementation((sql: string) => {
      if (sql.includes('process_logs') && sql.includes('SELECT')) {
        return { all: vi.fn().mockReturnValue([{ pid: 1111 }]) };
      }
      if (sql.includes('projects')) return { all: vi.fn().mockReturnValue([]) };
      return { all: vi.fn().mockReturnValue([]), run: vi.fn() };
    });

    const lsofOutput = [
      'COMMAND  PID  USER  FD  TYPE  DEVICE  SIZE/OFF  NODE  NAME',
      'node    1111  user  30u  IPv4  0x1234  0t0  TCP  *:3000 (LISTEN)',
    ].join('\n');

    let callCount = 0;
    mockExecAsync.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve({ stdout: lsofOutput });
      return Promise.resolve({ stdout: '' });
    });

    const result = await detectRunningProcesses();
    expect(result).toHaveLength(1);
    expect(result[0].is_managed).toBe(true);

    killSpy.mockRestore();
  });

  it('죽은 프로세스는 DB 정리', async () => {
    const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => {
      throw new Error('ESRCH');
    });

    const mockRun = vi.fn();
    mockDb.prepare.mockImplementation((sql: string) => {
      if (sql.includes('process_logs') && sql.includes('SELECT')) {
        return { all: vi.fn().mockReturnValue([{ pid: 9999 }]) };
      }
      if (sql.includes('UPDATE process_logs')) {
        return { run: mockRun };
      }
      if (sql.includes('projects')) return { all: vi.fn().mockReturnValue([]) };
      return { all: vi.fn().mockReturnValue([]), run: vi.fn() };
    });

    mockExecAsync.mockResolvedValue({ stdout: '' });

    await detectRunningProcesses();
    expect(mockRun).toHaveBeenCalledWith(9999);

    killSpy.mockRestore();
  });
});
