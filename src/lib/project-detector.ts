import { existsSync, readFileSync } from 'fs';
import path from 'path';

interface DetectionResult {
  type: string;
  devCommand: string;
  expectedPort: number;
  isMonorepo: boolean;
  description: string | null;
  displayName: string | null;
}

function readPackageJson(projectPath: string): Record<string, unknown> | null {
  const pkgPath = path.join(projectPath, 'package.json');
  if (!existsSync(pkgPath)) return null;
  try {
    return JSON.parse(readFileSync(pkgPath, 'utf-8'));
  } catch {
    return null;
  }
}

function getReadmeDescription(projectPath: string): string | null {
  for (const name of ['README.md', 'readme.md', 'README.MD']) {
    const filePath = path.join(projectPath, name);
    if (existsSync(filePath)) {
      try {
        const content = readFileSync(filePath, 'utf-8');
        const lines = content.split('\n').filter(l => l.trim());
        // 첫 번째 # 제목 다음의 첫 텍스트 줄 또는 첫 줄
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('#')) continue;
          if (trimmed.startsWith('!') || trimmed.startsWith('[')) continue;
          if (trimmed.length > 5) return trimmed.slice(0, 200);
        }
      } catch { /* ignore */ }
    }
  }
  return null;
}

export function detectProjectType(projectPath: string): DetectionResult {
  const pkg = readPackageJson(projectPath) as Record<string, unknown> | null;
  const hasPnpmWorkspace = existsSync(path.join(projectPath, 'pnpm-workspace.yaml'));
  const isMonorepo = hasPnpmWorkspace || !!(pkg?.workspaces);

  const deps: Record<string, string> = {
    ...((pkg?.dependencies as Record<string, string>) || {}),
    ...((pkg?.devDependencies as Record<string, string>) || {}),
  };

  const scripts = (pkg?.scripts as Record<string, string>) || {};
  const description = getReadmeDescription(projectPath);
  const displayName = (pkg?.displayName as string) || (pkg?.name as string) || null;

  // Python 프로젝트
  if (existsSync(path.join(projectPath, 'requirements.txt')) ||
      existsSync(path.join(projectPath, 'pyproject.toml'))) {
    const hasUvicorn = existsSync(path.join(projectPath, 'requirements.txt')) &&
      readFileSync(path.join(projectPath, 'requirements.txt'), 'utf-8').includes('uvicorn');
    return {
      type: 'python',
      devCommand: hasUvicorn ? 'python -m uvicorn main:app --reload' : 'python main.py',
      expectedPort: 8000,
      isMonorepo: false,
      description,
      displayName,
    };
  }

  if (!pkg) {
    return { type: 'unknown', devCommand: '', expectedPort: 0, isMonorepo: false, description, displayName };
  }

  // 모노레포 먼저 체크
  if (isMonorepo) {
    const devCmd = scripts.dev || 'pnpm -r --parallel run dev';
    return { type: 'monorepo', devCommand: devCmd, expectedPort: 3000, isMonorepo: true, description, displayName };
  }

  // 프레임워크 감지
  if (deps['next']) {
    return { type: 'nextjs', devCommand: scripts.dev ? `pnpm dev` : 'pnpm dev', expectedPort: 3000, isMonorepo, description, displayName };
  }
  if (deps['@nestjs/core']) {
    return { type: 'nestjs', devCommand: scripts['start:dev'] ? 'pnpm start:dev' : 'pnpm dev', expectedPort: 3000, isMonorepo, description, displayName };
  }
  if (deps['hono']) {
    return { type: 'hono', devCommand: 'pnpm dev', expectedPort: 3000, isMonorepo, description, displayName };
  }
  if (deps['vue']) {
    return { type: 'vue', devCommand: 'pnpm dev', expectedPort: 5173, isMonorepo, description, displayName };
  }
  if (deps['expo'] || deps['react-native']) {
    return { type: 'expo', devCommand: 'pnpm start', expectedPort: 8081, isMonorepo, description, displayName };
  }
  if (deps['react'] && deps['vite']) {
    return { type: 'vite-react', devCommand: 'pnpm dev', expectedPort: 5173, isMonorepo, description, displayName };
  }
  if (deps['react']) {
    return { type: 'react', devCommand: 'pnpm dev', expectedPort: 3000, isMonorepo, description, displayName };
  }

  // 일반 Node.js
  if (scripts.dev) {
    return { type: 'node', devCommand: 'pnpm dev', expectedPort: 3000, isMonorepo, description, displayName };
  }

  return { type: 'node', devCommand: '', expectedPort: 0, isMonorepo, description, displayName };
}
