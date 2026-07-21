import React, { createContext, useContext } from 'react';
import { QuireApi } from './api';

const ApiContext = createContext<QuireApi | null>(null);

export function ApiProvider({
  api,
  children,
}: {
  api: QuireApi;
  children: React.ReactNode;
}) {
  return <ApiContext.Provider value={api}>{children}</ApiContext.Provider>;
}

export function useApi(): QuireApi {
  const ctx = useContext(ApiContext);
  if (!ctx) throw new Error('useApi must be used inside ApiProvider');
  return ctx;
}
