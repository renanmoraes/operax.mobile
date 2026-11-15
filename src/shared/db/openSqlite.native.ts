import * as SQLite from 'expo-sqlite';

/** Abre o banco do aparelho. Só no celular: no navegador o expo-sqlite puxa um .wasm que o Metro não empacota. */
export const openSqlite = () => SQLite.openDatabaseAsync('operax.db');
