import * as fs from 'fs';
import { FIGMA_TOKEN } from './token.mjs';
import * as Figma from 'figma-js';

const fileId = '';

const figmaToken = FIGMA_TOKEN;

const client = Figma.Client({
  personalAccessToken: figmaToken,
});

const fetchStylesData = async () => {
  const res = await client.file(fileId);
  return await res.data.styles;
};

const fetchStyleNodes = async (nodeIds) => {
  const res = await client.fileNodes(fileId, { ids: nodeIds });

  return await res.data.nodes;
};

const REM_SIZE = 16;

const writeTypographyStyles = async (typographyStyleData) => {
  const typographyStyles = Object.values(typographyStyleData).map((node) => {
    return {
      styleName: node.document.name
        .split('/')
        .join('-')
        .split(' ')
        .join('-')
        .toLowerCase(),
      ...node.document.style,
    };
  });

  const stitchesString = `
type TypographyNames = ${typographyStyles
    .map((style) => `'${style.styleName}'`)
    .join(' | ')};

export const typographySettings = (value: TypographyNames) => {
      switch (value) {
${typographyStyles
  .map((style) => {
    return `        case '${style.styleName}':
          return {
            fontFamily: "${style.fontFamily}",
            fontSize: "${style.fontSize / REM_SIZE}rem",
            letterSpacing: ${style.letterSpacing},
            lineHeight: "${style.lineHeightPx / REM_SIZE}rem",
            fontWeight: "${style.fontWeight}"
          };`;
  })
  .join('\n')}
        default:
          return {
            fontSize: 14,
          };
      }
    }
`;

  fs.writeFileSync(`./dist/typographySettings.ts`, stitchesString);
};

const figmaRGBtoHex = (val) =>
  Math.floor(val * 255)
    .toString(16)
    .padStart(2, '0');

const writeColorStyles = async (colorStyleData) => {
  const colorStyles = Object.values(colorStyleData).map((node) => {
    const fill = node.document.fills[0];
    return {
      styleName: node.document.name
        .split('/')
        .join('-')
        .split(' ')
        .join('-')
        .toLowerCase(),
      fill:
        fill.color.a === 1
          ? `#${figmaRGBtoHex(fill.color.r)}${figmaRGBtoHex(
              fill.color.g
            )}${figmaRGBtoHex(fill.color.b)}`
          : `rgba(${fill.color.r * 255}, ${fill.color.g * 255}, ${
              fill.color.b * 255
            }, ${fill.color.a * 100})`,
    };
  });

  const stitchesString = `export const colorSettings = {
${colorStyles
  .map((style) => `  "${style.styleName}": "${style.fill}",`)
  .join('\n')}
}
`;

  fs.writeFileSync(`./dist/colorSettings.ts`, stitchesString);
};

const run = async () => {
  // まずはファイルを丸ごと取得する
  const stylesData = await fetchStylesData();
  const styles = Object.keys(stylesData).map((key) => ({
    node_id: key,
    ...stylesData[key],
  }));

  const typographyStyleIds = styles
    .filter((style) => style.styleType === 'TEXT')
    .map((style) => style.node_id);
  const typographyStyleData = await fetchStyleNodes(typographyStyleIds);
  writeTypographyStyles(typographyStyleData);

  const colorStyleIds = styles
    .filter((style) => style.styleType === 'FILL')
    .map((style) => style.node_id);
  const colorStyleData = await fetchStyleNodes(colorStyleIds);
  writeColorStyles(colorStyleData);
};

run();
