import type { NodeConfigByKind } from '@luke/contracts';

import { recordsToBatch } from './normalize';
import type { ParsedSource } from './types';

type JsonInputConfig = NodeConfigByKind['input.json'];

const getRoot = (value: unknown, rootPath?: string): unknown => {
  if (!rootPath) return value;
  return rootPath.split('.').reduce<unknown>((current, segment) => {
    if (
      typeof current !== 'object' ||
      current === null ||
      !(segment in current)
    ) {
      return undefined;
    }
    return (current as Record<string, unknown>)[segment];
  }, value);
};

const flattenOneLevel = (
  record: Record<string, unknown>,
): Record<string, unknown> => {
  const flattened: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      for (const [nestedKey, nestedValue] of Object.entries(value)) {
        flattened[`${key}.${nestedKey}`] = nestedValue;
      }
    } else {
      flattened[key] = value;
    }
  }
  return flattened;
};

export async function parseJsonFile(
  file: File,
  config: JsonInputConfig,
): Promise<ParsedSource> {
  return parseJsonText(await file.text(), config);
}

export function parseJsonText(
  text: string,
  config: JsonInputConfig,
): ParsedSource {
  try {
    const root = getRoot(JSON.parse(text) as unknown, config.rootPath);
    if (
      !Array.isArray(root) ||
      root.some(
        (item) =>
          typeof item !== 'object' || item === null || Array.isArray(item),
      )
    ) {
      throw new Error('The selected JSON value must be an array of objects.');
    }
    const records = root.map((item) => item as Record<string, unknown>);
    return {
      batch: recordsToBatch(
        config.flattenDepth === 1 ? records.map(flattenOneLevel) : records,
      ),
      diagnostics: [],
    };
  } catch (error) {
    return {
      batch: recordsToBatch([]),
      diagnostics: [
        {
          code: 'SOURCE_PARSE_FAILED',
          severity: 'error',
          message:
            error instanceof Error
              ? error.message
              : 'The JSON source is invalid.',
        },
      ],
    };
  }
}
