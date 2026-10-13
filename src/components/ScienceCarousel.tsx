import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { SCIENCE_CARDS } from '../data/scienceCards';
import { CardViz } from './CardViz';
import { Icon } from './Icon';

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/** The key findings as a swipeable deck of cards, one fact per card. */
export function ScienceCarousel() {
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [moved, setMoved] = useState(false);
  // Motion only runs while the deck is on screen; each card's entrance plays once.
  const [inView, setInView] = useState(false);
  const [seen, setSeen] = useState<ReadonlySet<number>>(() => new Set());
  // Cards at least ~40% on screen: their entrance starts while they slide in.
  const [near, setNear] = useState<readonly number[]>([0]);
  const n = SCIENCE_CARDS.length;

  useEffect(() => {
    const el = sectionRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    // Any part of the deck in the upper 80% of the viewport counts, so this works at any
    // zoom level or viewport height.
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { rootMargin: '0px 0px -20% 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (inView && near.some((i) => !seen.has(i))) setSeen((s) => new Set([...s, ...near]));
  }, [inView, near, seen]);

  // Follow the scroll position (swipes, trackpads, buttons): which card is showing, and
  // how far each card is from the centre (--ap, which eases off-centre cards back).
  const onScroll = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const slides = Array.from(track.children) as HTMLElement[];
    const left = track.scrollLeft;
    const step = slides.length > 1 ? slides[1].offsetLeft - slides[0].offsetLeft : track.clientWidth;
    let best = 0;
    const close: number[] = [];
    slides.forEach((s, i) => {
      const p = Math.max(-1.5, Math.min(1.5, (s.offsetLeft - slides[0].offsetLeft - left) / step));
      s.style.setProperty('--ap', Math.min(1, Math.abs(p)).toFixed(3));
      if (Math.abs(p) < 0.6) close.push(i);
      if (Math.abs(s.offsetLeft - left) < Math.abs(slides[best].offsetLeft - left)) best = i;
    });
    setIndex(best);
    setNear((prev) => (prev.join() === close.join() ? prev : close));
    if (best > 0) setMoved(true);
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let frame = 0;
    const handler = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(onScroll);
    };
    onScroll();
    track.addEventListener('scroll', handler, { passive: true });
    window.addEventListener('resize', handler);
    return () => {
      track.removeEventListener('scroll', handler);
      window.removeEventListener('resize', handler);
      cancelAnimationFrame(frame);
    };
  }, [onScroll]);

  function go(i: number) {
    const track = trackRef.current;
    const target = Math.max(0, Math.min(n - 1, i));
    const slide = track?.children[target] as HTMLElement | undefined;
    if (!track || !slide) return;
    // The card holding focus is about to become inert; keep focus in the deck so the arrow keys keep working.
    if (track.contains(document.activeElement)) sectionRef.current?.focus({ preventScroll: true });
    track.scrollTo({ left: slide.offsetLeft, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    setIndex(target);
    setMoved(true);
  }

  function onKeyDown(e: KeyboardEvent<HTMLElement>) {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      go(index + 1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      go(index - 1);
    }
  }

  return (
    <section
      className="carousel"
      ref={sectionRef}
      tabIndex={-1}
      aria-roledescription="carousel"
      aria-label="Key findings"
      onKeyDown={onKeyDown}
    >
      <div className="carousel-track" ref={trackRef}>
        {SCIENCE_CARDS.map((card, i) => (
          <article
            key={card.id}
            className={`slide${seen.has(i) ? ' is-seen' : ''}${inView && i === index ? ' is-active' : ''}`}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${n}`}
            inert={i !== index}
          >
            <div className="slide-art">
              <div className="slide-viz">
                <CardViz viz={card.viz} refs={card.refs} note={card.note} alt={card.alt} />
              </div>
            </div>
            <div className="slide-body">
              <span className="slide-count" aria-hidden="true">
                {i + 1}/{n}
              </span>
              <span className="eyebrow">{card.kicker}</span>
              <h3 className="slide-fact">{card.fact}</h3>
              <p>{card.detail}</p>
            </div>
          </article>
        ))}
      </div>

      <div className="carousel-controls">
        <button className="icon-btn" onClick={() => go(index - 1)} disabled={index === 0} aria-label="Previous card">
          <Icon name="back" size={20} stroke={2.4} />
        </button>
        <div className="dots" aria-hidden="true">
          {SCIENCE_CARDS.map((c, i) => (
            <span key={c.id} className={`dot ${i === index ? 'on' : ''}`} />
          ))}
        </div>
        <button className="icon-btn" onClick={() => go(index + 1)} disabled={index === n - 1} aria-label="Next card">
          <span style={{ display: 'flex', transform: 'rotate(180deg)' }}>
            <Icon name="back" size={20} stroke={2.4} />
          </span>
        </button>
      </div>
      <p className="sr-only" aria-live="polite">
        Card {index + 1} of {n}: {SCIENCE_CARDS[index].fact}
      </p>
      {!moved && <p className="swipe-hint">Swipe or use the arrows to read the next fact</p>}
    </section>
  );
}
