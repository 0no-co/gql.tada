import semiver from 'semiver';

export const MINIMUM_VERSIONS = {
  typescript_embed_lsp: '5.5.0',
  typescript: '4.1.0',
  tada: '1.0.0',
  lsp: '1.0.0',
};

export const semverComply = (version: string, compare: string) => {
  const match = version.match(/\d+\.\d+\.\d+/);
  return match ? semiver(match[0], compare) >= 0 : false;
};
