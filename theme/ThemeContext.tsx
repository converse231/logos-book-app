import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { DARK_TOKENS, LIGHT_TOKENS, ThemeMode, ThemeTokens } from './tokens';

interface ThemeContextValue {
  tokens: ThemeTokens;
  mode: ThemeMode;
}

const ThemeContext = createContext<ThemeContextValue>({
  tokens: DARK_TOKENS,
  mode: 'dark',
});

interface ThemeProviderProps {
  children: React.ReactNode;
  preference?: ThemeMode;
}

export function ThemeProvider({ children, preference = 'dark' }: ThemeProviderProps) {
  const systemScheme = useColorScheme();

  const resolvedMode = useMemo<'dark' | 'light'>(() => {
    if (preference === 'system') {
      return systemScheme === 'light' ? 'light' : 'dark';
    }
    return preference === 'light' ? 'light' : 'dark';
  }, [preference, systemScheme]);

  const tokens = resolvedMode === 'dark' ? DARK_TOKENS : LIGHT_TOKENS;

  return (
    <ThemeContext.Provider value={{ tokens, mode: preference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeTokens {
  return useContext(ThemeContext).tokens;
}

export function useThemeMode(): ThemeMode {
  return useContext(ThemeContext).mode;
}
