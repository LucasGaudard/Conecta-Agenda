import { readFileSync } from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";

// Works from src and dist. Local API settings precede root defaults.
export function loadLocalEnv(
  target: NodeJS.ProcessEnv = process.env,
  files = [path.resolve(__dirname, "../.env"), path.resolve(__dirname, "../../../.env")],
) {
  if (target.NODE_ENV === "production" || target.NODE_ENV === "test") return;
  for (const file of files) {
    let content: string;
    try {
      content = readFileSync(file, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw new Error("Não foi possível carregar o arquivo de ambiente local.");
    }
    const parsed = parseEnv(content);
    for (const [key, value] of Object.entries(parsed)) {
      if (target[key] === undefined) target[key] = value;
    }
  }
}
