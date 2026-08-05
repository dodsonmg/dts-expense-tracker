import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PhotoLightbox } from './PhotoLightbox';

describe('PhotoLightbox', () => {
  it('renders the given photo', () => {
    render(<PhotoLightbox url="blob:fake" type="image/jpeg" onClose={vi.fn()} />);

    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByAltText('Receipt')).toHaveAttribute('src', 'blob:fake');
  });

  it('closes via the close button', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<PhotoLightbox url="blob:fake" type="image/jpeg" onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: /close receipt photo/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes when the backdrop is tapped', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<PhotoLightbox url="blob:fake" type="image/jpeg" onClose={onClose} />);

    await user.click(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when the photo itself is tapped', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<PhotoLightbox url="blob:fake" type="image/jpeg" onClose={onClose} />);

    // Tapping the image happens while zooming/panning a receipt; only the
    // backdrop should dismiss.
    await user.click(screen.getByAltText('Receipt'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<PhotoLightbox url="blob:fake" type="image/jpeg" onClose={onClose} />);

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders a PDF via <embed> instead of <img>', () => {
    render(
      <PhotoLightbox url="blob:fake" type="application/pdf" onClose={vi.fn()} />,
    );

    expect(
      document.querySelector('embed[type="application/pdf"]'),
    ).not.toBeNull();
    expect(screen.queryByAltText('Receipt')).toBeNull();
  });

  it('does not close when the PDF embed itself is tapped', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <PhotoLightbox url="blob:fake" type="application/pdf" onClose={onClose} />,
    );

    const embed = document.querySelector('embed[type="application/pdf"]')!;
    await user.click(embed);
    expect(onClose).not.toHaveBeenCalled();
  });
});
