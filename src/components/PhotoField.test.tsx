import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { prepareAttachment } from '../lib/photo';
import { PhotoField } from './PhotoField';

vi.mock('../lib/photo', async () => {
  const actual = await vi.importActual<typeof import('../lib/photo')>(
    '../lib/photo',
  );
  return {
    ...actual,
    prepareAttachment: vi.fn(async (blob: Blob) => blob),
  };
});

const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');

function setClipboard(read: () => Promise<ClipboardItem[]>) {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { read },
  });
}

function renderField(onSelect = vi.fn()) {
  render(
    <PhotoField
      preview={null}
      onSelect={onSelect}
      onRemove={vi.fn()}
      idPrefix="test"
      slot={2}
    />,
  );
  return onSelect;
}

beforeEach(() => {
  vi.mocked(prepareAttachment).mockClear();
  setClipboard(async () => []);
});

afterEach(() => {
  if (originalClipboard) {
    Object.defineProperty(navigator, 'clipboard', originalClipboard);
  } else {
    Reflect.deleteProperty(navigator, 'clipboard');
  }
});

describe('PhotoField clipboard paste', () => {
  it('prepares and attaches an image from the clipboard', async () => {
    const user = userEvent.setup();
    const image = new Blob(['screenshot'], { type: 'image/png' });
    const getType = vi.fn().mockResolvedValue(image);
    const read = vi.fn().mockResolvedValue([
      { types: ['image/png'], getType },
    ]);
    setClipboard(read);
    const onSelect = renderField();

    await user.click(screen.getByRole('button', { name: /paste screenshot/i }));

    expect(read).toHaveBeenCalledOnce();
    expect(getType).toHaveBeenCalledWith('image/png');
    expect(prepareAttachment).toHaveBeenCalledWith(image);
    expect(onSelect).toHaveBeenCalledWith(image);
  });

  it('explains when the clipboard has no image', async () => {
    const user = userEvent.setup();
    setClipboard(async () => [
      { types: ['text/plain'], getType: vi.fn() } as unknown as ClipboardItem,
    ]);
    const onSelect = renderField();

    await user.click(screen.getByRole('button', { name: /paste screenshot/i }));

    expect(
      await screen.findByText(/no image found\. copy a screenshot or image/i),
    ).toBeInTheDocument();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('explains when clipboard permission is denied', async () => {
    const user = userEvent.setup();
    setClipboard(async () => {
      throw new DOMException('Permission denied', 'NotAllowedError');
    });
    renderField();

    await user.click(screen.getByRole('button', { name: /paste screenshot/i }));

    expect(
      await screen.findByText(/clipboard access was denied/i),
    ).toBeInTheDocument();
  });
});
