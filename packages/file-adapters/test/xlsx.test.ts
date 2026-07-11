import type { DataBatch } from '@luke/contracts';
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';

import { exportXlsx, parseXlsxBuffer } from '../src';

async function workbookBuffer(): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  const first = workbook.addWorksheet('Ignored');
  first.addRow(['value']);
  first.addRow(['wrong sheet']);
  const sheet = workbook.addWorksheet('Orders');
  sheet.addRow(['id', 'created', 'formula']);
  sheet.addRow([
    1,
    new Date('2026-01-02T00:00:00.000Z'),
    { formula: '1+1', result: 2 },
  ]);
  const content = await workbook.xlsx.writeBuffer();
  return new Uint8Array(content).buffer;
}

describe('parseXlsxBuffer', () => {
  it('selects a worksheet and preserves dates and formulas as text', async () => {
    const result = await parseXlsxBuffer(await workbookBuffer(), {
      sourceId: 'orders',
      sheetName: 'Orders',
      headerRow: 1,
    });
    expect(result.diagnostics).toEqual([]);
    expect(result.batch.rows).toEqual([
      [1, '2026-01-02T00:00:00.000Z', '=1+1'],
    ]);
    expect(result.batch.schema.columns.map((column) => column.type)).toEqual([
      'number',
      'datetime',
      'string',
    ]);
  });

  it('reports missing worksheets and empty headers', async () => {
    expect(
      (
        await parseXlsxBuffer(await workbookBuffer(), {
          sourceId: 'orders',
          sheetName: 'Missing',
          headerRow: 1,
        })
      ).diagnostics[0],
    ).toMatchObject({ code: 'SOURCE_PARSE_FAILED' });

    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet('Empty');
    const content = await workbook.xlsx.writeBuffer();
    expect(
      (
        await parseXlsxBuffer(new Uint8Array(content).buffer, {
          sourceId: 'empty',
          sheetName: 'Empty',
          headerRow: 1,
        })
      ).diagnostics[0],
    ).toMatchObject({ code: 'SOURCE_PARSE_FAILED' });
  });
});

describe('exportXlsx', () => {
  it('writes ordered fields and neutralizes formula strings', async () => {
    const batch: DataBatch = {
      schema: {
        columns: [
          { id: 'name', name: 'name', type: 'string', nullable: false },
          { id: 'value', name: 'value', type: 'string', nullable: false },
        ],
      },
      rows: [['Ada', '=2+3']],
      offset: 0,
    };
    const exported = await exportXlsx(batch, {
      sheetName: 'Result',
      fileName: 'result.xlsx',
    });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(
      exported.content.buffer.slice(
        exported.content.byteOffset,
        exported.content.byteOffset + exported.content.byteLength,
      ) as ArrayBuffer,
    );
    const sheet = workbook.getWorksheet('Result')!;
    expect(sheet.getRow(1).values).toEqual([undefined, 'name', 'value']);
    expect(sheet.getCell('B2').value).toBe("'=2+3");
    expect(exported.fileName).toBe('result.xlsx');
  });
});
