import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react';

type QueueDrawerState = {
  visible: boolean;
  queueCount: number;
  open: () => void;
  close: () => void;
  toggle: () => void;
  setQueueCount: (n: number) => void;
};

const QueueDrawerContext = createContext<QueueDrawerState | null>(null);

export function QueueDrawerProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [queueCount, setQueueCount] = useState(0);

  const open = useCallback(() => setVisible(true), []);
  const close = useCallback(() => setVisible(false), []);
  const toggle = useCallback(() => setVisible((v) => !v), []);

  const value = useMemo(
    () => ({ visible, queueCount, open, close, toggle, setQueueCount }),
    [visible, queueCount, open, close, toggle],
  );

  return <QueueDrawerContext.Provider value={value}>{children}</QueueDrawerContext.Provider>;
}

export function useQueueDrawer() {
  const ctx = useContext(QueueDrawerContext);
  if (!ctx) throw new Error('useQueueDrawer must be used within QueueDrawerProvider');
  return ctx;
}
