import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { SCIENCE_CARDS, type SceneId } from '../data/scienceCards';
import { RefList } from './common';
import { Icon } from './Icon';

// Illustrations are bundled SVG files coloured with the app's CSS variables, so
// they follow light and dark mode. They are our own static assets, not user input.
const SCENES = import.meta.glob('../assets/scenes/*.svg', { query: '?raw', import: 'default', eager: true }) as Record<
  string,
  string
>;
const sceneSvg = (id: SceneId) => SCENES[`../assets/scenes/${id}.svg`] ?? '';

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/** The key findings as a swipeable deck of cards, one fact per card. */
export function ScienceCarousel() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [moved, setMoved] = useState(false);
  const n = SCIENCE_CARDS.length;

  // Follow the scroll position (swipes, trackpads, buttons) to know which card is showing.
  const onScroll = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const slides = Array.from(track.children) as HTMLElement[];
    const left = track.scrollLeft;
    let best = 0;
    slides.forEach((s, i) => {
      if (Math.abs(s.offsetLeft - left) < Math.abs(slides[best].offsetLeft - left)) best = i;
    });
    setIndex(best);
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
    track.addEventListener('scroll', handler, { passive: true });
    return () => {
      track.removeEventListener('scroll', handler);
      cancelAnimationFrame(frame);
    };
  }, [onScroll]);

  function go(i: number) {
    const track = trackRef.current;
    const target = Math.max(0, Math.min(n - 1, i));
    const slide = track?.children[target] as HTMLElement | undefined;
    if (!track || !slide) return;
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
    <section className="carousel" aria-roledescription="carousel" aria-label="Key findings" onKeyDown={onKeyDown}>
      <div className="carousel-track" ref={trackRef}>
        {SCIENCE_CARDS.map((card, i) => (
          <article
            key={card.id}
            className="slide"
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${n}`}
            inert={i !== index}
          >
            <div className="slide-art">
              <div className="slide-svg" aria-hidden="true" dangerouslySetInnerHTML={{ __html: sceneSvg(card.scene) }} />
              <span className="slide-count" aria-hidden="true">
                {i + 1}/{n}
              </span>
            </div>
            <div className="slide-body">
              <span className="eyebrow">{card.kicker}</span>
              <h3 className="slide-fact">{card.fact}</h3>
              <p>{card.detail}</p>
              <RefList ids={card.refs} />
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
