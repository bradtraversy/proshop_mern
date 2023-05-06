import React, { useState } from 'react';
import { sendEmail } from '../actions/contactActions';
import { useDispatch } from 'react-redux';

const ContactScreen = () => {
  // Define states using the useState hook
  const [subject, setSubject] = useState(''); // subject of email 
  const [message, setMessage] = useState(''); // message of email
  const [error, setError] = useState(''); ; // error message if there is an issue sending the email
  const [successMessage, setSuccessMessage] = useState(''); // success message when email is sent

  // Dispatcher to dispatch actions to the Redux store
  const dispatch = useDispatch()

  const submitHandler = async (e) => {
    // Called the user clicks the "Send" button on the website
    // Prevents default form submission behavior
    e.preventDefault();
    if (!subject || !message) {
      // If the subejct or message are blank set the error
      setError('All fields are required');
    } else {
      // Subject and message are valid (aka. not blank)
      try {
        // dispatch sendEmail action
        dispatch(sendEmail({subject,message})) // goes to contactActions
        // Set the success message
        setSuccessMessage('Email sent successfully');
        // Clear the subject and message fields on the form after the email is sent successfully
        setSubject('');
        setMessage('');
      } catch (error) {
        // If there is an error, log it to console
        console.log(error);
        // Set the error message
        setError('Something went wrong');
      }
    }
  };

  // HTML code to display the form on the Contact Us page of the website
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
