export interface Project {
  id: string;
  name: string;
  display_name: string | null;
  path: string;
  group_name: string;
  project_type: string | null;
  is_monorepo: boolean;
  git_remote: string | null;
  dev_command: string | null;
  dev_port: number | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectWithStatus extends Project {
  last_commit_date: string | null;
  last_commit_message: string | null;
  current_branch: string | null;
  uncommitted_changes: number;
  running_port: number | null;
  running_pid: number | null;
  note_count: number;
}

export interface CommitInfo {
  hash: string;
  message: string;
  author: string;
  date: string;
  relative_date: string;
}

export interface BranchInfo {
  name: string;
  current: boolean;
  last_commit: string;
}

export interface Note {
  id: number;
  project_id: string;
  content: string;
  note_type: 'memo' | 'todo' | 'idea';
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

export interface AISummary {
  id: number;
  project_id: string;
  summary_type: 'status' | 'next_steps';
  content: string;
  model: string | null;
  created_at: string;
  expires_at: string | null;
}

export interface ProcessConfig {
  id: number;
  project_id: string;
  label: string;
  command: string;
  cwd: string;
  port: number | null;
  created_at: string;
}

export interface RunningProcess {
  pid: number;
  port: number;
  command: string;
  cwd: string;
  project_id: string | null;
  project_name: string | null;
  is_managed: boolean; // 대시보드에서 시작한 프로세스인지
}

export interface ClaudeSession {
  id: string;
  project_id: string | null;
  file_path: string;
  first_message: string | null;
  message_count: number;
  started_at: string | null;
  last_activity: string | null;
}

export interface ProjectDetail {
  project: Project;
  commits: CommitInfo[];
  branches: BranchInfo[];
  current_branch: string | null;
  uncommitted_changes: string[];
  todos: TodoItem[];
  notes: Note[];
  ai_summaries: AISummary[];
  claude_sessions: ClaudeSession[];
  process_status: RunningProcess | null;
}

export interface TodoItem {
  file: string;
  line: number;
  text: string;
  type: 'TODO' | 'FIXME' | 'HACK';
}
