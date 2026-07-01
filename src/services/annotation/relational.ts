import type { ContainerElementFile, ContainerID } from 'src/models/container';
import type { AnnotationContext, AnnotationID } from 'src/models/document/pdf';
import { Failure, Success, type Result } from 'src/models/error/result';
import type { AnnotIDToFile, Relational, RelationalResponce } from 'src/models/relational/common';
import * as containerService from 'src/services/container/main';
import * as containerConfigService from 'src/services/container/config';
import { CachedAnnotFile, CachedRelationalFile } from 'src/models/relational/cached';

/**
 * 保存済みの文書におけるアノテーションIDに紐づく関係性情報を取得
 */
export async function loadRelationals(
  cID: ContainerID,
  annotID: AnnotationID,
): Promise<Result<Relational[]>> {
  // 当該アノテーションの文書内容を取得する
  // const thisAnnotVal = await loadAnnotContent(annotID, targetFile);
  // if (!thisAnnotVal.ok) return thisAnnotVal;

  // 当該アノテーションに紐づく関係性データを抽出
  const relationalFile = await getRelationalFileElement(cID);
  if (!relationalFile.ok) return relationalFile;
  const relationals = await loadCachedRelationals(relationalFile.value, annotID);

  return relationals;
}

/**
 * 指定した関係性一覧を検証する
 */
// export async function checkRelationals(
//   relationals: Relational[],
// ): Promise<Result<RelationalResponce[]>> {


//   // 抽出した各関係性データが紐づくアノテーションの文書内容を取得する
//   const targetVals = await Promise.all(
//     // TODO: コンテナIDを用いてElements集を取得し、取得したElementsの中からr.targetIDを含むElementsを取得
//     relationals.map((r) => loadAnnotContent(r.targetID, annotId2ElementFile)),
//   );
//   const errVal = targetVals.find((v) => !v.ok);
//   if (errVal !== void 0) return errVal;
//   const parsedTargetVals = targetVals.filter((v) => v.ok).map((v) => v.value);

//   // 取得した内容を関係性ルールに基づいて検証する
//   const relationalRes = relationals.map((r, i) => {
//     const targetVal = parsedTargetVals[i];
//     return validRelational(r, thisAnnotVal.value, targetVal ?? '');
//   });

//   // 検証結果を返す
//   return Success(relationalRes);
// }

export async function checkRelational(r: Relational): Promise<Result<RelationalResponce>> {
  const thisFile = await loadFileFromAnnotID(r.srcContainerID, r.srcID)
  if (!thisFile.ok) return thisFile


}

/**
 * 指定したアノテーションが含まれているファイル要素を返す
 */
async function loadFileFromAnnotID(
  containerID: ContainerID,
  annotID: AnnotationID,
): Promise<Result<ContainerElementFile>> {
  const annotId2ElementFile: AnnotIDToFile = await containerConfigService.loadAnnotIDs(containerID);
  const targetFile = annotId2ElementFile[annotID];
  // TODO: 未登録のアノテーションに対しては常にFailureになってしまう。対策を検討する。
  if (targetFile === void 0) {
    return Failure(new Error('This annotation is not exists in any file'));
  } else {
    return Success(targetFile);
  }
}

/**
 * 指定したファイルの指定したアノテーション位置における文書内容を取得する
 *
 * アノテーションのキャッシュに読み込み済みの情報がある場合はその情報を返す
 */
async function loadAnnotContent(
  annotID: AnnotationID,
  targetFile: ContainerElementFile,
): Promise<Result<string>> {
  // キャッシュからアノテーションされている部分の文書情報を取得する
  const cachedAnnotFile = await getCachedAnnotation(targetFile.containerID, targetFile.path);
  if (!cachedAnnotFile.ok) return cachedAnnotFile;
  const cachedAnnotContext = await loadCachedAnnotContent(cachedAnnotFile.value, annotID);

  // キャッシュが有効な場合はキャッシュの情報をそのまま返す
  // TODO: キャッシュと実データのハッシュ検証を行い、ハッシュが異なる場合はキャッシュを破棄して実データを読み込む
  if (cachedAnnotContext.ok) return Success(cachedAnnotContext.value.text);

  // ファイルデータを取得する
  const loadedFileSrc = await containerService.loadFileAsDocumentSource(targetFile);
  if (!loadedFileSrc.ok) return loadedFileSrc;
  const fileSrc = loadedFileSrc.value;

  // キャッシュが無効であったため、実データから情報を取得する
  const thisAnnotContent = documentService.loadAnnotContents(targetFile, fileSrc, annotID); // ファイル種別を認識し、内部でアノテーション一覧の取得、一覧から対象アノテーションの抽出、抽出位置におけるデータを取得、まで実施
  return thisAnnotContent;
}

/**
 * コンテナルートにキャッシュされた関係性情報を保存したファイル要素を取得する
 */
function getRelationalFileElement(cId: ContainerID): Promise<Result<ContainerElementFile>> {
  return containerConfigService.getCachedRelationalFile(cId);
}

/**
 * コンテナルートにキャッシュされたアノテーション情報を保存したファイル要素を取得する
 */
function getCachedAnnotation(
  cId: ContainerID,
  targetPath: string,
): Promise<Result<ContainerElementFile>> {
  return containerConfigService.getCachedAnnotsFile(cId, targetPath);
}

/**
 * コンテナルートにキャッシュされた関係性情報を読み込む
 */
async function loadCachedRelationals(
  cacheFile: ContainerElementFile,
  targetAnnotID: AnnotationID,
): Promise<Result<Relational[]>> {
  // キャッシュデータのDocumentSourceを取得する
  const src = await containerService.loadFileAsDocumentSource(cacheFile);
  if (!src.ok) return src;

  // 取得した情報をデコードする
  const fileContentStr = documentService.loadTextContents(cacheFile, src);
  const parsedFileContent = CachedRelationalFile.safeParse(JSON.parse(fileContentStr));
  if (!parsedFileContent.success) return Failure(parsedFileContent.error);

  // 対象のアノテーションIDのみでフィルタリング
  return Success(parsedFileContent.data.relationals.filter((r) => r.srcID === targetAnnotID));
}

/**
 * コンテナルートにキャッシュされたアノテーション情報を読み込む
 */
async function loadCachedAnnotContent(
  cacheFile: ContainerElementFile,
  annotID: AnnotationID,
): Promise<Result<AnnotationContext>> {
  // キャッシュデータのDocumentSourceを取得する
  const src = await containerService.loadFileAsDocumentSource(cacheFile);
  if (!src.ok) return src;

  // 取得した情報をデコードする
  const fileContentStr = documentService.loadTextContents(cacheFile, src);
  const parsedFileContent = CachedAnnotFile.safeParse(JSON.parse(fileContentStr));
  if (!parsedFileContent.success) return Failure(parsedFileContent.error);

  // 指定されたAnnotIDに絞って返す
  const foundAnnot = parsedFileContent.data.annots.find((a) => a.style.id === annotID);
  if (foundAnnot === void 0) return Failure(new Error('Not found target annotation'));

  return Success(foundAnnot.context);
}

/**
 * 関係性を検証する
 */
function validRelational(
  relational: Relational,
  srcVal: string,
  targetVal: string,
): RelationalResponce {
  let isOK = true;
  switch (relational.rule.type) {
    case 'link':
      break;
    case 'equal':
      isOK = srcVal === targetVal;
      break;
  }

  return {
    srcID: relational.srcID,
    targetID: relational.targetID,
    srcVal,
    targetVal,
    checkedRule: { rule: relational.rule, isOK },
  };
}
