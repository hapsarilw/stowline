import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/index.css';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

/** Version 1 has no server: Mock Service Worker answers the API in the browser (SRS). */
async function start(): Promise<void> {
  try {
    const { startMockApi } = await import('./api/mock/browser');
    await startMockApi();
  } catch (e) {
    // The app still opens; its requests will fail with a message and Retry (NFR-18).
    console.error('The mock API could not start', e);
  }
  createRoot(root!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void start();
