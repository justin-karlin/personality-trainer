import { REFERENCE_LIST } from '../data/references';
import { EvidencePill, RefList } from '../components/common';
import type { EvidenceLevel } from '../types';

const PRINCIPLES: { principle: string; inApp: string; level: EvidenceLevel; refs: string[] }[] = [
  {
    principle: 'Wanting to change is not enough. Change comes from structured, repeated action.',
    inApp: 'Every goal is turned into concrete weekly challenges rather than affirmations or mindset content.',
    level: 'strong',
    refs: ['baranski2020', 'haehner2024', 'olaru2025'],
  },
  {
    principle: 'Completing challenges predicts change; accepting challenges and not doing them can backfire.',
    inApp: 'Start easy, pick only what you\'re confident about, and let the app lower the difficulty after a hard week.',
    level: 'moderate',
    refs: ['hudson2019'],
  },
  {
    principle: 'If-then plans turn intentions into action.',
    inApp: 'Every challenge needs an if-then plan naming when and where you\'ll do it.',
    level: 'strong',
    refs: ['gollwitzer2006', 'hudson2015'],
  },
  {
    principle: 'Many small, repeated trait-consistent moments add up to trait change.',
    inApp: 'Challenges repeat through the week, and ones you completed are suggested again to build habits.',
    level: 'moderate',
    refs: ['wrzus2017', 'olaru2025', 'allemand2024'],
  },
  {
    principle: 'Tracking progress improves goal attainment.',
    inApp: 'Daily check-offs and a 20-second rating of how you acted today, plus weekly progress charts.',
    level: 'strong',
    refs: ['harkin2016'],
  },
  {
    principle: 'Reflection, drawing on your strengths, and enjoyment support change.',
    inApp: 'A weekly reflection that starts from what went well and turns obstacles into new if-then plans.',
    level: 'emerging',
    refs: ['allemand2017', 'allemand2024', 'olaru2025'],
  },
  {
    principle: 'For emotional stability, it matters that you chose the goal yourself.',
    inApp: 'You choose your own goals. The app never assigns them.',
    level: 'emerging',
    refs: ['hudson2021'],
  },
  {
    principle: 'Behavioural habits last longer than in-the-moment coping tricks.',
    inApp: 'Neuroticism challenges emphasise repeated behaviours (exercise, activity scheduling, facing fears) over one-off thought exercises.',
    level: 'emerging',
    refs: ['haehner2025chill', 'furukawa2021'],
  },
];

export function Science() {
  return (
    <div>
      <h1>The science behind Trait Trainer</h1>
      <p className="muted">
        This page summarises the research the app is built on, including its limits. Evidence labels are explained in
        the Toolkit.
      </p>

      <div className="card">
        <h2>The short version</h2>
        <ul>
          <li>
            <strong>Personality traits can change.</strong> They shift naturally across adulthood, and across 207
            intervention studies (mostly therapy), traits changed meaningfully within months, emotional stability most of
            all.
          </li>
          <li>
            <strong>People can change traits on purpose</strong>, if they turn the goal into specific behaviours they
            actually carry out. A 3-month smartphone coaching trial with 1,500+ people found changes in the desired
            direction, noticed by friends too, that held up months later.
          </li>
          <li>
            <strong>The effects are real but modest.</strong> A 2024 review put the average effect of these programs at
            d ≈ 0.22: a small-to-moderate shift, not a transformation. Emotional stability and extraversion tend to move
            most; agreeableness and openness least.
          </li>
          <li>
            <strong>Some of the change people report may be expectation.</strong> In one careful 2025 study, a waitlist
            group reported as much change as the program groups. Judge your progress by what you do and by what people
            around you notice, not just by questionnaire scores.
          </li>
        </ul>
        <RefList ids={['roberts2017', 'stieger2021', 'haehner2024', 'kramer2025']} />
      </div>

      <h2>Design principles</h2>
      <div className="stack" style={{ marginBottom: 18 }}>
        {PRINCIPLES.map((p) => (
          <div className="card" key={p.principle} style={{ marginBottom: 0 }}>
            <div className="spread" style={{ alignItems: 'flex-start' }}>
              <strong style={{ flex: 1 }}>{p.principle}</strong>
              <EvidencePill level={p.level} />
            </div>
            <p className="muted" style={{ margin: '6px 0' }}>
              <strong>In the app:</strong> {p.inApp}
            </p>
            <RefList ids={p.refs} />
          </div>
        ))}
      </div>

      <div className="card">
        <h2>How the program works</h2>
        <p>
          The structure mirrors the programs that have been tested: <strong>12 weeks</strong> (studies ran 10–16),
          one or two self-chosen goals, weekly behavioural challenges with if-then plans, daily self-monitoring, weekly
          reflection and feedback, and re-measurement every four weeks. Challenge difficulty adapts: after a week where
          you hit 80%+ of your targets, the app suggests harder challenges; below 50%, easier and fewer ones.
        </p>
        <RefList ids={['hudson2015', 'stieger2018', 'stieger2021']} />
      </div>

      <div className="card">
        <h2>Honest caveats</h2>
        <ul>
          <li>Most studies used university students or motivated online volunteers from Western countries.</li>
          <li>
            Most outcomes are self-reported. Friends and family see smaller changes, and in one trial did not detect
            decreases at all.
          </li>
          <li>
            People are poor judges of their own change: in one study, about 4 in 10 perceived change in the wrong
            direction. That's why the app re-measures rather than asking "do you feel different?"
          </li>
          <li>
            Long-term durability is thinly studied. One-year data exist, but only for a minority of the original
            participants.
          </li>
          <li>
            Many challenges were tested on outcomes close to a trait (anxiety, mood, goal attainment, connection) rather
            than on the trait itself. Each technique's note in the Toolkit says which.
          </li>
          <li>
            Several questionnaire items describe behaviours the challenges practise (e.g. "start conversations"). Doing
            the challenges can therefore raise your score partly by changing how you answer. Asking someone who knows you
            well is a useful reality check.
          </li>
          <li>
            Acting against your nature has costs for some people: acting extraverted can be tiring for introverts. No
            trait level is better in every situation.
          </li>
          <li>
            Trait Trainer itself has not been tested in a trial. It combines tested ingredients, but the combination is
            unproven.
          </li>
        </ul>
        <RefList ids={['stieger2021', 'stieger2024', 'hudson2019jrp', 'kramer2025', 'jacqueshamilton2019', 'haehner2024']} />
      </div>

      <div className="card">
        <h2>Measurement</h2>
        <p>
          The questionnaire is the IPIP 50-item Big-Five Factor Markers (Goldberg, 1992): public domain, widely used, with
          good reliability. The fifth factor is labelled "Intellect/Imagination" in the IPIP and shown here as
          Openness. Percentiles are rough, calculated from ~19,700 people who took the same items online (Open-Source
          Psychometrics Project). The optional well-being check is the PHQ-4, a validated 4-question screen for anxiety
          and depression.
        </p>
        <RefList ids={['kroenke2009']} />
      </div>

      <div className="card">
        <h2>Safety</h2>
        <p>
          The techniques for emotional stability come from CBT and related therapies, which have strong evidence when
          delivered by professionals. Self-guided versions help most with mild difficulties. If you're dealing with
          moderate or severe anxiety or depression, guided or professional care works better. If you're in crisis,
          call or text <strong>988</strong> (US) or visit{' '}
          <a href="https://findahelpline.com" target="_blank" rel="noreferrer">
            findahelpline.com
          </a>
          .
        </p>
        <RefList ids={['karyotaki2021']} />
      </div>

      <h2>All references</h2>
      <p className="muted" style={{ fontSize: '0.88rem' }}>
        Titles in [square brackets] are descriptive: the paper's authors, venue and DOI were confirmed, but its exact
        title could not be checked.
      </p>
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
    </div>
  );
}
