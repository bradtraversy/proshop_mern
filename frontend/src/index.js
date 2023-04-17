import { Auth0Provider } from '@auth0/auth0-react';
import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import App from './App';
import './bootstrap.min.css';
import './index.css';
import * as serviceWorker from './serviceWorker';
import store from './store';

ReactDOM.render(
  <Auth0Provider
    domain="dev-e94z7zhn.us.auth0.com"
    clientId="oQh0EGNaqYHJEQsyq7NCKAvdRncRCt2T"
    authorizationParams={{
      redirect_uri: window.location.origin,
    }}
  >
    <Provider store={store}>
      <App />
    </Provider>
  </Auth0Provider>,
  document.getElementById('root')
);

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.unregister();
