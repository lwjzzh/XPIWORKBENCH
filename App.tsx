
import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import AppManager from './pages/AppManager';
import SettingsPage from './pages/Settings';
import BuilderPage from './pages/Builder';
import RunnerPage from './pages/Runner';
import { Toaster } from './components/ui/Toast';

const App: React.FC = () => {
  return (
    <>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="apps" element={<AppManager />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
          
          {/* Full screen routes without sidebar */}
          <Route path="/builder/:id" element={<BuilderPage />} />
          <Route path="/run/:id" element={<RunnerPage />} />
          
          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
      <Toaster />
    </>
  );
};

export default App;
