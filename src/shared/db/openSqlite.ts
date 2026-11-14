import type { SQLiteDatabase } from 'expo-sqlite';

/** Navegador: sem SQLite (o banco local cai no armazenamento em memória/localStorage). */
export const openSqlite = async (): Promise<SQLiteDatabase | null> => null;
