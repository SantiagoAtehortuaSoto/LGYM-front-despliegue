import ExcelJS from "exceljs";

const MAX_COLUMN_WIDTH = 40;
const MIN_COLUMN_WIDTH = 12;

const normalizeSheetName = (sheetName) => {
  const fallbackName = "Datos";
  const safeName = String(sheetName || fallbackName)
    .replace(/[\\/*?:[\]]/g, "")
    .trim();

  return (safeName || fallbackName).slice(0, 31);
};

const normalizeCellValue = (value) => {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value;
  if (typeof value === "object") return JSON.stringify(value);
  return value;
};

const getColumnWidth = (header, rows, key) => {
  const longestValue = rows.reduce((maxLength, row) => {
    const cellValue = normalizeCellValue(row[key]);
    const cellLength = String(cellValue).length;
    return Math.max(maxLength, cellLength);
  }, String(header).length);

  return Math.min(Math.max(longestValue + 2, MIN_COLUMN_WIDTH), MAX_COLUMN_WIDTH);
};

const downloadBuffer = (buffer, fileName) => {
  const blob = new Blob(
    [buffer],
    {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
};

export const exportRowsToWorkbook = async ({
  rows,
  fileName,
  sheetName = "Datos",
}) => {
  const workbook = new ExcelJS.Workbook();
  const normalizedRows = rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => [key, normalizeCellValue(value)]),
    ),
  );
  const headers = Object.keys(normalizedRows[0] || {});
  const worksheet = workbook.addWorksheet(normalizeSheetName(sheetName));

  workbook.creator = "LGYM";
  workbook.created = new Date();

  worksheet.columns = headers.map((header) => ({
    header,
    key: header,
    width: getColumnWidth(header, normalizedRows, header),
  }));

  if (normalizedRows.length) {
    worksheet.addRows(normalizedRows);
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: headers.length },
    };
    worksheet.views = [{ state: "frozen", ySplit: 1 }];
  }

  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true };

  const buffer = await workbook.xlsx.writeBuffer();
  downloadBuffer(buffer, fileName);
};

export default exportRowsToWorkbook;
