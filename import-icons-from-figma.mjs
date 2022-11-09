import * as fs from 'fs';
import fetch from 'node-fetch';
import { FIGMA_TOKEN } from './token.mjs';
import * as Figma from 'figma-js';

const fileId = '';

const client = Figma.Client({
  personalAccessToken: FIGMA_TOKEN,
});

const fetchFileData = async () => {
  const { data } = await client.file(fileId);
  return data;
};

const fetchIconImageUrls = async (iconComponentNodeIds) => {
  const { data } = await client.fileImages(fileId, {
    ids: iconComponentNodeIds,
  });

  return data;
};

const extractIconImages = (iconComponentNodeIds, fileData, iconImgUrls) => {
  return iconComponentNodeIds
    .map((nodeId) => {
      const node = fileData.components[nodeId];
      const { name } = node;
      const link = iconImgUrls.images[nodeId];

      return {
        name,
        link,
      };
    })
    .filter((val) => val.link !== null);
};

const writeToIconNames = (iconNames) => {
  const fileContent = `export const iconNames = [${iconNames
    .map((name) => `"${name}"`)
    .join(',')}] as const;

export type iconTypes = typeof iconNames[number];

${iconNames
  .map(
    (name) =>
      `import ${name
        .split('-')
        .map((s) => s.toUpperCase())
        .join('')} from '../../../public/images/icons/${name}.svg';`
  )
  .join('\n')}


export const iconMap: { [key in iconTypes]: React.ComponentClass } = {
  ${iconNames
    .map(
      (name) =>
        `'${name}': ${name
          .split('-')
          .map((s) => s.toUpperCase())
          .join('')}`
    )
    .join(',\n  ')}
};

    `;

  fs.writeFileSync(`./dist/IconNames.ts`, fileContent);
};

const run = async () => {
  // まずはファイルを丸ごと取得する
  const fileData = await fetchFileData();
  const iconComponentNodeIds = Object.keys(fileData.components);
  console.log(iconComponentNodeIds);

  // Icon コンポーネントの画像のリンク集を取得
  const iconImgUrls = await fetchIconImageUrls(iconComponentNodeIds);

  // ファイル名をコンポーネントの名前から作る & 画像のリンクとセットにしたオブジェクトを作る
  const iconImages = extractIconImages(
    iconComponentNodeIds,
    fileData,
    iconImgUrls
  );

  // 画像を Figma の URL から取りつつ書き込み
  iconImages.forEach(async (image) => {
    const res = await fetch(image.link);
    const data = await res.text();
    fs.writeFileSync(`./dist/icons/${image.name}.svg`, data);
  });

  // 型定義を Icon コンポーネントと story に書き込み
  const iconNames = iconImages
    .map((image) => image.name)
    // 重複排除
    .filter(function (item, pos, arr) {
      return arr.indexOf(item) == pos;
    });
  writeToIconNames(iconNames);
};

run();
