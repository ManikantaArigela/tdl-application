import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { registerNotificationWorker } from './lib/notifications';
import { applyTheme, loadSettings } from './lib/settings';
import './index.css';

// Apply the saved theme before the first paint so there is no light flash.
applyTheme(loadSettings().theme);
registerNotificationWorker();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
