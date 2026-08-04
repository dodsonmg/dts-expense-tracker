import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PhotoLightbox } from './PhotoLightbox';

describe('PhotoLightbox', () => {
  it('renders the given photo', () => {
    render(<PhotoLightbox url="blob:fake" onClose={vi.fn()} />);

    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByAltText('Receipt')).toHaveAttribute('src', 'blob:fake');
  });

  it('closes via the close button', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<PhotoLightbox url="blob:fake" onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: /close receipt photo/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes when the backdrop is tapped', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<PhotoLightbox url="blob:fake" onClose={onClose} />);

    await user.click(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when the photo itself is tapped', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<PhotoLightbox url="blob:fake" onClose={onClose} />);

    // Tapping the image happens while zooming/panning a receipt; only the
    // backdrop should dismiss.
    await user.click(screen.getByAltText('Receipt'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<PhotoLightbox url="blob:fake" onClose={onClose} />);

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
