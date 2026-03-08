import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import path from 'path';
import { scanOracleAccount, scanTelegram, scanSSH } from '@/lib/secrets-scanner';
import type { SecretCard } from '@/lib/secrets-scanner';

const SECRETS_DIR = path.join(process.cwd(), '.secrets');

export async function GET() {
  if (!existsSync(SECRETS_DIR)) {
    return NextResponse.json({ error: '.secrets 디렉토리가 없습니다' }, { status: 404 });
  }

  const cards: SecretCard[] = [];

  // Oracle 계정들 (oracle/ 하위 디렉토리 각각)
  const oraclePath = path.join(SECRETS_DIR, 'oracle');
  if (existsSync(oraclePath)) {
    for (const entry of readdirSync(oraclePath)) {
      if (entry === '.DS_Store') continue;
      const fullPath = path.join(oraclePath, entry);
      if (statSync(fullPath).isDirectory()) {
        const card = scanOracleAccount(fullPath);
        if (card) cards.push(card);
      }
    }
  }

  // SSH
  const sshCard = scanSSH(path.join(SECRETS_DIR, 'ssh'));
  if (sshCard) cards.push(sshCard);

  // Telegram
  const tgCard = scanTelegram(path.join(SECRETS_DIR, 'telegram'));
  if (tgCard) cards.push(tgCard);

  return NextResponse.json(cards);
}

export async function POST(request: NextRequest) {
  try {
    const { filePath } = await request.json();
    if (!filePath || !filePath.startsWith(SECRETS_DIR)) {
      return NextResponse.json({ error: '잘못된 경로' }, { status: 400 });
    }
    if (!existsSync(filePath)) {
      return NextResponse.json({ error: '파일이 없습니다' }, { status: 404 });
    }

    const content = readFileSync(filePath, 'utf-8');
    return NextResponse.json({ content });
  } catch {
    return NextResponse.json({ error: '파일 읽기 실패' }, { status: 500 });
  }
}
