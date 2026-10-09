import { useEffect, useState } from 'react';
import { apiGet } from './api';

type Health = { status: string };

type State =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ok'; health: Health };

export const App = () => {
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    apiGet<Health>('/health')
      .then((health) => {
        if (!cancelled) setState({ kind: 'ok', health });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            kind: 'error',
            message: error instanceof Error ? error.message : String(error),
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main>
      <h1>Data Tool Test</h1>
      {state.kind === 'loading' && <p>Loading...</p>}
      {state.kind === 'error' && <p role="alert">Error: {state.message}</p>}
      {state.kind === 'ok' && <p>Backend status: {state.health.status}</p>}
    </main>
  );
};
