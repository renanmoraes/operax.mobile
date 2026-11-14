import { Platform } from 'react-native';
import type { SQLiteDatabase } from 'expo-sqlite';
import { openSqlite } from './openSqlite';

/**
 * Banco local do app (SQLite, `operax.db`), que vem junto com o app e funciona sem internet.
 *
 * - `error_logs`: erros do celular esperando envio (e os enviados, por 7 dias, para o suporte).
 * - `breadcrumbs`: as últimas ações (tela, toque, chamada à API) — o "o que a pessoa fez antes do erro".
 * - `kv`: cache de configuração e dados para uso offline.
 *
 * No navegador (versão web, só para teste) cai num armazenamento em memória/localStorage com a
 * mesma interface. Nada aqui lança: o banco local nunca pode ser o motivo de o app quebrar.
 */

export type LocalErrorRow = { id: number; created_at: string; level: string; message: string; trace: string | null; context: string | null; meta: string | null; attempts: number };
export type Breadcrumb = { at: string; kind: 'screen' | 'tap' | 'api' | 'action'; label: string; data?: Record<string, unknown> };

const SCHEMA_VERSION = 1;
const BREADCRUMB_KEEP = 200;
const SENT_KEEP_DAYS = 7;

let dbPromise: Promise<SQLiteDatabase | null> | null = null;

async function open(): Promise<SQLiteDatabase | null> {
  if (Platform.OS === 'web') return null;
  try {
    const db = await openSqlite();
    if (!db) return null;
    await migrate(db);
    return db;
  } catch {
    return null;
  }
}

async function migrate(db: SQLiteDatabase) {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const v = row?.user_version ?? 0;
  if (v < 1) {
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS error_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT NOT NULL,
        level TEXT NOT NULL,
        message TEXT NOT NULL,
        trace TEXT,
        context TEXT,
        meta TEXT,
        attempts INTEGER NOT NULL DEFAULT 0,
        sent_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_error_logs_pending ON error_logs (sent_at, id);
      CREATE TABLE IF NOT EXISTS breadcrumbs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        at TEXT NOT NULL,
        kind TEXT NOT NULL,
        label TEXT NOT NULL,
        data TEXT
      );
      CREATE TABLE IF NOT EXISTS kv (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
  }
  if (v < SCHEMA_VERSION) await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
}

export function localDb(): Promise<SQLiteDatabase | null> {
  dbPromise ??= open();
  return dbPromise;
}

// ---------- fallback web (memória + localStorage) ----------
const mem = { errors: [] as (LocalErrorRow & { sent_at: string | null })[], crumbs: [] as Breadcrumb[], kv: new Map<string, string>(), seq: 1 };
const WEB_ERRORS = 'operax_local_errors';
function webLoad() {
  try {
    const raw = globalThis.localStorage?.getItem(WEB_ERRORS);
    if (raw && !mem.errors.length) {
      mem.errors = JSON.parse(raw);
      mem.seq = Math.max(1, ...mem.errors.map((e) => e.id + 1));
    }
  } catch {
    // sem localStorage
  }
}
function webSave() {
  try {
    globalThis.localStorage?.setItem(WEB_ERRORS, JSON.stringify(mem.errors.slice(-100)));
  } catch {
    // cheio
  }
}

// ---------- erros ----------
export async function insertError(e: { created_at: string; level: string; message: string; trace?: string | null; context?: string | null; meta: Record<string, unknown> }): Promise<void> {
  try {
    const db = await localDb();
    if (!db) {
      webLoad();
      mem.errors.push({ id: mem.seq++, created_at: e.created_at, level: e.level, message: e.message, trace: e.trace ?? null, context: e.context ?? null, meta: JSON.stringify(e.meta), attempts: 0, sent_at: null });
      webSave();
      return;
    }
    await db.runAsync('INSERT INTO error_logs (created_at, level, message, trace, context, meta) VALUES (?, ?, ?, ?, ?, ?)', [e.created_at, e.level, e.message, e.trace ?? null, e.context ?? null, JSON.stringify(e.meta)]);
  } catch {
    // sem banco: o erro se perde, mas o app segue
  }
}

export async function pendingErrors(limit = 50): Promise<LocalErrorRow[]> {
  try {
    const db = await localDb();
    if (!db) {
      webLoad();
      return mem.errors.filter((e) => !e.sent_at).slice(0, limit);
    }
    return await db.getAllAsync<LocalErrorRow>('SELECT id, created_at, level, message, trace, context, meta, attempts FROM error_logs WHERE sent_at IS NULL ORDER BY id LIMIT ?', [limit]);
  } catch {
    return [];
  }
}

export async function markErrorsSent(ids: number[]): Promise<void> {
  if (!ids.length) return;
  try {
    const now = new Date().toISOString();
    const db = await localDb();
    if (!db) {
      mem.errors.forEach((e) => ids.includes(e.id) && (e.sent_at = now));
      webSave();
      return;
    }
    await db.runAsync(`UPDATE error_logs SET sent_at = ? WHERE id IN (${ids.map(() => '?').join(',')})`, [now, ...ids]);
    // Enviados ficam 7 dias (o suporte pode pedir para ver no aparelho) e depois saem.
    const cutoff = new Date(Date.now() - SENT_KEEP_DAYS * 86_400_000).toISOString();
    await db.runAsync('DELETE FROM error_logs WHERE sent_at IS NOT NULL AND sent_at < ?', [cutoff]);
  } catch {
    // tenta de novo depois
  }
}

export async function bumpErrorAttempts(ids: number[]): Promise<void> {
  if (!ids.length) return;
  try {
    const db = await localDb();
    if (!db) return;
    await db.runAsync(`UPDATE error_logs SET attempts = attempts + 1 WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
    // Fila nunca cresce sem limite: guarda os 500 pendentes mais novos.
    await db.runAsync('DELETE FROM error_logs WHERE sent_at IS NULL AND id NOT IN (SELECT id FROM error_logs WHERE sent_at IS NULL ORDER BY id DESC LIMIT 500)', []);
  } catch {
    // ignora
  }
}

export async function countErrors(): Promise<{ pending: number; sent: number }> {
  try {
    const db = await localDb();
    if (!db) {
      webLoad();
      return { pending: mem.errors.filter((e) => !e.sent_at).length, sent: mem.errors.filter((e) => e.sent_at).length };
    }
    const r = await db.getFirstAsync<{ pending: number; sent: number }>('SELECT SUM(sent_at IS NULL) AS pending, SUM(sent_at IS NOT NULL) AS sent FROM error_logs');
    return { pending: r?.pending ?? 0, sent: r?.sent ?? 0 };
  } catch {
    return { pending: 0, sent: 0 };
  }
}

// ---------- trilha de ações ----------
let crumbWrites = 0;
export async function addBreadcrumb(b: Breadcrumb): Promise<void> {
  try {
    const db = await localDb();
    if (!db) {
      mem.crumbs.push(b);
      if (mem.crumbs.length > BREADCRUMB_KEEP) mem.crumbs.shift();
      return;
    }
    await db.runAsync('INSERT INTO breadcrumbs (at, kind, label, data) VALUES (?, ?, ?, ?)', [b.at, b.kind, b.label.slice(0, 160), b.data ? JSON.stringify(b.data) : null]);
    if (++crumbWrites % 50 === 0) await db.runAsync('DELETE FROM breadcrumbs WHERE id NOT IN (SELECT id FROM breadcrumbs ORDER BY id DESC LIMIT ?)', [BREADCRUMB_KEEP]);
  } catch {
    // ignora
  }
}

export async function recentBreadcrumbs(n = 25): Promise<Breadcrumb[]> {
  try {
    const db = await localDb();
    if (!db) return mem.crumbs.slice(-n);
    const rows = await db.getAllAsync<{ at: string; kind: Breadcrumb['kind']; label: string; data: string | null }>('SELECT at, kind, label, data FROM breadcrumbs ORDER BY id DESC LIMIT ?', [n]);
    return rows.reverse().map((r) => ({ at: r.at, kind: r.kind, label: r.label, ...(r.data ? { data: JSON.parse(r.data) } : {}) }));
  } catch {
    return [];
  }
}

// ---------- cache chave/valor ----------
export async function kvGet<T>(key: string): Promise<T | null> {
  try {
    const db = await localDb();
    if (!db) {
      const v = mem.kv.get(key);
      return v ? (JSON.parse(v) as T) : null;
    }
    const r = await db.getFirstAsync<{ value: string }>('SELECT value FROM kv WHERE key = ?', [key]);
    return r ? (JSON.parse(r.value) as T) : null;
  } catch {
    return null;
  }
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  try {
    const raw = JSON.stringify(value);
    const db = await localDb();
    if (!db) {
      mem.kv.set(key, raw);
      return;
    }
    await db.runAsync('INSERT INTO kv (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at', [key, raw, new Date().toISOString()]);
  } catch {
    // ignora
  }
}
