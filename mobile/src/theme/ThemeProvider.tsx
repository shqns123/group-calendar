import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useColorScheme } from "react-native";
import { dark, light, type ColorTokens } from "./tokens";

type Theme = { c: ColorTokens; isDark: boolean };

const ThemeContext = createContext<Theme>({ c: light, isDark: false });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const scheme = useColorScheme();
  const value = useMemo<Theme>(
    () => ({ c: scheme === "dark" ? dark : light, isDark: scheme === "dark" }),
    [scheme],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
