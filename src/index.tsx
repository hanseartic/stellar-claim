import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import App from './App';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';
import reportWebVitals from './reportWebVitals';

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root')
);

const setCheckForUpdatesInterval = (reg: ServiceWorkerRegistration) => setInterval(() => reg.update(), Number(process.env.REACT_APP_POLL_VERSION??60000));

serviceWorkerRegistration.register({
    onUpdate: reg => {
        setCheckForUpdatesInterval(reg);
    },
    onSuccess: reg => {
        setCheckForUpdatesInterval(reg);
    }
});
// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
