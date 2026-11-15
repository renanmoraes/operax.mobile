import { useEffect } from 'react';

export type MapSnapshotProps = {
  route: [number, number][];
  /** Arquivo PNG do mapa com o traçado, ou `null` quando não há mapa. */
  onResult: (uri: string | null) => void;
  /** Fração de baixo coberta pelos números no modelo: a rota fica enquadrada acima dela. */
  bottomShare?: number;
};

/** Navegador: sem captura do mapa; o modelo usa o desenho da rota. */
export function MapSnapshot({ onResult }: MapSnapshotProps) {
  useEffect(() => onResult(null), [onResult]);
  return null;
}
