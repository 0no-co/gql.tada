export const isGithubCI = !!process.env.GITHUB_ACTIONS;

export interface AnnotationProperties {
  title?: string;
  file?: string;
  line?: number;
  endLine?: number;
  col?: number;
  endColumn?: number;
}

const toCommandValue = (input: unknown): string =>
  typeof input == 'string' || input == null
    ? '' + (input ? '' + input : '')
    : JSON.stringify(input);

const escapeData = (input: unknown) =>
  toCommandValue(input).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');

const escapeProperty = (input: unknown): string =>
  toCommandValue(input)
    .replace(/%/g, '%25')
    .replace(/\r/g, '%0D')
    .replace(/\n/g, '%0A')
    .replace(/:/g, '%3A')
    .replace(/,/g, '%2C');

export function githubAnnotation(
  kind: 'error' | 'warning' | 'notice',
  message: string,
  properties?: AnnotationProperties
) {
  if (isGithubCI) {
    let out = `::${kind}`;
    let propsOut = '';
    if (properties) {
      for (const key in properties) {
        if (properties) propsOut += ',';
        if (properties[key]) propsOut += `${key}=${escapeProperty(properties[key])}`;
      }
    }
    if (propsOut) out += ` ${propsOut}`;
    out += `::${escapeData(message)}\n`;
    process.stdout.write(out);
  }
}
