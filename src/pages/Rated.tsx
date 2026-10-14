import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { navigate } from '../router';
import { decodeReply } from '../lib/observer';
import { useAddRating } from '../components/FriendRatings';
import { formatDate } from '../lib/dates';

/** Opening a friend's reply link: add it here, or explain how to add it in the installed app. */
export function Rated({ query }: { query: string }) {
  const { state } = useStore();
  const addRating = useAddRating();
  const code = new URLSearchParams(query).get('d') ?? '';
  const reply = useMemo(() => {
    try {
      return decodeReply(code);
    } catch (e) {
      return e as Error;
    }
  }, [code]);
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const hasGoals = state.goals.length > 0;

  if (reply instanceof Error) {
    return (
      <div>
        <h1>A rating for you</h1>
        <p>{reply.message}</p>
      </div>
    );
  }

  function add() {
    try {
      addRating(code);
      navigate('progress');
    } catch (e) {
      setMessage((e as Error).message);
    }
  }

  return (
    <div>
      <h1>A rating for you</h1>
      <p>
        Your {reply.relation.toLowerCase()} rated you on {formatDate(reply.date)}.
      </p>
      {hasGoals ? (
        <div className="page-actions">
          <button className="primary" onClick={add}>
            Add to my progress
          </button>
        </div>
      ) : (
        <>
          <p className="muted">
            Your Trait Trainer data isn't in this browser. If you use the installed app, copy this link, open the app, and
            paste it under Progress → How others see you.
          </p>
          <div className="page-actions">
            <button
              className="primary"
              onClick={() =>
                navigator.clipboard.writeText(location.href).then(
                  () => setCopied(true),
                  () => setCopied(false),
                )
              }
            >
              Copy link
            </button>
          </div>
          {copied && <p role="status">Copied.</p>}
        </>
      )}
      {message && <p role="status">{message}</p>}
    </div>
  );
}
