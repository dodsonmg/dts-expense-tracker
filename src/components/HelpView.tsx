// The one screen with no live data — pure static content, unlike every other
// tab (which reads from useTripData()). That's deliberate, not an oversight.
//
// Keep the FAQ answers in sync with CLAUDE.md's "Domain invariants" section —
// that file is the source of truth for how the app actually behaves; this is
// just a friendlier restatement of it. There's no automated check for drift,
// so re-read it when either changes.
import { FOREIGN_SYMBOL } from '../lib/format';

const FAQS: { q: string; a: string | string[] }[] = [
  {
    q: 'What’s the expected workflow?',
    a: [
      'Start (or switch to) a trip using the switcher in the header.',
      'Capture expenses as they happen on Entry, including MILEAGE — it’s an itemized expense like any other, just defaulting to a miles × rate calculator instead of a typed amount.',
      `For trips abroad: record the ${FOREIGN_SYMBOL} amount from the receipt right away, then backfill the USD amount on List once the charge actually lands on the card.`,
      'Log M&IE per-diem segments on their own tab.',
      'As charges land on your card / in DTS, check expenses off on List.',
      'At the end of the trip, read DTS’s own totals and enter them on Totals to reconcile.',
      'Or, skip the in-app reconciliation and export the formatted spreadsheet straight away — it carries the same DTS comparison, for reconciling at the office instead.',
    ],
  },
  {
    q: 'How do multiple trips work?',
    a: 'Tap the trip name in the header to switch trips, rename one, or start a new one — each trip keeps its own expenses, M&IE segments, and DTS totals completely separate. There’s always at least one trip; deleting the last one isn’t allowed. Export and the per-trip filename always reflect whichever trip is active. A whole-device backup covers every trip at once, restoring replaces all of them together.',
  },
  {
    q: 'What does "Archive" do to a trip?',
    a: 'It retires a finished trip without deleting anything — an archived trip disappears from the header switcher’s default list (tap "Show archived" to see it again, or to unarchive it) and stays fully usable if it’s still the active trip. Unlike Delete, it’s reversible and never touches your data.',
  },
  {
    q: 'What’s the "It’s been X days since your last backup" reminder?',
    a: 'A gentle nudge, not a requirement — it only shows up once it’s been a while and you’ve made a meaningful number of changes since your last backup or restore. Dismissing it just hides it for this visit; it comes back next time you open the app if you’re still overdue. Tap "Back up now" to jump straight to the Export tab’s backup panel.',
  },
  {
    q: `What does "${FOREIGN_SYMBOL}" mean?`,
    a: `Shorthand for "whatever foreign currency is on your receipt" — pounds, euros, yen, or anything else. The app doesn’t track which currency it is, just the amount your receipt shows before it’s reimbursed in USD.`,
  },
  {
    q: `Why aren’t ${FOREIGN_SYMBOL} and USD ever added together?`,
    a: `They’re different things: ${FOREIGN_SYMBOL} is what the receipt says, in the local currency, at the time of purchase; USD is what actually lands on the card (or what DTS reimburses). No conversion happens anywhere in the app — totals always keep the two currencies in separate columns.`,
  },
  {
    q: 'What does "USD pending" mean?',
    a: `An expense has a ${FOREIGN_SYMBOL} amount but no USD amount yet — the charge hasn’t landed on the card statement. Filter for these on the List tab; the CSV/xlsx export flags them too.`,
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
    q: 'Can I attach a photo of a receipt? What about a PDF?',
    a: 'Yes — one photo or PDF per expense, either as you add it on Entry or later by tapping the expense on List. Photos are shrunk before they’re saved so a trip’s worth of receipts doesn’t fill up your phone; PDFs (hotel folios, e-ticket confirmations) are stored as-is, capped at 10 MB. Rows that have one show a small marker on List; tap it to view full-screen.',
  },
  {
    q: 'Are receipt photos and PDFs included in the backup file?',
    a: 'No — this is the one thing a backup doesn’t cover. The backup is a text file of your expenses, and attachments would make it enormous, so they stay on this device only. If you restore onto a new phone you’ll get every expense back, but not the photos/PDFs. Keep anything you can’t afford to lose in your normal photo library too.',
  },
  {
    q: 'How do I get my receipts to the office for DTS?',
    a: 'Use "Export & share receipts (.zip)" on the Export tab. The zip holds the same formatted .xlsx plus one file per receipt, named to match its kind — receipt-01.jpg for a photo, receipt-01.pdf for a PDF, and so on. Those numbers match the spreadsheet’s "Receipt #" column, so as you key each line into DTS you can attach the correspondingly numbered file as evidence. The button only appears once at least one expense has an attachment.',
  },
  {
    q: 'Does any of my data leave my phone?',
    a: 'No accounts, no sync, no backend — everything lives on the device. The only things that ever leave are the files you choose to export and email yourself: the CSV/.xlsx, the receipts .zip, or the backup file.',
  },
];

export function HelpView() {
  return (
    <div className="stack">
      <div className="card">
        <h2>Install on your phone</h2>

        <h3 className="help-steps-label">iPhone (Safari)</h3>
        <ol className="help-steps">
          <li>Open this site in <strong>Safari</strong> — on iOS, only Safari can add a real full-screen app icon (Chrome on iOS can’t).</li>
          <li>Tap the <strong>Share</strong> icon.</li>
          <li>Tap <strong>Add to Home Screen</strong>, then Add.</li>
        </ol>

        <h3 className="help-steps-label">Android (Chrome)</h3>
        <ol className="help-steps">
          <li>Open this site in <strong>Chrome</strong>.</li>
          <li>Tap the <strong>⋮</strong> menu.</li>
          <li>Tap <strong>Install app</strong> (or <strong>Add to Home screen</strong>), then confirm.</li>
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
            {Array.isArray(a) ? (
              <ul className="muted small help-faq-list">
                {a.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            ) : (
              <p className="muted small">{a}</p>
            )}
          </details>
        ))}
      </div>
    </div>
  );
}
