import React from 'react'

const Rating = ({ value, text, color }) => {
  const getStarClass = (val, index) => {
    if (val >= index) {
      return 'fas fa-star'
    } else if (val >= index - 0.5) {
      return 'fas fa-star-half-alt'
    } else {
      return 'far fa-star'
    }
  }

  return (
    <div className='rating'>
      <span>
        <i style={{ color }} className={getStarClass(value, 0.5)}></i>
      </span>
      <span>
        <i style={{ color }} className={getStarClass(value, 1)}></i>
      </span>
      <span>
        <i style={{ color }} className={getStarClass(value, 1.5)}></i>
      </span>
      <span>
        <i style={{ color }} className={getStarClass(value, 2)}></i>
      </span>
      <span>
        <i style={{ color }} className={getStarClass(value, 2.5)}></i>
      </span>
      <span>
        <i style={{ color }} className={getStarClass(value, 3)}></i>
      </span>
      <span>
        <i style={{ color }} className={getStarClass(value, 3.5)}></i>
      </span>
      <span>
        <i style={{ color }} className={getStarClass(value, 4)}></i>
      </span>
      <span>
        <i style={{ color }} className={getStarClass(value, 4.5)}></i>
      </span>
      <span>
        <i style={{ color }} className={getStarClass(value, 5)}></i>
      </span>
      <span>{text ? text : null}</span>
    </div>
  )
}

Rating.defaultProps = {
  color: '#f8e825',
}

export default Rating
