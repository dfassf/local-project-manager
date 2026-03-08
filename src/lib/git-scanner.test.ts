import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── mock 설정 ──

const mockExistsSync = vi.fn();
const mockReaddirSync = vi.fn();
const mockStatSync = vi.fn();
vi.mock('fs', () => ({
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
  readdirSync: (...args: unknown[]) => mockReaddirSync(...args),
  statSync: (...args: unknown[]) => mockStatSync(...args),
  readFileSync: vi.fn().mockReturnValue('{}'),
}));

const mockDb = {
  prepare: vi.fn(),
};
vi.mock('./db', () => ({
  getDb: () => mockDb,
}));

vi.mock('./project-detector', () => ({
  detectProjectType: vi.fn().mockReturnValue({
    type: 'node',
    devCommand: 'pnpm dev',
    expectedPort: 3000,
    isMonorepo: false,
    description: null,
    displayName: null,
  }),
}));

const mockSimpleGit = vi.fn();
vi.mock('simple-git', () => ({
  default: (...args: unknown[]) => mockSimpleGit(...args),
}));

const mockExecSync = vi.fn();
vi.mock('child_process', () => ({
  execSync: (...args: unknown[]) => mockExecSync(...args),
}));

import { getProjectStats, scanAllProjects } from './git-scanner';

beforeEach(() => {
  mockExistsSync.mockReset();
  mockReaddirSync.mockReset();
  mockStatSync.mockReset();
  mockExecSync.mockReset();
  mockSimpleGit.mockReset();
  mockDb.prepare.mockReset();
});

// ── getProjectStats ──

describe('getProjectStats', () => {
  it('.git 없으면 null 반환', () => {
    mockExistsSync.mockReturnValue(false);
    const result = getProjectStats('/test/project');
    expect(result).toEqual({ lastCommitDate: null, lastCommitMessage: null });
  });

  it('git log 파싱', () => {
    mockExistsSync.mockReturnValue(true);
    mockExecSync.mockReturnValue('2024-01-15 10:30:00 +0900|||feat: add login page\n');

    const result = getProjectStats('/test/project');
    expect(result.lastCommitDate).toBe('2024-01-15 10:30:00 +0900');
    expect(result.lastCommitMessage).toBe('feat: add login page');
  });

  it('빈 로그 → null', () => {
    mockExistsSync.mockReturnValue(true);
    mockExecSync.mockReturnValue('');

    const result = getProjectStats('/test/project');
    expect(result).toEqual({ lastCommitDate: null, lastCommitMessage: null });
  });

  it('git log 실패 → null', () => {
    mockExistsSync.mockReturnValue(true);
    mockExecSync.mockImplementation(() => { throw new Error('not a git repo'); });

    const result = getProjectStats('/test/project');
    expect(result).toEqual({ lastCommitDate: null, lastCommitMessage: null });
  });

  it('커밋 메시지에 ||| 포함', () => {
    mockExistsSync.mockReturnValue(true);
    mockExecSync.mockReturnValue('2024-01-15|||fix: handle ||| in strings\n');

    const result = getProjectStats('/test/project');
    expect(result.lastCommitDate).toBe('2024-01-15');
    expect(result.lastCommitMessage).toBe('fix: handle ||| in strings');
  });
});

// ── scanAllProjects ──

describe('scanAllProjects', () => {
  it('scan_directories가 비어있으면 0 반환', async () => {
    mockDb.prepare.mockReturnValue({
      all: vi.fn().mockReturnValue([]),
      get: vi.fn(),
      run: vi.fn(),
    });

    const count = await scanAllProjects();
    expect(count).toBe(0);
  });

  it('디렉토리가 존재하지 않으면 스킵', async () => {
    mockDb.prepare.mockReturnValue({
      all: vi.fn().mockReturnValue([
        { path: '/nonexistent/dir', label: 'Test', slug: 'test' },
      ]),
      get: vi.fn(),
      run: vi.fn(),
    });
    mockExistsSync.mockReturnValue(false);

    const count = await scanAllProjects();
    expect(count).toBe(0);
  });

  it('숨김 폴더, EXCLUDE_DIRS 제외', async () => {
    mockDb.prepare.mockImplementation((sql: string) => {
      if (sql.includes('scan_directories')) {
        return {
          all: vi.fn().mockReturnValue([
            { path: '/test/repos', label: 'Test', slug: 'test' },
          ]),
        };
      }
      return { all: vi.fn().mockReturnValue([]), get: vi.fn().mockReturnValue(undefined), run: vi.fn() };
    });

    mockExistsSync.mockImplementation((p: string) => {
      if (p === '/test/repos') return true;
      if (p.endsWith('package.json')) return true;
      if (p.endsWith('.git')) return true;
      return false;
    });

    mockReaddirSync.mockReturnValue([
      { name: '.hidden', isDirectory: () => true },
      { name: 'node_modules', isDirectory: () => true },
      { name: 'project-command-center', isDirectory: () => true },
      { name: 'valid-project', isDirectory: () => true },
      { name: 'readme.txt', isDirectory: () => false },
    ]);

    mockSimpleGit.mockReturnValue({
      getRemotes: vi.fn().mockResolvedValue([]),
    });

    const count = await scanAllProjects();
    expect(count).toBe(1); // valid-project만
  });

  it('프로젝트 감지 + DB upsert', async () => {
    const mockRun = vi.fn();
    const mockGet = vi.fn().mockReturnValue(undefined);

    mockDb.prepare.mockImplementation((sql: string) => {
      if (sql.includes('scan_directories')) {
        return {
          all: vi.fn().mockReturnValue([
            { path: '/test/repos', label: 'Personal', slug: 'personal' },
          ]),
        };
      }
      if (sql.includes('SELECT group_name')) {
        return { get: mockGet };
      }
      if (sql.includes('SELECT id FROM process_configs')) {
        return { get: vi.fn().mockReturnValue(undefined) };
      }
      return { all: vi.fn().mockReturnValue([]), get: mockGet, run: mockRun };
    });

    mockExistsSync.mockImplementation((p: string) => {
      if (p === '/test/repos') return true;
      if (p.endsWith('package.json')) return true;
      if (p.endsWith('.git')) return true;
      return false;
    });

    mockReaddirSync.mockReturnValue([
      { name: 'my-app', isDirectory: () => true },
    ]);

    mockSimpleGit.mockReturnValue({
      getRemotes: vi.fn().mockResolvedValue([
        { name: 'origin', refs: { fetch: 'git@github.com:user/my-app.git' } },
      ]),
    });

    const count = await scanAllProjects();
    expect(count).toBe(1);
    // INSERT 호출 확인 (projects 테이블)
    expect(mockRun).toHaveBeenCalled();
  });

  it('기존 group_name 유지', async () => {
    const mockRun = vi.fn();

    mockDb.prepare.mockImplementation((sql: string) => {
      if (sql.includes('scan_directories')) {
        return {
          all: vi.fn().mockReturnValue([
            { path: '/test/repos', label: 'Default', slug: 'default' },
          ]),
        };
      }
      if (sql.includes('SELECT group_name')) {
        return { get: vi.fn().mockReturnValue({ group_name: 'Custom Group' }) };
      }
      if (sql.includes('SELECT id FROM process_configs')) {
        return { get: vi.fn().mockReturnValue({ id: 1 }) }; // 이미 존재
      }
      return { all: vi.fn().mockReturnValue([]), get: vi.fn().mockReturnValue(undefined), run: mockRun };
    });

    mockExistsSync.mockImplementation((p: string) => {
      if (p === '/test/repos') return true;
      if (p.endsWith('package.json')) return true;
      if (p.endsWith('.git')) return false;
      return false;
    });

    mockReaddirSync.mockReturnValue([
      { name: 'my-app', isDirectory: () => true },
    ]);

    await scanAllProjects();

    // run이 'Custom Group'과 함께 호출되었는지 확인
    const insertCall = mockRun.mock.calls.find(
      (call: unknown[]) => call.includes('Custom Group')
    );
    expect(insertCall).toBeTruthy();
  });
});
