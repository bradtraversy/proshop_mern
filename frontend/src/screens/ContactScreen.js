import React, { useState } from 'react';
import { sendEmail } from '../actions/contactActions';
import { useDispatch } from 'react-redux';

const ContactScreen = () => {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const dispatch = useDispatch()

  const submitHandler = async (e) => {
    e.preventDefault();
    if (!subject || !message) {
      setError('All fields are required');
    } else {
      try {
        console.log("In ContactScreen (submit handler)")
        console.log({subject, message})
        
        // dispatch sendEmail
        dispatch(sendEmail({subject,message})) // goes to contactActions
        setSuccessMessage('Email sent successfully');
        setSubject('');
        setMessage('');
      } catch (error) {
        console.log(error);
        setError('Something went wrong');
      }
    }
  };

  return (
    <>
        <h1>Contact Us</h1>
        <form onSubmit={submitHandler}>
            <div><label>
            Subject:
            <input
                type='text'
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
            />
            </label></div>
            <div><label>
                Message:
                <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                ></textarea>
            </label></div>
        {error && <div className='error'>{error}</div>}
        {successMessage && (
          <div className='success'>{successMessage}</div>
        )}
        <div><button type='submit'>Send</button></div>
      </form>
    </>
  );
};

export default ContactScreen;
