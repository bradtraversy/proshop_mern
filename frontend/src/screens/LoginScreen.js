import { useAuth0 } from '@auth0/auth0-react';
import React, { useEffect, useState } from 'react';
import { Button, Col, Form, Row } from 'react-bootstrap';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { login } from '../actions/userActions';
import FormContainer from '../components/FormContainer';
import Loader from '../components/Loader';
import Message from '../components/Message';

const LoginScreen = ({ location, history }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const dispatch = useDispatch();

  const userLogin = useSelector((state) => state.userLogin);
  const { loading, error, userInfo } = userLogin;

  const { loginWithRedirect } = useAuth0();

  const redirect = location.search ? location.search.split('=')[1] : '/';
  if (!redirect) {
    loginWithRedirect({
      authorizationParams: {
        redirect_uri: window.location.origin + '/callback',
      },
    });
  }
  useEffect(() => {
    if (userInfo) {
      history.push(redirect);
    } else {
      loginWithRedirect({
        authorizationParams: {
          redirect_uri: window.location.origin + '/callback',
        },
      });
    }
  }, [history, userInfo, redirect]);

  return <>Redirecting to auth0...</>;
};

export default LoginScreen;
