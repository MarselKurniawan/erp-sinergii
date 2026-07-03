import { formatCurrency, formatDate } from './formatters';

export interface ExportMeta {
  companyName?: string;
  reportTitle?: string;
  dateLabel?: string; // e.g. "Per 2024-01-01" or "Periode: 2024-01-01 s/d 2024-12-31"
}

// Export to CSV
export const exportToCSV = (data: Record<string, any>[], filename: string, meta?: ExportMeta) => {
  if (data.length === 0) return;

  const headers = Object.keys(data[0]);
  const metaRows: string[] = [];

  if (meta?.companyName) {
    metaRows.push(meta.companyName);
  }
  if (meta?.reportTitle) {
    metaRows.push(meta.reportTitle);
  }
  if (meta?.dateLabel) {
    metaRows.push(meta.dateLabel);
  }
  if (metaRows.length > 0) {
    metaRows.push(''); // blank line separator
  }

  const csvContent = [
    ...metaRows,
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        const value = row[header];
        const stringValue = String(value ?? '');
        if (stringValue.includes(',') || stringValue.includes('"')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      }).join(',')
    )
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
};

// Export to Excel (xlsx-like format using HTML table)
export const exportToExcel = (data: Record<string, any>[], filename: string, sheetName: string = 'Sheet1', meta?: ExportMeta) => {
  if (data.length === 0) return;

  const headers = Object.keys(data[0]);
  const colCount = headers.length;
  
  let tableHTML = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head><meta charset="UTF-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>${sheetName}</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head>
    <body><table border="1">
  `;

  // Add meta header rows
  if (meta?.companyName) {
    tableHTML += `<tr><td colspan="${colCount}" style="font-size:14pt;font-weight:bold;text-align:center;border:none;">${meta.companyName}</td></tr>`;
  }
  if (meta?.reportTitle) {
    tableHTML += `<tr><td colspan="${colCount}" style="font-size:12pt;font-weight:bold;text-align:center;border:none;">${meta.reportTitle}</td></tr>`;
  }
  if (meta?.dateLabel) {
    tableHTML += `<tr><td colspan="${colCount}" style="font-size:10pt;text-align:center;border:none;">${meta.dateLabel}</td></tr>`;
  }
  if (meta?.companyName || meta?.reportTitle || meta?.dateLabel) {
    tableHTML += `<tr><td colspan="${colCount}" style="border:none;">&nbsp;</td></tr>`;
  }

  tableHTML += `<thead><tr>${headers.map(h => `<th style="background:#f0f0f0;font-weight:bold">${h}</th>`).join('')}</tr></thead><tbody>`;

  data.forEach(row => {
    tableHTML += '<tr>';
    headers.forEach(header => {
      tableHTML += `<td>${row[header] ?? ''}</td>`;
    });
    tableHTML += '</tr>';
  });

  tableHTML += '</tbody></table></body></html>';

  const blob = new Blob([tableHTML], { type: 'application/vnd.ms-excel' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.xls`;
  link.click();
  URL.revokeObjectURL(link.href);
};

// Export to PDF (using print with CSS)
export const exportToPDF = (title: string, content: HTMLElement | string, meta?: ExportMeta) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const htmlContent = typeof content === 'string' ? content : content.outerHTML;

  let headerHTML = '';
  if (meta?.companyName) {
    headerHTML += `<div style="text-align:center;font-size:18px;font-weight:bold;margin-bottom:4px;">${meta.companyName}</div>`;
  }
  headerHTML += `<h1 style="text-align:center;margin-bottom:4px;">${title}</h1>`;
  if (meta?.dateLabel) {
    headerHTML += `<div style="text-align:center;font-size:14px;color:#666;margin-bottom:16px;">${meta.dateLabel}</div>`;
  }
  
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        h1 { font-size: 20px; margin-bottom: 4px; }
        h2 { font-size: 16px; color: #666; margin-bottom: 16px; }
        h3 { font-size: 14px; margin-top: 16px; margin-bottom: 8px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f5f5f5; font-weight: bold; }
        .text-right { text-align: right; }
        .total-row { background-color: #f0f0f0; font-weight: bold; }
        .success { color: #16a34a; }
        .destructive { color: #dc2626; }
        @media print {
          body { margin: 0; }
          @page { margin: 15mm; }
        }
      </style>
    </head>
    <body>
      ${headerHTML}
      ${htmlContent}
    </body>
    </html>
  `);
  
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 250);
};

// Generate HTML table for PDF export
export const generatePDFTable = (
  headers: string[],
  rows: string[][],
  options?: { totalRow?: string[]; subtitle?: string }
) => {
  let html = options?.subtitle ? `<h2>${options.subtitle}</h2>` : '';
  html += '<table><thead><tr>';
  headers.forEach(h => { html += `<th>${h}</th>`; });
  html += '</tr></thead><tbody>';
  
  rows.forEach(row => {
    html += '<tr>';
    row.forEach(cell => { html += `<td>${cell}</td>`; });
    html += '</tr>';
  });

  if (options?.totalRow) {
    html += '<tr class="total-row">';
    options.totalRow.forEach(cell => { html += `<td>${cell}</td>`; });
    html += '</tr>';
  }

  html += '</tbody></table>';
  return html;
};
