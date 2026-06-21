import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import FaceSheet from '@/app/components/FaceSheet.jsx';

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(() => ({
    auth: { accessToken: 'access-token', user: { first_name: 'Admin', last_name: 'User' } },
    csrfToken: 'csrf-token',
  })),
  authHeaders: jest.fn(),
}));

jest.mock('@/lib/face-sheet-pdf', () => ({
  downloadFaceSheetPDF: jest.fn().mockResolvedValue(undefined),
}));

describe('FaceSheet photo upload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('uploads resident photo without forcing JSON content type', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockImplementation(async (url) => {
      if (String(url).includes('/api/v1/residents/res-1')) {
        return {
          ok: true,
          json: async () => ({ data: { id: 'res-1', first_name: 'John', last_name: 'Doe' } }),
        };
      }
      if (String(url).includes('/api/v1/face-sheets/resident/res-1')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: {
              id: 'fs-1',
              resident_id: 'res-1',
              form_data: {},
              photo_url: 'https://res.cloudinary.com/demo/image/upload/v1/dcllc/tenant-1/face-sheets/res-1.jpg',
            },
          }),
        };
      }
      if (String(url).includes('/api/v1/face-sheets/fs-1/photo')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              photo_url: 'https://res.cloudinary.com/demo/image/upload/v2/dcllc/tenant-1/face-sheets/res-1.jpg',
            },
          }),
        };
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    const { container } = render(
      <FaceSheet residentId="res-1" resident={{ first_name: 'John', last_name: 'Doe' }} canEdit />
    );

    await waitFor(() => expect(screen.getByText(/Photo on file|No photo uploaded/i)).toBeInTheDocument());

    const input = container.querySelector('input[type="file"]');
    expect(input).toBeTruthy();

    const file = new File(['image-bytes'], 'resident.jpg', { type: 'image/jpeg' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/face-sheets/fs-1/photo',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: expect.any(FormData),
      })
    ));

    const uploadOptions = fetchMock.mock.calls.find(([url]) => String(url).includes('/api/v1/face-sheets/fs-1/photo'))?.[1];
    expect(uploadOptions.headers.Authorization).toBe('Bearer access-token');
    expect(uploadOptions.headers['X-CSRF-Token']).toBe('csrf-token');
    expect(uploadOptions.headers['Content-Type']).toBeUndefined();

    const uploadBody = uploadOptions.body;
    expect(uploadBody.get('photo')).toBe(file);

    await waitFor(() => expect(screen.getByAltText('John Doe resident photo'))
      .toHaveAttribute('src', 'https://res.cloudinary.com/demo/image/upload/v2/dcllc/tenant-1/face-sheets/res-1.jpg'));
  });
});
