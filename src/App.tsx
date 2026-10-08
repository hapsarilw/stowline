import { useState } from 'react';
import { RouterProvider } from 'react-router/dom';
import { createRouter } from './app/router';
import { RequestErrorHost } from './app/RequestErrorHost';
import { ThemeSync } from './app/ThemeSync';

export function App() {
  const [router] = useState(createRouter);
  return (
    <>
      <ThemeSync />
      <RouterProvider router={router} />
      <RequestErrorHost />
    </>
  );
}
