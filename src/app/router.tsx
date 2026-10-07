import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';
import { WorkspacePage } from '@/features/workspace/WorkspacePage';

/** The one seeded plan. The plans list and the API come in M6. */
export const DEFAULT_PLAN_ID = '042W-SGSIN';

export const routes: RouteObject[] = [
  { path: '/', element: <Navigate to={`/plans/${DEFAULT_PLAN_ID}`} replace /> },
  { path: '/plans/:planId', element: <WorkspacePage /> },
  {
    path: '/bench',
    lazy: async () => ({ Component: (await import('@/features/bench/BenchPage')).BenchPage }),
  },
  { path: '*', element: <Navigate to="/" replace /> },
];

export const createRouter = () => createBrowserRouter(routes);
