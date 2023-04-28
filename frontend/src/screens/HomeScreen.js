import { useAuth0 } from '@auth0/auth0-react';
import React, { useEffect } from 'react';
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

const HomeScreen = ({ match }) => {
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
    selectedOption(event.target.value)
  }

  const categories = [...new Set(products.map((product) => product.category))];

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
          <select>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>
        </div>

        {/* <Button  className='btn-block' type='button'> category </Button> } */}


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
