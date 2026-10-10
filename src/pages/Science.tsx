import { REFERENCE_LIST } from '../data/references';
import { EvidencePill, RefList } from '../components/common';
import type { EvidenceLevel } from '../types';

const PRINCIPLES: { principle: string; inApp: string; level: EvidenceLevel; refs: string[] }[] = [
  {
    principle:
      'On its own, wanting to change goes with little or no actual change. Structured programs that turn the goal into specific, repeated actions show more change, though the effects are still modest.',
    inApp: 'Every goal is turned into concrete weekly challenges rather than affirmations or mindset content.',
    level: 'moderate',
    refs: ['baranski2020', 'haehner2024', 'olaru2026'],
  },
  {
    principle:
      'In one study, completing challenges went with self-reported growth in three of the five traits, while taking on more than you completed went with slightly less growth.',
    inApp:
      'Start easy (in that study, harder challenges did not predict more growth on average), commit only to what you\'re confident you\'ll do, and count every repetition. The app lowers the difficulty after a hard week and never pushes you to Stretch.',
    level: 'emerging',
    refs: ['hudson2019'],
  },
  {
    principle:
      'If-then plans turn intentions into action (strong for reaching goals; for trait change, one unreplicated student study).',
    inApp: 'Every challenge needs an if-then plan naming when and where you\'ll do it.',
    level: 'strong',
    refs: ['gollwitzer2006', 'hudson2015'],
  },
  {
    principle:
      'Many small, repeated moments of acting differently from your usual self, in the direction you want, are thought to add up to trait change. In one coaching-app trial, people\'s weekly ratings of how they acted, thought and felt moved toward their goal, and those who moved furthest from their usual level reported more trait change.',
    inApp: 'Challenges repeat through the week, and ones you completed are suggested again so the new behaviour gets regular practice.',
    level: 'emerging',
    refs: ['wrzus2017', 'olaru2026', 'allemand2024'],
  },
  {
    principle: 'Tracking progress improves goal attainment.',
    inApp: 'Daily check-offs and a 20-second rating of how you acted today, plus weekly progress charts.',
    level: 'strong',
    refs: ['harkin2016'],
  },
  {
    principle:
      'Enjoying the practice goes with slightly more self-reported change. Weeks when your strengths feel clearer and you feel more able to act as you want also go with acting and feeling more in line with your goal.',
    inApp:
      'A weekly reflection that starts from what went well and which strengths you used, asks how much you enjoyed each challenge, and turns obstacles into new if-then plans.',
    level: 'emerging',
    refs: ['allemand2017', 'allemand2024', 'olaru2026'],
  },
  {
    principle: 'For emotional stability, it matters that you chose the goal yourself.',
    inApp: 'You choose your own goals. The app never assigns them.',
    level: 'emerging',
    refs: ['hudson2021'],
  },
  {
    principle:
      'In one app trial (CHILL), in-the-moment strategies (like relaxation or a walk) lowered neuroticism more at first, but the drop faded unless habit-building was added. Habit strategies started slower and kept improving after the program. Among habit strategies, behavioural ones produced the self-reported drop, while thought-based ones were linked only to friends\' ratings at follow-up.',
    inApp:
      'Neuroticism challenges pair in-the-moment activities (walks, exercise, planned mood-lifters, which CHILL counted as state strategies) with habit-building ones (if-then plans, rethinking thoughts, skill practice), as in CHILL\'s most durable group.',
    level: 'emerging',
    refs: ['wright2026'],
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
            intervention studies, mostly therapy or medication for problems like anxiety and depression, people's trait
            scores shifted within a few months, emotional stability most of all. Where patients were followed up, the
            shift was still there a year or more later.
          </li>
          <li>
            <strong>People can change traits on purpose</strong>, with structured support. In a 3-month smartphone
            coaching trial (1,523 signed up, 875 started), participants reported more change in their chosen direction
            than a group on a 1-month waitlist, and their own ratings still showed the change 3 months after the program.
            Friends, family and partners saw smaller changes, and only the increases were clear in their ratings.
          </li>
          <li>
            <strong>The effects are real but modest.</strong> A 2024 review pooled seven programs: the average
            before-to-after change was d ≈ 0.22, a small shift but about five times the natural change over the same
            period. In that review, extraversion, emotional stability and conscientiousness moved most and agreeableness
            and openness least, but each trait's figure rests on only a handful of studies.
          </li>
          <li>
            <strong>Some reported change may come from expectations, or from who signs up.</strong> In a 2025 paper,
            people on a waitlist reported nearly as much change as people in two light-touch online programs, and people
            who only signed up for a study about liking themselves better reported gains too. So judge your progress
            mainly by what you actually do differently, not just by questionnaire scores.
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
          Trait Trainer runs for <strong>12 weeks</strong> and borrows its structure from tested programs (Hudson's
          student studies ran 15–16 weeks and PEACH about 3 months; across studies, programs averaged about 10 weeks). In
          those, people worked toward self-chosen trait goals through concrete weekly steps with if-then plans, and the
          PEACH coaching app added twice-daily chatbot check-ins, reflection and progress feedback. The app's own choices are allowing up to two goals (PEACH used one), re-measuring every four weeks,
          adapting difficulty (after a week where you hit 80%+ of your targets it suggests Medium, below 50% easier and fewer
          challenges, and it never moves you to Stretch on its own), and a maintenance phase after week 12.
        </p>
        <RefList ids={['hudson2015', 'hudson2019', 'stieger2018', 'stieger2021', 'stieger2024', 'haehner2024', 'olaru2026']} />
      </div>

      <div className="card">
        <h2>Honest caveats</h2>
        <ul>
          <li>Most studies used university students or motivated online volunteers from Western countries.</li>
          <li>
            Most outcomes are self-reported. Friends and family rate smaller changes. In one trial few of them took part,
            and their ratings of decreases (such as becoming less anxious) went the intended way but were not
            statistically significant.
          </li>
          <li>
            People are poor judges of their own change: in one study, about 4 in 10 perceived change in the wrong
            direction. That's why the app re-measures rather than asking "do you feel different?"
          </li>
          <li>
            Long-term durability is thinly studied. A 2024 review could pool follow-ups from only four studies. Changes
            seemed to hold, but the longest follow-ups are small: 25 people after 4 years in one coaching study, and about
            1 in 10 of the original participants at one year in an app trial.
          </li>
          <li>
            Many challenges were tested on outcomes close to a trait (anxiety, mood, goal attainment, connection) rather
            than on the trait itself. Each technique's note in the Toolkit says which.
          </li>
          <li>
            Several questionnaire items describe behaviours the challenges practise (e.g. "start conversations"). Doing
            the challenges can therefore raise your score partly by changing how you answer. For a reality check, PEACH
            researchers suggest (untested) asking someone who often sees you in the situations you're working on, such
            as a colleague for organisation or a partner for stress, and note that people who've known you for years may
            be slow to update their view.
          </li>
          <li>
            Acting against your nature may have costs for some people: in one trial, acting extraverted for a week
            tended to tire the most introverted participants, though not people on average. No trait level is better in
            every situation.
          </li>
          <li>
            Trait Trainer itself has not been tested in a trial. It combines tested ingredients, but the combination is
            unproven.
          </li>
        </ul>
        <RefList
          ids={['stieger2021', 'stieger2024', 'olaru2024', 'hudson2019jrp', 'kramer2025', 'jacqueshamilton2019', 'haehner2024']}
        />
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
        Titles in [square brackets] are descriptive: the paper's authors and journal were confirmed, but its exact title
        could not be checked.
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
