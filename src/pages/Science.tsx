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
            <strong>How big is the change?</strong> A 2024 review pooled seven studies of programs averaging about 10
            weeks and found an average change toward people's goals of d ≈ 0.22. A rough comparison puts that at about
            five times the natural change over the same period, though probably below therapy (d ≈ 0.37, mostly
            clinical). In one controlled app trial, self-rated change was similar to therapy for people without a
            diagnosis. More practice went with more change: students who chose emotional stability and did nearly eight
            challenges a week were estimated to gain about 0.4 SD in four months.
          </li>
          <li>
            <strong>Do others see it?</strong> Partly. In one trial, friends, family and partners saw increases about
            two-thirds as big as people reported themselves, and only a smaller, statistically unreliable drop for
            decreases. Others may notice calmer emotions less, and later.
          </li>
          <li>
            <strong>Some reported change may come from expectations, or from who signs up.</strong> In a 2025 paper,
            people on a waitlist reported nearly as much change as people in two light-touch online programs, and people
            who only signed up for a study about liking themselves better reported gains too. So judge your progress
            mainly by what you actually do differently, not just by questionnaire scores.
          </li>
        </ul>
        <RefList ids={['roberts2017', 'stieger2021', 'haehner2024', 'wright2026', 'hudson2021', 'kramer2025']} />
      </div>

      <div className="card">
        <h2>Who changes most?</h2>
        <p>
          Studies haven't identified a personality type that changes more, though few have looked. What went with change
          was what people did.
        </p>
        <ul>
          <li>
            <strong>Not age or gender.</strong> Across 207 intervention studies, mostly therapy, a group's average age and
            gender mix didn't predict how much it changed, and clinical and non-clinical groups gained about equally over
            controls.
          </li>
          <li>
            <strong>Commitment.</strong> In a study of 956 people, commitment to the goal was the only predictor linked
            to change on every measure, including ratings by friends and family. How much people wanted to change showed
            up only in their own ratings.
          </li>
          <li>
            <strong>Doing it.</strong> Completing small, concrete actions predicted self-rated growth in three of five
            traits. Taking on challenges and skipping them predicted lagging behind peers. In one study, if-then
            coaching about doubled self-rated gains for people who wanted to be more outgoing.
          </li>
          <li>
            <strong>Enjoying it.</strong> People who enjoyed their plans reported more change.
          </li>
          <li>
            <strong>Choosing it.</strong> In two student studies, practice for emotional stability only went with
            self-rated growth in people who had chosen that goal themselves.
          </li>
          <li>
            <strong>Which trait.</strong> Wanting to change predicted more growth in extraversion and emotional
            stability than in agreeableness and openness.
          </li>
          <li>
            <strong>Follow-through traits help you stay.</strong> More conscientious people were more likely to stick
            with programs. Whether they also change more hasn't been tested.
          </li>
          <li>
            <strong>One limit.</strong> Very introverted people told to act extraverted all week didn't act much bolder
            in the moment, and some may have felt worse (an early finding). Smaller doses may be a safer start, though
            that's untested.
          </li>
        </ul>
        <RefList
          ids={['roberts2017', 'olaru2026', 'hudson2019', 'hudson2015', 'hudson2021', 'hudson2020', 'wright2026', 'jacqueshamilton2019']}
        />
      </div>

      <div className="card">
        <h2>Is there a best order?</h2>
        <p>
          None of the studies we draw on tested working on traits in a set order, such as emotional stability or
          conscientiousness first to make the others easier. In one study, practice mostly changed only the trait being
          practised. So the app's path is built around what went with more change, one trait at a time:
        </p>
        <ol>
          <li>Choose one trait and commit to it.</li>
          <li>Take small, sure steps with concrete if-then plans.</li>
          <li>
            Build habits by repeating what works and what you enjoy. Quick calming tools helped early but faded; habits
            started slower and kept improving.
          </li>
          <li>Consolidate, retake the questionnaire and re-check your goal. Then add a second trait if you want.</li>
          <li>Maintain with one favourite challenge per goal.</li>
        </ol>
        <p className="muted">
          Steps 1–3 target things that went with more change (small links, mostly in self-ratings), and step 5
          follows the long-term follow-up studies. The main trials had people work on one trait, but none compared
          that with working on several at once. The consolidation step and the order are this app's own design
          choices and haven't been tested.
        </p>
        <RefList ids={['hudson2019', 'hudson2021', 'olaru2026', 'wright2026', 'stieger2024']} />
      </div>

      <div className="card">
        <h2>Can I build conscientiousness first, so I'm less likely to quit?</h2>
        <p>
          Not in a tested way. No study has raised conscientiousness first and then checked whether people dropped out
          less. Here is what is known:
        </p>
        <ul>
          <li>
            <strong>Lower conscientiousness predicts quitting, a little.</strong> In several studies, people who stayed
            scored somewhat higher on it at the start, though not in every study.
          </li>
          <li>
            <strong>It responds to practice.</strong> In two student studies, conscientiousness challenges raised
            self-rated conscientiousness even in people who hadn't chosen it, though a third study found no link. In a
            two-week text-message program, self-discipline rose and close friends noticed.
          </li>
          <li>
            <strong>Choosing it doesn't mean quitting.</strong> In one app trial, people who picked a conscientiousness
            goal started well below others on it, yet stayed to the end about as often (35% vs 37%, our calculation
            from the trial's tables).
          </li>
          <li>
            <strong>Willpower drills aren't the answer.</strong> Practising self-control tasks gave small effects that
            shrank after correcting for publication bias, and a six-week trial found none.
          </li>
          <li>
            <strong>Structure helps instead.</strong> Across app trials, those that sent reminders lost fewer people,
            and human guidance led people to complete more of a program. If-then plans help most people follow through.
          </li>
        </ul>
        <p>
          So the app lends you structure instead of asking you to fix conscientiousness first. The follow-through kit
          on the Today page offers a calendar reminder, someone who checks in and a plan for missed days. If
          follow-through is your main struggle, conscientiousness itself is a reasonable first goal.
        </p>
        <RefList
          ids={['hudson2020', 'olaru2024', 'wright2026', 'hudson2021', 'hudson2023', 'stieger2020', 'stieger2024', 'friese2017', 'miles2016', 'linardon2020', 'musiat2022', 'gollwitzer2006']}
        />
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
