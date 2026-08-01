import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HelpView } from './HelpView';

describe('HelpView', () => {
  it('shows the install steps', () => {
    render(<HelpView />);
    expect(screen.getByText('Install on your iPhone')).toBeInTheDocument();
    expect(screen.getByText(/Add to Home Screen/)).toBeInTheDocument();
  });

  it('renders each FAQ as a collapsed details/summary', () => {
    render(<HelpView />);
    const items = document.querySelectorAll('details');
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item.hasAttribute('open')).toBe(false);
    }
    expect(
      screen.getByText('What does the "entered in DTS" checkbox actually do?'),
    ).toBeInTheDocument();
  });

  it('shows the workflow overview as the first FAQ item, rendered as a bulleted list', () => {
    render(<HelpView />);
    const items = document.querySelectorAll('details summary');
    expect(items[0].textContent).toBe('What’s the expected workflow?');

    const firstDetails = items[0].closest('details')!;
    const listItems = firstDetails.querySelectorAll('ul li');
    expect(listItems.length).toBeGreaterThan(1);
    // MILEAGE is itemized on Entry, not a separate tab.
    expect(firstDetails.textContent).toMatch(/MILEAGE/);
    expect(firstDetails.textContent).not.toMatch(/MILEAGE tab/i);
  });

  it('explains multiple trips', () => {
    render(<HelpView />);
    expect(screen.getByText('How do multiple trips work?')).toBeInTheDocument();
  });
});
