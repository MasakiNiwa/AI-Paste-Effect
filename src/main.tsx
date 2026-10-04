import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import Home from './pages/Home';
import './index.css';

const Settings = lazy(() => import('./pages/Settings'));
const Help = lazy(() => import('./pages/Help'));
const Result = lazy(() => import('./pages/Result'));
const Edit = lazy(() => import('./pages/Edit'));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* GitHub Pages ではサーバー側のルーティングが使えないため HashRouter */}
    <HashRouter>
      <Suspense fallback={null}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="result" element={<Result />} />
            <Route path="edit" element={<Edit />} />
            <Route path="settings" element={<Settings />} />
            <Route path="help" element={<Help />} />
            <Route path="*" element={<Home />} />
          </Route>
        </Routes>
      </Suspense>
    </HashRouter>
  </StrictMode>,
);
