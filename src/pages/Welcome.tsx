import { useState } from 'react';
import { useStore } from '../store';
import { navigate } from '../router';
import { RefList } from '../components/common';
import { Icon } from '../components/Icon';

export function Welcome() {
  const { state, update } = useStore();
  const [agreed, setAgreed] = useState(state.acceptedDisclaimer);

  function start() {
    update((s) => ({ ...s, acceptedDisclaimer: true }));
    navigate(state.assessments.length ? 'today' : 'assess');
  }

  return (
    <div>
      <section className="hero">
        <h1>Your personality isn't set in stone. You can shape it.</h1>
        <p className="lead">
          Traits like conscientiousness, warmth and calm predict how your relationships, work and health turn out.
          Research now shows that people can change them on purpose, through small actions practised week after week. Trait
          Trainer turns that research into a 12-week plan built around your own goal.
        </p>
      </section>

      <div className="grid-2 benefits">
        <div className="card">
          <span className="benefit-icon">
            <Icon name="trend" size={22} />
          </span>
          <h3>Faster than waiting</h3>
          <p>
            On average, structured programs produced about five times the change that happens naturally over the same
            months.
          </p>
          <RefList ids={['haehner2024']} />
        </div>
        <div className="card">
          <span className="benefit-icon">
            <Icon name="clock" size={22} />
          </span>
          <h3>Change that lasts</h3>
          <p>
            Gains held at follow-ups up to a year later. In one coaching-app trial, people aiming to be calmer kept
            getting calmer in the year after it ended.
          </p>
          <RefList ids={['haehner2024', 'stieger2024']} />
        </div>
        <div className="card">
          <span className="benefit-icon">
            <Icon name="check" size={22} />
          </span>
          <h3>In your hands</h3>
          <p>
            What predicted change was what people did, not who they were: commitment and regular practice mattered,
            age and gender didn't. In one study, students who chose emotional stability and did about eight challenges
            a week grew clearly in it within four months; at two a week, they didn't change.
          </p>
          <RefList ids={['olaru2026', 'hudson2021', 'roberts2017']} />
        </div>
        <div className="card">
          <span className="benefit-icon">
            <Icon name="heart" size={22} />
          </span>
          <h3>Worth the effort</h3>
          <p>
            Traits predict relationships, success at work, health and even how long people live, often as strongly as
            IQ or income and education. In one coaching-app trial, as people's traits changed, their self-esteem and
            life satisfaction tended to rise too.
          </p>
          <RefList ids={['roberts2007', 'allemand2024', 'olaru2023']} />
        </div>
        <div className="card">
          <span className="benefit-icon">
            <Icon name="users" size={22} />
          </span>
          <h3>Others notice</h3>
          <p>In a randomized trial of a coaching app, friends and family saw people's increases too.</p>
          <RefList ids={['stieger2021']} />
        </div>
        <div className="card">
          <span className="benefit-icon">
            <Icon name="sprout" size={22} />
          </span>
          <h3>Built on your strengths</h3>
          <p>
            Your results show what you already do well, and each weekly reflection starts with what went well and
            which strengths you used.
          </p>
        </div>
      </div>

      <div className="card">
        <h2>How it works</h2>
        <ol className="steps">
          <li>
            <strong>Measure.</strong> Take a free, scientifically validated 50-item Big Five questionnaire (about 5
            minutes).
          </li>
          <li>
            <strong>Choose one goal and commit to it.</strong> For example: be more conscientious, warmer, more
            outgoing, more open, or calmer and more emotionally stable. Write down why it matters to you. You can add a
            second trait once the first feels settled.
          </li>
          <li>
            <strong>Take on weekly challenges.</strong> Small, concrete actions matched to your goal, each paired with
            an <em>if-then plan</em> that says exactly when and where you'll do it.
            <RefList ids={['hudson2015', 'hudson2019']} />
          </li>
          <li>
            <strong>Follow a stepwise path.</strong> Small, sure steps first, then habits, then consolidation, then
            maintenance. Check in daily, reflect weekly, and re-measure every 4 weeks over a 12-week program.
          </li>
          <li>
            <strong>Get follow-through support.</strong> A daily calendar reminder, someone who checks in on you, and a
            plan for missed days, because the people who keep practising are the ones who change most.
          </li>
        </ol>
        <p className="muted">
          These steps follow the methods of controlled trials, especially PEACH, a randomized trial of a coaching app. A
          few details, like the order of the path, are this app's own; the Science page says which.
        </p>
        <RefList ids={['stieger2021']} />
      </div>

      <div className="card soft">
        <h3>Before you start</h3>
        <ul>
          <li>
            This is a self-improvement tool, <strong>not therapy or a diagnosis</strong>. If you're struggling with
            anxiety, depression, or anything that feels overwhelming, please talk to a professional. Evidence-based
            therapy works well.
          </li>
          <li>
            If you are in crisis or thinking about harming yourself, call or text <strong>988</strong> (US) or find a
            line in your country at{' '}
            <a href="https://findahelpline.com" target="_blank" rel="noreferrer">
              findahelpline.com
            </a>
            .
          </li>
          <li>
            <strong>What to expect.</strong> Change builds over weeks, not days, and progress goes up and down. Most of
            the evidence comes from people's own ratings, and friends and family see part of the change, often later.
            In the studies, more practice went with more change.
            <RefList ids={['haehner2024', 'stieger2021', 'hudson2021']} />
          </li>
          <li>
            Stretching yourself can feel tiring or uncomfortable at times, and changes can affect the people around
            you. Ease off if it feels like too much. Side effects of these programs have barely been studied, so
            researchers recommend saying this up front.
            <RefList ids={['haehner2026', 'asselmann2026']} />
          </li>
          <li>Your answers are stored only in this browser. Nothing is sent to a server.</li>
        </ul>
        <label className="row" style={{ marginTop: 12 }}>
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          <span>I understand this is not a substitute for professional care.</span>
        </label>
      </div>

      <div className="row">
        <button className="primary" disabled={!agreed} onClick={start}>
          {state.assessments.length ? 'Continue' : 'Start the questionnaire →'}
        </button>
        <a className="btn" href="#/science">
          Read the science first
        </a>
      </div>
    </div>
  );
}
