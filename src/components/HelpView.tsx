// The one screen with no live data — pure static content, unlike every other
// tab (which reads from useTripData()). That's deliberate, not an oversight.
//
// Keep the FAQ answers in sync with CLAUDE.md's "Domain invariants" section —
// that file is the source of truth for how the app actually behaves; this is
// just a friendlier restatement of it. There's no automated check for drift,
// so re-read it when either changes.
const FAQS: { q: string; a: string }[] = [
  {
    q: 'Why aren’t GBP and USD ever added together?',
    a: 'They’re different things: GBP is what the receipt says at the time of purchase, USD is what actually lands on the card (or what DTS reimburses). No conversion happens anywhere in the app — totals always keep the two currencies in separate columns.',
  },
  {
    q: 'What does "USD pending" mean?',
    a: 'An expense has a GBP amount but no USD amount yet — the charge hasn’t landed on the card statement. Filter for these on the List tab; the CSV/xlsx export flags them too.',
  },
  {
    q: 'What’s the difference between "USD incomplete" and "mismatch"?',
    a: 'A mismatch means your total differs from what you typed in from DTS. Incomplete means the total includes a USD-pending expense, so the comparison is premature — it isn’t a reliable signal yet either way. When a row is both, incomplete wins visually (yellow), since that’s the more urgent thing to know.',
  },
  {
    q: 'What is M&IE, and why can’t I add it as an itemized row?',
    a: 'M&IE is the per-diem allowance — a calculator (full/partial days × rates), not a receipt. It’s USD-only and always counts toward the Personal account, never GTCC. DTS shows it as one lump total, so the app computes one number too, on its own tab.',
  },
  {
    q: 'Why does MILEAGE work differently from M&IE?',
    a: 'DTS shows each mileage leg as its own line, not a single lump sum like M&IE — so MILEAGE stays an itemized expense you can check off individually. Selecting it defaults the Entry/List form to a miles × rate calculator (still USD-only), with a link to switch to typing the USD amount directly if the calculator doesn’t fit.',
  },
  {
    q: 'What does the "entered in DTS" checkbox actually do?',
    a: 'It’s bookkeeping, not money — it just tracks whether you’ve keyed an expense into DTS yet. It never changes any total. Use the List tab’s "not entered only" filter to see what’s outstanding.',
  },
  {
    q: 'How does DTS reconciliation work?',
    a: 'You read the totals DTS shows (per category, and per GTCC/Personal reimbursement) and type them into the Totals tab yourself — the app never talks to DTS directly. It compares your USD totals against what you typed, to the nearest cent, and flags anything that doesn’t match.',
  },
  {
    q: 'What do I get when I export?',
    a: 'A formatted .xlsx (mismatch rows red, USD-incomplete rows yellow, reconciliation tables up top) and a plain CSV with the same numbers as a fallback. Both are meant to work as a standalone spreadsheet at the office, where phones aren’t allowed.',
  },
  {
    q: 'Does any of my data leave my phone?',
    a: 'No accounts, no sync, no backend — everything lives on the device. The only thing that ever leaves is the CSV/.xlsx you choose to export and email yourself.',
  },
];

export function HelpView() {
  return (
    <div className="stack">
      <div className="card">
        <h2>Install on your iPhone</h2>
        <ol className="help-steps">
          <li>Open this site in <strong>Safari</strong> (not Chrome — only Safari can add a real full-screen app icon).</li>
          <li>Tap the <strong>Share</strong> icon.</li>
          <li>Tap <strong>Add to Home Screen</strong>, then Add.</li>
        </ol>
        <p className="muted small">
          Open it at least once while you have signal — after that, it keeps
          working with none.
        </p>
      </div>

      <div className="stack">
        {FAQS.map(({ q, a }) => (
          <details key={q} className="card">
            <summary>{q}</summary>
            <p className="muted small">{a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
