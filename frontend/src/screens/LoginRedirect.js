import { useAuth0 } from '@auth0/auth0-react';
import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Redirect } from 'react-router-dom';
import { loginWithAuth0 } from '../actions/userActions';

const LoginRedirect = () => {
  const { user, isLoading } = useAuth0();

  const dispatch = useDispatch();
  if (user && !isLoading) {
    dispatch(loginWithAuth0(user));
  }

  return <div>{isLoading ? <div>Loading...</div> : <Redirect to="/" />}</div>;
};

export default LoginRedirect;
