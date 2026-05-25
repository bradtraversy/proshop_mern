import React from 'react';

const FormContainer = ({ children }) => {
    return (
        <div className="mx-auto max-w-md">
            {children}
        </div>
    );
};

export default FormContainer;
