import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── mock fs ──
const mockExistsSync = vi.fn();
const mockReadFileSync = vi.fn();
vi.mock('fs', () => ({
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
  readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
}));

import { detectProjectType } from './project-detector';

beforeEach(() => {
  mockExistsSync.mockReset();
  mockReadFileSync.mockReset();
});

describe('detectProjectType', () => {
  it('package.json 없으면 unknown', () => {
    mockExistsSync.mockReturnValue(false);
    const result = detectProjectType('/test/project');
    expect(result.type).toBe('unknown');
    expect(result.devCommand).toBe('');
  });

  it('Next.js 프로젝트 감지', () => {
    mockExistsSync.mockImplementation((p: string) => {
      if (p.endsWith('requirements.txt') || p.endsWith('pyproject.toml')) return false;
      if (p.endsWith('package.json')) return true;
      if (p.endsWith('pnpm-workspace.yaml')) return false;
      return false;
    });
    mockReadFileSync.mockReturnValue(JSON.stringify({
      name: 'my-next-app',
      dependencies: { next: '14.0.0', react: '18.0.0' },
      scripts: { dev: 'next dev' },
    }));

    const result = detectProjectType('/test/project');
    expect(result.type).toBe('nextjs');
    expect(result.devCommand).toBe('pnpm dev');
    expect(result.expectedPort).toBe(3000);
  });

  it('Python 프로젝트 감지 (uvicorn)', () => {
    mockExistsSync.mockImplementation((p: string) => {
      if (p.endsWith('requirements.txt')) return true;
      if (p.endsWith('pyproject.toml')) return false;
      return false;
    });
    mockReadFileSync.mockImplementation((p: string) => {
      if (p.toString().endsWith('requirements.txt')) return 'fastapi\nuvicorn\n';
      return '';
    });

    const result = detectProjectType('/test/project');
    expect(result.type).toBe('python');
    expect(result.devCommand).toContain('uvicorn');
    expect(result.expectedPort).toBe(8000);
  });

  it('Python 프로젝트 감지 (uvicorn 없음)', () => {
    mockExistsSync.mockImplementation((p: string) => {
      if (p.endsWith('requirements.txt')) return true;
      if (p.endsWith('pyproject.toml')) return false;
      return false;
    });
    mockReadFileSync.mockImplementation((p: string) => {
      if (p.toString().endsWith('requirements.txt')) return 'flask\n';
      return '';
    });

    const result = detectProjectType('/test/project');
    expect(result.type).toBe('python');
    expect(result.devCommand).toBe('python main.py');
  });

  it('Vue 프로젝트 감지', () => {
    mockExistsSync.mockImplementation((p: string) => {
      if (p.endsWith('requirements.txt') || p.endsWith('pyproject.toml')) return false;
      if (p.endsWith('package.json')) return true;
      if (p.endsWith('pnpm-workspace.yaml')) return false;
      return false;
    });
    mockReadFileSync.mockReturnValue(JSON.stringify({
      dependencies: { vue: '^3.0.0' },
      scripts: { dev: 'vite' },
    }));

    const result = detectProjectType('/test/project');
    expect(result.type).toBe('vue');
    expect(result.expectedPort).toBe(5173);
  });

  it('Vite + React 감지', () => {
    mockExistsSync.mockImplementation((p: string) => {
      if (p.endsWith('requirements.txt') || p.endsWith('pyproject.toml')) return false;
      if (p.endsWith('package.json')) return true;
      if (p.endsWith('pnpm-workspace.yaml')) return false;
      return false;
    });
    mockReadFileSync.mockReturnValue(JSON.stringify({
      dependencies: { react: '^18.0.0' },
      devDependencies: { vite: '^5.0.0' },
      scripts: { dev: 'vite' },
    }));

    const result = detectProjectType('/test/project');
    expect(result.type).toBe('vite-react');
    expect(result.expectedPort).toBe(5173);
  });

  it('NestJS 감지', () => {
    mockExistsSync.mockImplementation((p: string) => {
      if (p.endsWith('requirements.txt') || p.endsWith('pyproject.toml')) return false;
      if (p.endsWith('package.json')) return true;
      if (p.endsWith('pnpm-workspace.yaml')) return false;
      return false;
    });
    mockReadFileSync.mockReturnValue(JSON.stringify({
      dependencies: { '@nestjs/core': '^10.0.0' },
      scripts: { 'start:dev': 'nest start --watch' },
    }));

    const result = detectProjectType('/test/project');
    expect(result.type).toBe('nestjs');
  });

  it('Expo/React Native 감지', () => {
    mockExistsSync.mockImplementation((p: string) => {
      if (p.endsWith('requirements.txt') || p.endsWith('pyproject.toml')) return false;
      if (p.endsWith('package.json')) return true;
      if (p.endsWith('pnpm-workspace.yaml')) return false;
      return false;
    });
    mockReadFileSync.mockReturnValue(JSON.stringify({
      dependencies: { expo: '~49.0.0', 'react-native': '0.72.0' },
      scripts: { start: 'expo start' },
    }));

    const result = detectProjectType('/test/project');
    expect(result.type).toBe('expo');
    expect(result.expectedPort).toBe(8081);
  });

  it('Hono 감지', () => {
    mockExistsSync.mockImplementation((p: string) => {
      if (p.endsWith('requirements.txt') || p.endsWith('pyproject.toml')) return false;
      if (p.endsWith('package.json')) return true;
      if (p.endsWith('pnpm-workspace.yaml')) return false;
      return false;
    });
    mockReadFileSync.mockReturnValue(JSON.stringify({
      dependencies: { hono: '^3.0.0' },
      scripts: { dev: 'tsx watch src/index.ts' },
    }));

    const result = detectProjectType('/test/project');
    expect(result.type).toBe('hono');
  });

  it('모노레포 감지 (pnpm-workspace.yaml)', () => {
    mockExistsSync.mockImplementation((p: string) => {
      if (p.endsWith('requirements.txt') || p.endsWith('pyproject.toml')) return false;
      if (p.endsWith('package.json')) return true;
      if (p.endsWith('pnpm-workspace.yaml')) return true;
      return false;
    });
    mockReadFileSync.mockReturnValue(JSON.stringify({
      name: 'my-monorepo',
      scripts: { dev: 'turbo dev' },
    }));

    const result = detectProjectType('/test/project');
    expect(result.type).toBe('monorepo');
    expect(result.isMonorepo).toBe(true);
    expect(result.devCommand).toBe('turbo dev');
  });

  it('모노레포 감지 (workspaces 필드)', () => {
    mockExistsSync.mockImplementation((p: string) => {
      if (p.endsWith('requirements.txt') || p.endsWith('pyproject.toml')) return false;
      if (p.endsWith('package.json')) return true;
      if (p.endsWith('pnpm-workspace.yaml')) return false;
      return false;
    });
    mockReadFileSync.mockReturnValue(JSON.stringify({
      name: 'my-monorepo',
      workspaces: ['packages/*'],
    }));

    const result = detectProjectType('/test/project');
    expect(result.type).toBe('monorepo');
    expect(result.isMonorepo).toBe(true);
  });

  it('일반 Node.js (scripts.dev 있음)', () => {
    mockExistsSync.mockImplementation((p: string) => {
      if (p.endsWith('requirements.txt') || p.endsWith('pyproject.toml')) return false;
      if (p.endsWith('package.json')) return true;
      if (p.endsWith('pnpm-workspace.yaml')) return false;
      return false;
    });
    mockReadFileSync.mockReturnValue(JSON.stringify({
      name: 'my-tool',
      scripts: { dev: 'node index.js' },
    }));

    const result = detectProjectType('/test/project');
    expect(result.type).toBe('node');
    expect(result.devCommand).toBe('pnpm dev');
  });

  it('일반 Node.js (scripts.dev 없음)', () => {
    mockExistsSync.mockImplementation((p: string) => {
      if (p.endsWith('requirements.txt') || p.endsWith('pyproject.toml')) return false;
      if (p.endsWith('package.json')) return true;
      if (p.endsWith('pnpm-workspace.yaml')) return false;
      return false;
    });
    mockReadFileSync.mockReturnValue(JSON.stringify({
      name: 'my-lib',
    }));

    const result = detectProjectType('/test/project');
    expect(result.type).toBe('node');
    expect(result.devCommand).toBe('');
  });

  it('README에서 description 추출', () => {
    mockExistsSync.mockImplementation((p: string) => {
      if (p.endsWith('requirements.txt') || p.endsWith('pyproject.toml')) return false;
      if (p.endsWith('package.json')) return true;
      if (p.endsWith('pnpm-workspace.yaml')) return false;
      if (p.endsWith('README.md')) return true;
      return false;
    });
    mockReadFileSync.mockImplementation((p: string) => {
      if (p.toString().endsWith('README.md')) return '# My Project\n\nA really cool project for testing.\n';
      return JSON.stringify({ name: 'test', scripts: { dev: 'node index.js' } });
    });

    const result = detectProjectType('/test/project');
    expect(result.description).toBe('A really cool project for testing.');
  });

  it('displayName은 package.json name에서 가져옴', () => {
    mockExistsSync.mockImplementation((p: string) => {
      if (p.endsWith('requirements.txt') || p.endsWith('pyproject.toml')) return false;
      if (p.endsWith('package.json')) return true;
      if (p.endsWith('pnpm-workspace.yaml')) return false;
      return false;
    });
    mockReadFileSync.mockReturnValue(JSON.stringify({
      name: '@scope/my-package',
      scripts: { dev: 'tsx watch' },
    }));

    const result = detectProjectType('/test/project');
    expect(result.displayName).toBe('@scope/my-package');
  });
});
