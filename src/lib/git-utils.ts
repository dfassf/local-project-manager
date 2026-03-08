import { existsSync } from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import type { CommitInfo, BranchInfo, TodoItem } from '@/types';

function gitExec(cmd: string, cwd: string): string {
  try {
    return execSync(cmd, { cwd, encoding: 'utf-8', timeout: 10000 }).trim();
  } catch {
    return '';
  }
}

export function getRecentCommits(projectPath: string, limit = 20): CommitInfo[] {
  if (!existsSync(path.join(projectPath, '.git'))) return [];

  const log = gitExec(
    `git log -${limit} --format="%H|||%s|||%an|||%ai|||%ar"`,
    projectPath
  );

  if (!log) return [];

  return log.split('\n').filter(Boolean).map(line => {
    const [hash, message, author, date, relative_date] = line.split('|||');
    return { hash, message, author, date, relative_date };
  });
}

export function getBranches(projectPath: string): BranchInfo[] {
  if (!existsSync(path.join(projectPath, '.git'))) return [];

  const output = gitExec(
    'git branch --format="%(HEAD)|||%(refname:short)|||%(committerdate:relative)"',
    projectPath
  );

  if (!output) return [];

  return output.split('\n').filter(Boolean).map(line => {
    const [head, name, last_commit] = line.split('|||');
    return { name, current: head.trim() === '*', last_commit };
  });
}

export function getCurrentBranch(projectPath: string): string | null {
  if (!existsSync(path.join(projectPath, '.git'))) return null;
  const branch = gitExec('git branch --show-current', projectPath);
  return branch || null;
}

export function getUncommittedChanges(projectPath: string): string[] {
  if (!existsSync(path.join(projectPath, '.git'))) return [];
  const status = gitExec('git status --porcelain', projectPath);
  if (!status) return [];
  return status.split('\n').filter(Boolean);
}

export function findTodosInCode(projectPath: string, limit = 50): TodoItem[] {
  try {
    const output = execSync(
      `grep -rn --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --include="*.vue" --include="*.py" -E "(TODO|FIXME|HACK):" ${JSON.stringify(projectPath)} 2>/dev/null | head -${limit}`,
      { encoding: 'utf-8', timeout: 10000 }
    ).trim();

    if (!output) return [];

    return output.split('\n').filter(Boolean).map(line => {
      const match = line.match(/^(.+?):(\d+):.*?(TODO|FIXME|HACK):\s*(.*)$/);
      if (!match) return null;
      const [, file, lineNum, type, text] = match;
      return {
        file: path.relative(projectPath, file),
        line: parseInt(lineNum),
        text: text.trim(),
        type: type as TodoItem['type'],
      };
    }).filter(Boolean) as TodoItem[];
  } catch {
    return [];
  }
}

export function getGitStatus(projectPath: string): {
  staged: number;
  modified: number;
  untracked: number;
} {
  if (!existsSync(path.join(projectPath, '.git'))) {
    return { staged: 0, modified: 0, untracked: 0 };
  }

  const status = gitExec('git status --porcelain', projectPath);
  if (!status) return { staged: 0, modified: 0, untracked: 0 };

  const lines = status.split('\n').filter(Boolean);
  let staged = 0, modified = 0, untracked = 0;

  for (const line of lines) {
    const x = line[0];
    const y = line[1];
    if (x === '?' && y === '?') untracked++;
    else if (x !== ' ' && x !== '?') staged++;
    if (y !== ' ' && y !== '?') modified++;
  }

  return { staged, modified, untracked };
}
