import { getGraphQLSPConfig } from '../lsp';
import { ensureTadaIntrospection } from '../tada';
import { getTsConfig } from '../tsconfig';

export async function generateTadaTypes(shouldPreprocess = false, cwd: string = process.cwd()) {
  const tsConfig = await getTsConfig();
  if (!tsConfig) {
    return;
  }

  const config = getGraphQLSPConfig(tsConfig);
  if (!config) {
    return;
  }

  return await ensureTadaIntrospection(
    config.schema,
    config.tadaOutputLocation,
    cwd,
    shouldPreprocess
  );
}
