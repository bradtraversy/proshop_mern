import { useAuth0 } from '@auth0/auth0-react';
import { Button, Col, Row } from 'react-bootstrap';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { listProducts } from '../actions/productActions';
import Loader from '../components/Loader';
import Message from '../components/Message';
import Meta from '../components/Meta';
import Paginate from '../components/Paginate';
import Product from '../components/Product';
import ProductCarousel from '../components/ProductCarousel';

import React from 'react';
import { useState, useEffect } from 'react';



const HomeScreen = ({ match }) => {

  const [selectedCategory, setSelectedCategory] = useState(''); //stores the currently selected category in the drop down list 
  const keyword = match.params.keyword;

  const pageNumber = match.params.pageNumber || 1;

  const dispatch = useDispatch();


  const productList = useSelector((state) => state.productList);
  const { loading, error, products, page, pages } = productList;
  const { user } = useAuth0();
  const userdata = user;

  useEffect(() => {
    dispatch(listProducts(keyword, pageNumber));
  }, [dispatch, keyword, pageNumber]);

  const addToCartHandler = () => {
    
  }

  if (loading) return <Loader />;

  if (error) return <Message variant="danger">{error}</Message>;

  const handleChange = (event) =>{
    setSelectedCategory(event.target.value) //helps for drop down selection. this updates the selectedCategory state with the new value selected from user
  }


  const categories = [...new Set(products.map((product) => product.category))]; {/* Sets up a dynamic play by gathering the products.category into an array. 
  then, converts it into a set to remove duplicate*/}

  return (
    <>
      <Meta />
      {!keyword ? (
        <ProductCarousel />
      ) : (
        <Link to="/" className="btn btn-light">
          Go Back
        </Link>
      )}
      
      <div style ={{display: 'flex', justifyContent: 'space-between'}}>
        <h1 style={{margin: '0'}}>Latest Products</h1>
        
        <div>
          <label>
            Category
          <select value={selectedCategory} onChange={handleChange}>

            {/* Dynmically iterate through the categ */}
            {categories.map((category) => ( 
              <option key={category} value={category}>
                {/* Iterates through the dynamic filtered set of products. Sets up the  options to be of those iterators*/}
                {category}
              </option>
            ))}
          </select>

          <form>
            <input type="number" placeholder="Lower Bound Price" /> {/* Gathers information and processes into sendable variables */}
            <input type="number" placeholder="Upper Bound Price" /> {/* Processes the input information into a variable that can be sent to API / backend function*/}
            <button type="submit">Apply Filter</button>             {/* Button for when user is ready to search*/}
          </form>
        </label>
        </div>
      </div>

      <>
        <Row>
          {products.map((product) => (
            <Col key={product._id} sm={12} md={6} lg={4} xl={3}>
              <Product product={product} /> 
            </Col>
          ))}
        </Row>
        <Paginate pages={pages} page={page} keyword={keyword ? keyword : ''} />
      </>
    </>
  );
};

export default HomeScreen;
