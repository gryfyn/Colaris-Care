jest.mock('jspdf', () => {
  const addImage = jest.fn();
  const text = jest.fn();
  const line = jest.fn();
  const roundedRect = jest.fn();
  const save = jest.fn();
  const splitTextToSize = jest.fn((value) => [String(value)]);
  const addPage = jest.fn();
  const setPage = jest.fn();
  const setGState = jest.fn();
  const setDrawColor = jest.fn();
  const setLineWidth = jest.fn();
  const setFont = jest.fn();
  const setFontSize = jest.fn();
  const setTextColor = jest.fn();
  const getImageProperties = jest.fn(() => ({ width: 100, height: 50 }));
  const getNumberOfPages = jest.fn(() => 1);
  const getWidth = jest.fn(() => 210);
  const getHeight = jest.fn(() => 297);
  const pdf = {
    addImage,
    text,
    line,
    roundedRect,
    addPage,
    save,
    splitTextToSize,
    setPage,
    setGState,
    setDrawColor,
    setLineWidth,
    setFont,
    setFontSize,
    setTextColor,
    getImageProperties,
    internal: { pageSize: { getWidth, getHeight }, getNumberOfPages },
  };
  return {
    jsPDF: jest.fn(() => pdf),
  };
});

import { downloadFaceSheetPDF } from '@/lib/face-sheet-pdf.js';

describe('downloadFaceSheetPDF', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn(async (url) => {
      if (String(url).includes('logo.png')) {
        return {
          ok: true,
          blob: async () => new Blob(['logo'], { type: 'image/png' }),
        };
      }
      return {
        ok: true,
        blob: async () => new Blob(['photo'], { type: 'image/jpeg' }),
      };
    });

    global.FileReader = class {
      readAsDataURL() {
        this.result = 'data:image/jpeg;base64,ZmFrZQ==';
        if (this.onloadend) this.onloadend();
      }
    };
  });

  test('loads and embeds the resident photo when photoUrl is present', async () => {
    await downloadFaceSheetPDF({
      residentName: 'Jane Doe',
      values: { date_of_birth: '1990-01-01' },
      generatedBy: 'Admin User',
      photoUrl: 'https://res.cloudinary.com/demo/image/upload/photo.jpg',
    });

    const { jsPDF } = await import('jspdf');
    const pdfInstance = jsPDF.mock.results[0].value;
    expect(global.fetch).toHaveBeenCalledWith('https://res.cloudinary.com/demo/image/upload/photo.jpg');
    expect(pdfInstance.addImage).toHaveBeenCalled();
    expect(pdfInstance.addImage.mock.calls[1][0]).toBe('data:image/jpeg;base64,ZmFrZQ==');
    expect(pdfInstance.save).toHaveBeenCalledWith(expect.stringContaining('FaceSheet_Jane_Doe.pdf'));
  });

  test('still completes PDF export when resident photo cannot be loaded', async () => {
    global.fetch = jest.fn(async (url) => {
      if (String(url).includes('logo.png')) {
        return {
          ok: true,
          blob: async () => new Blob(['logo'], { type: 'image/png' }),
        };
      }
      return {
        ok: false,
        blob: async () => new Blob([], { type: 'image/jpeg' }),
      };
    });

    await downloadFaceSheetPDF({
      residentName: 'Jane Doe',
      values: { date_of_birth: '1990-01-01' },
      generatedBy: 'Admin User',
      photoUrl: 'https://res.cloudinary.com/demo/image/upload/missing.jpg',
    });

    const { jsPDF } = await import('jspdf');
    const pdfInstance = jsPDF.mock.results[0].value;
    expect(global.fetch).toHaveBeenCalledWith('https://res.cloudinary.com/demo/image/upload/missing.jpg');
    expect(pdfInstance.save).toHaveBeenCalledWith(expect.stringContaining('FaceSheet_Jane_Doe.pdf'));
  });
});
