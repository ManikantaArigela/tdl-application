import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { registerNotificationWorker } from './lib/notifications';
import './index.css';

registerNotificationWorker();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
