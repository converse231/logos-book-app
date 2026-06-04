import React, { createContext, useContext } from 'react';
import { LogosApi } from './api';

const ApiContext = createContext<LogosApi | null>(null);

export function ApiProvider({
  api,
  children,
}: {
  api: LogosApi;
  children: React.ReactNode;
}) {
  return <ApiContext.Provider value={api}>{children}</ApiContext.Provider>;
}

export function useApi(): LogosApi {
  const ctx = useContext(ApiContext);
  if (!ctx) throw new Error('useApi must be used inside ApiProvider');
  return ctx;
}
