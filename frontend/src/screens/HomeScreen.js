import { useAuth0 } from '@auth0/auth0-react'
import { Button, Col, Row } from 'react-bootstrap'
import { useDispatch, useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import { listProducts } from '../actions/productActions'
import Loader from '../components/Loader'
import Message from '../components/Message'
import Meta from '../components/Meta'
import Paginate from '../components/Paginate'
import Product from '../components/Product'
import ProductCarousel from '../components/ProductCarousel'

import React from 'react'
import { useState, useEffect } from 'react'

const HomeScreen = ({ match }) => {
  const [selectedCategory, setSelectedCategory] = useState('') //stores the currently selected category in the drop down list
  const [lowerPrice, setLowerPrice] = useState('')
  const [upperPrice, setUpperPrice] = useState('')

  const keyword = match.params.keyword
  const pageNumber = match.params.pageNumber || 1

  const dispatch = useDispatch()

  const productList = useSelector((state) => state.productList) //uses the useSelector to hook to access the products array from the Redux store (brad's umedy course, vid 29)
  const { loading, error, products, page, pages } = productList
  const { user } = useAuth0()
  const userdata = user

  useEffect(() => {
    dispatch(listProducts(keyword, pageNumber))
  }, [dispatch, keyword, pageNumber])

  const handleChange = (event) => {
    setSelectedCategory(event.target.value) //helps for drop down selection. this updates the selectedCategory state with the new value from user
  }

  const categories = [...new Set(products.map((product) => product.category))]
  {
    /* 
    Sets up a dynamic play by gathering the products.category into an array. then, it converts it into a set to remove
    the duplicate/s.
  */
  }

  const filteredProducts = products.filter((product) => {
    // trying to create a new array called filteredProducts

    const categoryMatch = // create a new variable called categoryMatch
      selectedCategory === '' || product.category === selectedCategory // set categoryMatch to true if selectedCategory is an empty string or if product.category matches selectedCategory
    const lowerMatch = // create a new variable called lowerMatch
      lowerPrice === '' || parseInt(product.price) >= parseInt(lowerPrice) // set lowerMatch to true if lowerPrice is an empty string or if product.price is greater than or equal to lowerPrice
    const upperMatch = // create a new variable called upperMatch
      upperPrice === '' || parseInt(product.price) <= parseInt(upperPrice) // set upperMatch to true if upperPrice is an empty string or if product.price is less than or equal to upperPrice
    return categoryMatch && lowerMatch && upperMatch // return true if all three conditions are true (i.e. the current product matches the selected category, lower price, and upper price)
  })

  return (
    <>
      <Meta />
      {!keyword ? (
        <ProductCarousel />
      ) : (
        <Link to='/' className='btn btn-light'>
          Go Back
        </Link>
      )}

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          paddingTop: '1rem',
        }}
      >
        <h1 style={{ margin: '0' }}>Latest Products</h1>

        <div style={{ display: 'flex' }}>
          {/* helps keep things organize and be able to be next each other */}
          <div style={{ marginRight: '1rem' }}>
            <label>
              Category
              <select
                value={selectedCategory}
                onChange={handleChange}
                style={{ marginLeft: '0.5rem' }}
              >
                <option value=''>All</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                    {/* iterates through every category fro the dynamic set and makes them options for drop down menu 
                      (trying to fix my git commits like the titles. i think the ! messed things up)
                    */}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div style={{ display: 'flex' }}>
            <div style={{ marginRight: '1rem' }}>
              <label>
                From $
                <input
                  type='number'
                  value={lowerPrice}
                  onChange={(e) => setLowerPrice(e.target.value)}
                  style={{ marginLeft: '0.5rem', width: '6rem' }} //helps stlying and sets stuff to the right
                />
              </label>
            </div>

            <div>
              <label>
                To $
                <input
                  type='number'
                  value={upperPrice}
                  onChange={(e) => setUpperPrice(e.target.value)}
                  style={{ marginLeft: '0.5rem', width: '6rem' }}
                />
              </label>
            </div>
          </div>
        </div>
      </div>

      <>
        <Row>
          {filteredProducts.map((product) => (
            <Col key={product._id} sm={12} md={6} lg={4} xl={3}>
              <Product product={product} />
            </Col>
          ))}
        </Row>
        <Paginate pages={pages} page={page} keyword={keyword ? keyword : ''} />
      </>
    </>
  )
}

export default HomeScreen
