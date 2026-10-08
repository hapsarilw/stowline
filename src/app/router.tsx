import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';

export const routes: RouteObject[] = [
  { path: '/', element: <Navigate to="/plans" replace /> },
  {
    path: '/plans',
    lazy: async () => ({ Component: (await import('@/features/plans/PlansPage')).PlansPage }),
  },
  {
    path: '/plans/:planId',
    lazy: async () => ({ Component: (await import('./PlanRoute')).PlanRoute }),
  },
  {
    path: '/bench',
    lazy: async () => ({ Component: (await import('@/features/bench/BenchPage')).BenchPage }),
  },
  { path: '*', element: <Navigate to="/" replace /> },
];

export const createRouter = () => createBrowserRouter(routes);
