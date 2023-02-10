import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';
import reportWebVitals from './reportWebVitals';

const root = createRoot(document.getElementById('root')!);
root.render(
<React.StrictMode>
    <App />
  </React.StrictMode>
);

serviceWorkerRegistration.register({
    onUpdate: () => console.log("service-worker was updated"),
    onSuccess: () => console.log("service-worker was installed"),
});
// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
