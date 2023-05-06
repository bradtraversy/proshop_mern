import React from 'react';

const Rating = ({ value, text, color }) => {
  const getStarClass = (val, index) => {
    if (val >= index) {
      return 'fas fa-star';
    } else if (val >= index - 0.5) {
      return 'fas fa-star-half-alt';
    } else {
      return 'far fa-star';
    }
  };

  return (
    <div className='rating'>
      {[...Array(5)].map((_, i) => (
        <span key={i}>
          <i style={{ color }} className={getStarClass(value, i + 1)}></i>
        </span>
      ))}
      <span>{text && text}</span>
    </div>
  );
};

Rating.defaultProps = {
  color: '#f8e825',
};

export default Rating;
