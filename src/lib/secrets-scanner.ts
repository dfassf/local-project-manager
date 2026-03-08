import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import path from 'path';

type FileType = 'pem' | 'key' | 'pub' | 'json' | 'sh' | 'other';

export interface SecretFile {
  name: string;
  path: string;
  type: FileType;
  size: number;
  group?: string;
}

export interface TelegramBot {
  name: string;
  description: string;
  token: string;
  chatId: string;
  project?: string;
}

export interface SecretCard {
  id: string;
  icon: string;
  title: string;
  subtitle?: string;
  tags: { label: string; color: string }[];
  instances?: { shape: string; ip?: string; ocpus?: number; memoryGb?: number; status?: string }[];
  files: SecretFile[];
  bots?: TelegramBot[];
}

function getFileType(filename: string): FileType {
  if (filename.endsWith('.pem')) return 'pem';
  if (filename.endsWith('.key')) return 'key';
  if (filename.endsWith('.pub')) return 'pub';
  if (filename.endsWith('.json') && filename !== 'config.json') return 'json';
  if (filename.endsWith('.sh')) return 'sh';
  return 'other';
}

function getFileGroup(filename: string, type: FileType): string {
  if (filename.startsWith('oci_api_key')) return 'API 키';
  if (filename.startsWith('ssh-key') || filename.startsWith('id_')) {
    return type === 'pub' ? 'SSH 키 (공개)' : 'SSH 키 (비밀)';
  }
  if (filename.endsWith('.pem') && !filename.startsWith('oci_')) return 'SSH 키';
  if (type === 'sh') return '스크립트';
  return '기타';
}

export function scanOracleAccount(dirPath: string): SecretCard | null {
  if (!existsSync(dirPath)) return null;

  const configPath = path.join(dirPath, 'config.json');
  let config: Record<string, unknown> = {};
  if (existsSync(configPath)) {
    try { config = JSON.parse(readFileSync(configPath, 'utf-8')); } catch { /* */ }
  }

  const account = (config.account as string) || path.basename(dirPath);
  const ociUsername = config.oci_username as string | undefined;
  const profile = config.profile_name as string | undefined;
  const region = config.region as string | undefined;

  const tags: SecretCard['tags'] = [];
  if (profile) tags.push({ label: `profile: ${profile}`, color: 'muted' });
  if (region) tags.push({ label: region, color: 'muted' });

  const instances: SecretCard['instances'] = [];
  const instData = config.instances as Record<string, Record<string, unknown>> | undefined;
  if (instData) {
    for (const inst of Object.values(instData)) {
      instances.push({
        shape: String(inst.shape || ''),
        ip: inst.ip ? String(inst.ip) : undefined,
        ocpus: inst.ocpus ? Number(inst.ocpus) : undefined,
        memoryGb: inst.memory_gb ? Number(inst.memory_gb) : undefined,
        status: inst.status ? String(inst.status) : undefined,
      });
    }
  }

  const files: SecretFile[] = [];
  for (const entry of readdirSync(dirPath)) {
    if (entry === '.DS_Store' || entry === 'config.json') continue;
    const fullPath = path.join(dirPath, entry);
    const stat = statSync(fullPath);
    if (stat.isFile()) {
      const type = getFileType(entry);
      files.push({ name: entry, path: fullPath, type, size: stat.size, group: getFileGroup(entry, type) });
    }
  }

  return {
    id: `oracle-${path.basename(dirPath)}`,
    icon: '☁',
    title: `Oracle · ${account}${ociUsername ? ` (${ociUsername})` : ''}`,
    subtitle: profile ? `OCI Profile: ${profile}` : undefined,
    tags,
    instances: instances.length > 0 ? instances : undefined,
    files,
  };
}

export function scanTelegram(dirPath: string): SecretCard | null {
  const botsPath = path.join(dirPath, 'bots.json');
  if (!existsSync(botsPath)) return null;

  let botsData: Record<string, unknown> = {};
  try { botsData = JSON.parse(readFileSync(botsPath, 'utf-8')); } catch { return null; }

  const botsMap = botsData.bots as Record<string, Record<string, string>> | undefined;
  if (!botsMap) return null;

  const bots: TelegramBot[] = Object.entries(botsMap).map(([name, data]) => ({
    name,
    description: data.description || '',
    token: data.token || '',
    chatId: data.chat_id || '',
    project: data.project,
  }));

  return {
    id: 'telegram',
    icon: '✈',
    title: 'Telegram · 봇 관리',
    subtitle: `${bots.length}개 봇`,
    tags: [],
    files: [],
    bots,
  };
}

export function scanSSH(dirPath: string): SecretCard | null {
  if (!existsSync(dirPath)) return null;

  const files: SecretFile[] = [];
  for (const entry of readdirSync(dirPath)) {
    if (entry === '.DS_Store') continue;
    const fullPath = path.join(dirPath, entry);
    const stat = statSync(fullPath);
    if (stat.isFile()) {
      const type = getFileType(entry);
      files.push({
        name: entry,
        path: fullPath,
        type,
        size: stat.size,
        group: type === 'pub' ? '공개 키' : '비밀 키',
      });
    }
  }

  if (files.length === 0) return null;

  return {
    id: 'ssh',
    icon: '⌨',
    title: 'SSH · 공용 키',
    subtitle: `${files.length}개 파일`,
    tags: [],
    files,
  };
}
