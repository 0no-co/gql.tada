const ansiRegex = /([\x1B\x9B][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><])/g;

export const stripAnsi = (input: string) => input.replace(ansiRegex, '');

const segmenter = new Intl.Segmenter();

export const stringWidth = (input: string) => {
  let width = 0;
  for (const _ of segmenter.segment(stripAnsi(input))) width++;
  return width;
};
