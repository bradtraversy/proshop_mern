import React, { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { Row, Col, ListGroup, Image, Form, Button, Card } from 'react-bootstrap'
import Message from '../components/Message'
import { addToLater, removeFromLater } from '../actions/laterActions'
import { addToCart } from '../actions/cartActions'

const LaterScreen = ({ match, location, history }) => {
  const productId = match.params.id

  const qty = location.search ? Number(location.search.split('=')[1]) : 1

  const dispatch = useDispatch()

  const later = useSelector((state) => state.later)
  const { laterItems } = later

  useEffect(() => {
    if (productId) {
      dispatch(addToLater(productId, qty))
    }
  }, [dispatch, productId, qty])

  const removeFromLaterHandler = (id) => {
    dispatch(removeFromLater(id))
  }

  const addToCartHandler = (id, qty) => {
    // Adds the product to the cart and removes it from the saved for later list
    dispatch(addToCart(id, qty))
    dispatch(removeFromLater(id))
  }

  return (
    <Row>
      <Col md={8}>
        <h1>Items Saved For Later</h1>
        {laterItems.length === 0 ? (
          <Message>
            Your saved items for later is empty <Link to='/'>Go Back</Link>
          </Message>
        ) : (
          <ListGroup variant='flush'>
            {laterItems.map((item) => (
              <ListGroup.Item key={item.product}>
                <Row>
                  <Col md={2}>
                    <Image src={item.image} alt={item.name} fluid rounded />
                  </Col>
                  <Col md={3}>
                    <Link to={`/product/${item.product}`}>{item.name}</Link>
                  </Col>
                  <Col md={2}>${item.price}</Col>
                  <Col md={2}>
                    <Form.Control
                      as='select'
                      value={item.qty}
                      onChange={(e) =>
                        dispatch(
                          addToLater(item.product, Number(e.target.value))
                        )
                      }
                    >
                      {[...Array(item.countInStock).keys()].map((x) => (
                        <option key={x + 1} value={x + 1}>
                          {x + 1}
                        </option>
                      ))}
                    </Form.Control>
                  </Col>
                  <Col md={1}>
                    <Button
                      type='button'
                      variant='light'
                      onClick={() => removeFromLaterHandler(item.product)}
                      style={{ marginRight: '0rem' }}
                    >
                      <i className='fas fa-trash'></i>
                    </Button>
                  </Col>
                  <Col md={1}>
                    <Button
                      type='button'
                      variant='light'
                      onClick={() => addToCartHandler(item.product, item.qty)}
                      style={{ marginLeft: '0rem' }}
                    >
                      <p>Add to cart</p>
                    </Button>
                  </Col>
                </Row>
              </ListGroup.Item>
            ))}
          </ListGroup>
        )}
      </Col>
      <Col md={4}>
        <Card>
          <ListGroup variant='flush'>
            <ListGroup.Item>
              <h2>
                Subtotal ({laterItems.reduce((acc, item) => acc + item.qty, 0)})
                items
              </h2>
              $
              {laterItems
                .reduce((acc, item) => acc + item.qty * item.price, 0)
                .toFixed(2)}
            </ListGroup.Item>
          </ListGroup>
        </Card>
      </Col>
    </Row>
  )
}

export default LaterScreen
