/**
 * Dashboard export service for PDF, image, and CSV generation.
 * Uses html2canvas for DOM-to-canvas capture and jsPDF for PDF creation.
 * Supports large dashboard views with proper scaling and multi-page PDF support.
 * @module exportService
 */

import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

/**
 * Default options for html2canvas rendering.
 * @type {Object}
 */
const DEFAULT_CANVAS_OPTIONS = {
  scale: 2,
  useCORS: true,
  allowTaint: false,
  backgroundColor: '#ffffff',
  logging: false,
  removeContainer: true,
  imageTimeout: 15000,
};

/**
 * Default options for PDF export.
 * @type {Object}
 */
const DEFAULT_PDF_OPTIONS = {
  orientation: 'landscape',
  unit: 'mm',
  format: 'a4',
  compress: true,
};

/**
 * A4 dimensions in mm for layout calculations.
 * @type {{ landscape: { width: number, height: number }, portrait: { width: number, height: number } }}
 */
const A4_DIMENSIONS = {
  landscape: { width: 297, height: 210 },
  portrait: { width: 210, height: 297 },
};

/**
 * Page margin in mm applied to all sides of the PDF.
 * @type {number}
 */
const PAGE_MARGIN = 10;

/**
 * Captures a DOM element as a canvas using html2canvas.
 * @param {HTMLElement} element - The DOM element to capture.
 * @param {Object} [options={}] - Additional html2canvas options.
 * @returns {Promise<HTMLCanvasElement>} The rendered canvas element.
 * @throws {Error} If the element is invalid or capture fails.
 */
async function captureElementAsCanvas(element, options = {}) {
  if (!element || !(element instanceof HTMLElement)) {
    throw new Error('A valid HTML element is required for capture.');
  }

  const mergedOptions = {
    ...DEFAULT_CANVAS_OPTIONS,
    ...options,
  };

  try {
    const canvas = await html2canvas(element, mergedOptions);
    return canvas;
  } catch (error) {
    throw new Error(`Failed to capture element as canvas: ${error.message}`);
  }
}

/**
 * Triggers a file download in the browser.
 * @param {string} dataUrl - The data URL or blob URL of the file.
 * @param {string} filename - The desired filename for the download.
 */
function triggerDownload(dataUrl, filename) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Sanitizes a filename by removing invalid characters and ensuring an extension.
 * @param {string} filename - The raw filename.
 * @param {string} defaultExtension - The default file extension to append if missing.
 * @returns {string} The sanitized filename.
 */
function sanitizeFilename(filename, defaultExtension) {
  if (!filename || typeof filename !== 'string') {
    return `export_${Date.now()}.${defaultExtension}`;
  }

  let sanitized = filename.replace(/[^a-zA-Z0-9_\-. ]/g, '_').trim();

  if (!sanitized) {
    sanitized = `export_${Date.now()}`;
  }

  const hasExtension = sanitized.includes('.') && sanitized.lastIndexOf('.') > 0;
  if (!hasExtension) {
    sanitized = `${sanitized}.${defaultExtension}`;
  }

  return sanitized;
}

/**
 * Exports a DOM element as a PDF file with multi-page support for large views.
 * The element is captured at high resolution and split across pages as needed.
 *
 * @param {HTMLElement} elementRef - The DOM element (or React ref.current) to export.
 * @param {string} [filename='dashboard-export'] - The desired filename (without extension).
 * @param {Object} [options={}] - Additional export options.
 * @param {string} [options.orientation='landscape'] - Page orientation ('landscape' or 'portrait').
 * @param {string} [options.format='a4'] - Page format (e.g., 'a4', 'letter').
 * @param {string} [options.title] - Optional title to display at the top of the first page.
 * @param {boolean} [options.compress=true] - Whether to compress the PDF output.
 * @param {number} [options.scale=2] - Canvas capture scale factor.
 * @param {string} [options.backgroundColor='#ffffff'] - Background color for the capture.
 * @returns {Promise<void>} Resolves when the PDF has been downloaded.
 * @throws {Error} If the element is invalid or export fails.
 */
export async function exportAsPDF(elementRef, filename = 'dashboard-export', options = {}) {
  if (!elementRef || !(elementRef instanceof HTMLElement)) {
    throw new Error('A valid HTML element reference is required for PDF export.');
  }

  const {
    orientation = DEFAULT_PDF_OPTIONS.orientation,
    format = DEFAULT_PDF_OPTIONS.format,
    title = '',
    compress = DEFAULT_PDF_OPTIONS.compress,
    scale = DEFAULT_CANVAS_OPTIONS.scale,
    backgroundColor = DEFAULT_CANVAS_OPTIONS.backgroundColor,
  } = options;

  try {
    const canvas = await captureElementAsCanvas(elementRef, {
      scale,
      backgroundColor,
    });

    const imgData = canvas.toDataURL('image/png', 1.0);
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;

    const pdf = new jsPDF({
      orientation,
      unit: DEFAULT_PDF_OPTIONS.unit,
      format,
      compress,
    });

    const pageDimensions = orientation === 'portrait' ? A4_DIMENSIONS.portrait : A4_DIMENSIONS.landscape;
    const contentWidth = pageDimensions.width - PAGE_MARGIN * 2;
    const contentHeight = pageDimensions.height - PAGE_MARGIN * 2;

    let yOffset = 0;

    if (title) {
      pdf.setFontSize(14);
      pdf.setTextColor(30, 41, 59);
      pdf.text(title, PAGE_MARGIN, PAGE_MARGIN + 5);
      yOffset = 10;
    }

    const availableHeightFirstPage = contentHeight - yOffset;
    const scaledImgWidth = contentWidth;
    const scaledImgHeight = (imgHeight * contentWidth) / imgWidth;

    if (scaledImgHeight <= availableHeightFirstPage) {
      pdf.addImage(
        imgData,
        'PNG',
        PAGE_MARGIN,
        PAGE_MARGIN + yOffset,
        scaledImgWidth,
        scaledImgHeight
      );
    } else {
      let remainingHeight = scaledImgHeight;
      let sourceY = 0;
      let isFirstPage = true;

      while (remainingHeight > 0) {
        const availableHeight = isFirstPage ? availableHeightFirstPage : contentHeight;
        const sliceHeight = Math.min(availableHeight, remainingHeight);

        const sliceSourceHeight = (sliceHeight / scaledImgHeight) * imgHeight;

        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = imgWidth;
        sliceCanvas.height = Math.ceil(sliceSourceHeight);

        const sliceCtx = sliceCanvas.getContext('2d');
        if (sliceCtx) {
          sliceCtx.fillStyle = backgroundColor;
          sliceCtx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
          sliceCtx.drawImage(
            canvas,
            0,
            Math.floor(sourceY),
            imgWidth,
            Math.ceil(sliceSourceHeight),
            0,
            0,
            imgWidth,
            Math.ceil(sliceSourceHeight)
          );
        }

        const sliceImgData = sliceCanvas.toDataURL('image/png', 1.0);

        if (!isFirstPage) {
          pdf.addPage(format, orientation);
        }

        const pageYOffset = isFirstPage ? PAGE_MARGIN + yOffset : PAGE_MARGIN;

        pdf.addImage(
          sliceImgData,
          'PNG',
          PAGE_MARGIN,
          pageYOffset,
          scaledImgWidth,
          sliceHeight
        );

        sourceY += sliceSourceHeight;
        remainingHeight -= sliceHeight;
        isFirstPage = false;
      }
    }

    const totalPages = pdf.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setTextColor(148, 163, 184);
      pdf.text(
        `Page ${i} of ${totalPages}`,
        pageDimensions.width - PAGE_MARGIN - 25,
        pageDimensions.height - 5
      );
      pdf.text(
        `Generated: ${new Date().toLocaleString()}`,
        PAGE_MARGIN,
        pageDimensions.height - 5
      );
    }

    const sanitizedFilename = sanitizeFilename(filename, 'pdf');
    pdf.save(sanitizedFilename);
  } catch (error) {
    throw new Error(`PDF export failed: ${error.message}`);
  }
}

/**
 * Exports a DOM element as an image file (PNG or JPEG).
 *
 * @param {HTMLElement} elementRef - The DOM element (or React ref.current) to export.
 * @param {string} [filename='dashboard-export'] - The desired filename (without extension).
 * @param {string} [format='png'] - The image format ('png', 'jpeg', or 'svg').
 * @param {Object} [options={}] - Additional export options.
 * @param {number} [options.scale=2] - Canvas capture scale factor.
 * @param {string} [options.backgroundColor='#ffffff'] - Background color for the capture.
 * @param {number} [options.quality=0.92] - JPEG quality (0-1), only applies to JPEG format.
 * @returns {Promise<void>} Resolves when the image has been downloaded.
 * @throws {Error} If the element is invalid or export fails.
 */
export async function exportAsImage(elementRef, filename = 'dashboard-export', format = 'png', options = {}) {
  if (!elementRef || !(elementRef instanceof HTMLElement)) {
    throw new Error('A valid HTML element reference is required for image export.');
  }

  const supportedFormats = ['png', 'jpeg', 'jpg'];
  const normalizedFormat = (format || 'png').toLowerCase().trim();

  if (!supportedFormats.includes(normalizedFormat)) {
    throw new Error(`Unsupported image format: "${format}". Supported formats: ${supportedFormats.join(', ')}`);
  }

  const {
    scale = DEFAULT_CANVAS_OPTIONS.scale,
    backgroundColor = DEFAULT_CANVAS_OPTIONS.backgroundColor,
    quality = 0.92,
  } = options;

  try {
    const canvas = await captureElementAsCanvas(elementRef, {
      scale,
      backgroundColor,
    });

    const mimeType = normalizedFormat === 'jpeg' || normalizedFormat === 'jpg'
      ? 'image/jpeg'
      : 'image/png';

    const extension = normalizedFormat === 'jpg' ? 'jpeg' : normalizedFormat;
    const imageQuality = mimeType === 'image/jpeg' ? quality : undefined;
    const dataUrl = canvas.toDataURL(mimeType, imageQuality);

    const sanitizedFilename = sanitizeFilename(filename, extension === 'jpeg' ? 'jpg' : extension);
    triggerDownload(dataUrl, sanitizedFilename);
  } catch (error) {
    throw new Error(`Image export failed: ${error.message}`);
  }
}

/**
 * Exports audit log data as a CSV file.
 * Handles proper CSV escaping for fields containing commas, quotes, or newlines.
 *
 * @param {Array<Object>} auditData - Array of audit log entries to export.
 * @param {string} [filename='audit-log-export'] - The desired filename (without extension).
 * @returns {void}
 * @throws {Error} If the audit data is invalid or export fails.
 */
export function exportAuditLogCSV(auditData, filename = 'audit-log-export') {
  if (!Array.isArray(auditData)) {
    throw new Error('Audit data must be an array.');
  }

  if (auditData.length === 0) {
    throw new Error('Audit data is empty. Nothing to export.');
  }

  try {
    const columns = [
      'timestamp',
      'action',
      'user',
      'data',
      'previousHash',
      'hash',
    ];

    const allKeys = new Set();
    auditData.forEach((entry) => {
      if (entry && typeof entry === 'object') {
        Object.keys(entry).forEach((key) => allKeys.add(key));
      }
    });

    const headers = columns.filter((col) => allKeys.has(col));
    allKeys.forEach((key) => {
      if (!headers.includes(key)) {
        headers.push(key);
      }
    });

    const escapeCSVField = (value) => {
      if (value === null || value === undefined) {
        return '';
      }

      let stringValue;
      if (typeof value === 'object') {
        try {
          stringValue = JSON.stringify(value);
        } catch {
          stringValue = String(value);
        }
      } else {
        stringValue = String(value);
      }

      if (
        stringValue.includes(',') ||
        stringValue.includes('"') ||
        stringValue.includes('\n') ||
        stringValue.includes('\r')
      ) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }

      return stringValue;
    };

    const csvRows = [];

    csvRows.push(headers.map(escapeCSVField).join(','));

    auditData.forEach((entry) => {
      if (!entry || typeof entry !== 'object') {
        return;
      }

      const row = headers.map((header) => escapeCSVField(entry[header]));
      csvRows.push(row.join(','));
    });

    const csvContent = csvRows.join('\n');
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const blobUrl = URL.createObjectURL(blob);

    const sanitizedFilename = sanitizeFilename(filename, 'csv');
    triggerDownload(blobUrl, sanitizedFilename);

    setTimeout(() => {
      URL.revokeObjectURL(blobUrl);
    }, 1000);
  } catch (error) {
    throw new Error(`CSV export failed: ${error.message}`);
  }
}

/**
 * Exports multiple DOM elements as a single multi-page PDF.
 * Each element is rendered on its own page.
 *
 * @param {HTMLElement[]} elements - Array of DOM elements to export, one per page.
 * @param {string} [filename='multi-dashboard-export'] - The desired filename.
 * @param {Object} [options={}] - Additional export options.
 * @param {string} [options.orientation='landscape'] - Page orientation.
 * @param {string} [options.format='a4'] - Page format.
 * @param {string[]} [options.pageTitles=[]] - Optional titles for each page.
 * @param {number} [options.scale=2] - Canvas capture scale factor.
 * @param {string} [options.backgroundColor='#ffffff'] - Background color.
 * @returns {Promise<void>} Resolves when the PDF has been downloaded.
 * @throws {Error} If elements are invalid or export fails.
 */
export async function exportMultiPagePDF(elements, filename = 'multi-dashboard-export', options = {}) {
  if (!Array.isArray(elements) || elements.length === 0) {
    throw new Error('A non-empty array of HTML elements is required for multi-page PDF export.');
  }

  const {
    orientation = DEFAULT_PDF_OPTIONS.orientation,
    format = DEFAULT_PDF_OPTIONS.format,
    pageTitles = [],
    scale = DEFAULT_CANVAS_OPTIONS.scale,
    backgroundColor = DEFAULT_CANVAS_OPTIONS.backgroundColor,
  } = options;

  try {
    const pdf = new jsPDF({
      orientation,
      unit: DEFAULT_PDF_OPTIONS.unit,
      format,
      compress: true,
    });

    const pageDimensions = orientation === 'portrait' ? A4_DIMENSIONS.portrait : A4_DIMENSIONS.landscape;
    const contentWidth = pageDimensions.width - PAGE_MARGIN * 2;
    const contentHeight = pageDimensions.height - PAGE_MARGIN * 2;

    for (let i = 0; i < elements.length; i++) {
      const element = elements[i];

      if (!element || !(element instanceof HTMLElement)) {
        continue;
      }

      if (i > 0) {
        pdf.addPage(format, orientation);
      }

      const canvas = await captureElementAsCanvas(element, {
        scale,
        backgroundColor,
      });

      const imgData = canvas.toDataURL('image/png', 1.0);
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;

      let yOffset = 0;
      const pageTitle = pageTitles[i];

      if (pageTitle) {
        pdf.setFontSize(14);
        pdf.setTextColor(30, 41, 59);
        pdf.text(pageTitle, PAGE_MARGIN, PAGE_MARGIN + 5);
        yOffset = 10;
      }

      const availableHeight = contentHeight - yOffset;
      const scaledImgWidth = contentWidth;
      const scaledImgHeight = (imgHeight * contentWidth) / imgWidth;

      const finalHeight = Math.min(scaledImgHeight, availableHeight);
      const finalWidth = scaledImgHeight > availableHeight
        ? (imgWidth * availableHeight) / imgHeight
        : scaledImgWidth;

      pdf.addImage(
        imgData,
        'PNG',
        PAGE_MARGIN,
        PAGE_MARGIN + yOffset,
        finalWidth,
        finalHeight
      );
    }

    const totalPages = pdf.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setTextColor(148, 163, 184);
      pdf.text(
        `Page ${i} of ${totalPages}`,
        pageDimensions.width - PAGE_MARGIN - 25,
        pageDimensions.height - 5
      );
      pdf.text(
        `Generated: ${new Date().toLocaleString()}`,
        PAGE_MARGIN,
        pageDimensions.height - 5
      );
    }

    const sanitizedFilename = sanitizeFilename(filename, 'pdf');
    pdf.save(sanitizedFilename);
  } catch (error) {
    throw new Error(`Multi-page PDF export failed: ${error.message}`);
  }
}