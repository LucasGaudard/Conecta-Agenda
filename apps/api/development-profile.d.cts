export function resolveDevelopmentProfile(
  content: string,
  inherited?: NodeJS.ProcessEnv,
): Record<string, string>;
export function loadIsolatedDevelopmentEnvironment(
  target?: NodeJS.ProcessEnv,
  read?: (file: string) => string,
): void;
