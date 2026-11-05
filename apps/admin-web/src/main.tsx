import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ToastProvider } from './components/toast';
import { AuthProvider } from './lib/auth';
import { applyThemeMode, getThemeMode } from './lib/themeMode';
import './index.css';

applyThemeMode(getThemeMode()); // sebelum render agar tidak berkedip

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
