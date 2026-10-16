import { REFERENCE_LIST } from '../data/references';
import { RefList, LearnTabs } from '../components/common';
import { ScienceCarousel } from '../components/ScienceCarousel';

// Each entry is a short title plus one line. The full evidence, with numbers, is in docs/RESEARCH.md.
type Item = [title: string, line: string];

const FOUND: Item[] = [
  ['Traits can change.', 'Across 207 studies, mostly therapy, scores shifted within months.'],
  ['On purpose, too.', 'In an app trial, self-ratings moved toward goals and held.'],
  ['The change is modest.', 'About d ≈ 0.22 on average, probably less than therapy.'],
  ['Others see some of it.', 'Friends saw rises about two-thirds as big, not clear drops.'],
  ['Expectations play a part.', 'Waitlists reported change too. Judge by what you do.'],
];

const HELPS: Item[] = [
  ['Commitment.', 'The one predictor linked to change on every measure.'],
  ['Doing it.', 'Completing small actions predicted growth. Skipping them didn’t.'],
  ['If-then plans.', 'They reliably boost follow-through.'],
  ['Enjoying it.', 'People who enjoyed their plans reported more change.'],
  ['Choosing it.', 'Calmness practice helped only when people chose that goal.'],
  ['Structure, not willpower.', 'Apps with reminders lost fewer people. Willpower drills did little.'],
  ['Habits over quick fixes.', 'Quick calming faded. Habits kept improving.'],
];

const CAVEATS: Item[] = [
  ['Narrow samples.', 'Mostly students and online volunteers in Western countries.'],
  ['Mostly self-report.', 'Friends and family see smaller changes.'],
  ['Short follow-ups.', 'Few studies checked a year or more later.'],
  ['Practice can sway answers.', 'Some questions describe the challenges themselves.'],
  ['Effort has costs.', 'In one trial, acting outgoing tired the most introverted.'],
  ['Rough percentiles.', 'From about 19,700 people online (IPIP items, Goldberg 1992).'],
  ['This app is untested.', 'It combines tested parts. The mix is unproven.'],
];

function ItemList({ items }: { items: Item[] }) {
  return (
    <ul>
      {items.map(([title, line]) => (
        <li key={title}>
          <strong>{title}</strong> {line}
        </li>
      ))}
    </ul>
  );
}

export function Science() {
  return (
    <div>
      <LearnTabs current="science" />
      <h1>The science</h1>
      <ScienceCarousel />

      <div className="card">
        <h2>Safety</h2>
        <p>
          In crisis, call or text <strong>988</strong> (US) or{' '}
          <a href="https://findahelpline.com" target="_blank" rel="noreferrer">
            findahelpline.com
          </a>
          .
        </p>
      </div>

      <h2 style={{ marginTop: 8 }}>The evidence</h2>

      <div className="card disclosure-list">
        <details>
          <summary>What studies found</summary>
          <ItemList items={FOUND} />
          <RefList ids={['roberts2017', 'stieger2021', 'haehner2024', 'kramer2025']} />
        </details>

        <details>
          <summary>What helps</summary>
          <ItemList items={HELPS} />
          <RefList ids={['olaru2026', 'hudson2019', 'gollwitzer2006', 'allemand2017', 'hudson2021', 'linardon2020', 'friese2017', 'wright2026']} />
        </details>

        <details>
          <summary>Caveats</summary>
          <ItemList items={CAVEATS} />
          <RefList ids={['stieger2021', 'haehner2024', 'hudson2019jrp', 'jacqueshamilton2019']} />
        </details>

        <details>
          <summary>All references ({REFERENCE_LIST.length})</summary>
          <ol className="refs" style={{ paddingLeft: '1.3em' }}>
            {[...REFERENCE_LIST]
              .sort((a, b) => a.short.localeCompare(b.short))
              .map((r) => (
                <li key={r.id} style={{ marginBottom: 8 }}>
                  {r.authors} ({r.year}). {r.title}. <em>{r.source}</em>.{' '}
                  <a href={r.url} target="_blank" rel="noreferrer">
                    Link
                  </a>
                  <br />
                  <span style={{ color: 'var(--text)' }}>{r.finding}</span>
                </li>
              ))}
          </ol>
        </details>
      </div>
    </div>
  );
}
