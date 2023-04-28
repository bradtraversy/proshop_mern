import React from 'react'
import { Route } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { LinkContainer } from 'react-router-bootstrap'
import { Navbar, Nav, Container, NavDropdown } from 'react-bootstrap'
import SearchBox from './SearchBox'
import { logout } from '../actions/userActions'

const Auth0Logout = () => {
  const { logout } = useAuth0()
  const dispatch = useDispatch()

  return (
    <Button
      onClick={() => {
        logout({ logoutParams: { returnTo: window.location.origin } })
        dispatch(userLogoutAction())
      }}
    >
      Log Out
    </Button>
  )
}

const Header = () => {
  const userLogin = useSelector((state) => state.userLogin)
  const { userInfo } = userLogin

  return (
    <header>
      <Navbar bg='dark' variant='dark' expand='lg' collapseOnSelect>
        <Container>
          <LinkContainer to='/'>
            <Navbar.Brand>ProShop</Navbar.Brand>
          </LinkContainer>
          <Navbar.Toggle aria-controls='basic-navbar-nav' />
          <Navbar.Collapse id='basic-navbar-nav'>
            <Route render={({ history }) => <SearchBox history={history} />} />
            <Nav className='ml-auto'>
              <LinkContainer to='/cart'>
                <Nav.Link>
                  <i className='fas fa-shopping-cart'></i> Cart
                </Nav.Link>
              </LinkContainer>
              {/* Add the Contact Us page to the header */}
              <LinkContainer to='/contact-us'>
                <Nav.Link>
                  {/* Display an envelope icon next to the "Contact Us" link in the header */}
                  <i className='fa fa-envelope' aria-hidden='true'></i> Contact
                  Us
                </Nav.Link>
              </LinkContainer>
              {/* Add the Contact Us page to the header */}
              <LinkContainer to='/contact-us'>
                <Nav.Link>
                  {/* Display an envelope icon next to the "Contact Us" link in the header */}
                  <i className='fa fa-envelope' aria-hidden='true'></i> Contact
                  Us
                </Nav.Link>
              </LinkContainer>
              {userInfo ? (
                <NavDropdown title={userInfo.name} id='username'>
                  <LinkContainer to='/profile'>
                    <NavDropdown.Item>Profile</NavDropdown.Item>
                  </LinkContainer>
                  <LinkContainer to='/later'>
                    <NavDropdown.Item>Saved Items</NavDropdown.Item>
                  </LinkContainer>
                  <Auth0Logout />
                </NavDropdown>
              ) : (
                <Auth0Login />
              )}
              {userInfo && userInfo.isAdmin && (
                <NavDropdown title='Admin' id='adminmenu'>
                  <LinkContainer to='/admin/userlist'>
                    <NavDropdown.Item>Users</NavDropdown.Item>
                  </LinkContainer>
                  <LinkContainer to='/admin/productlist'>
                    <NavDropdown.Item>Products</NavDropdown.Item>
                  </LinkContainer>
                  <LinkContainer to='/admin/orderlist'>
                    <NavDropdown.Item>Orders</NavDropdown.Item>
                  </LinkContainer>
                </NavDropdown>
              )}
            </Nav>
          </Navbar.Collapse>
        </Container>
      </Navbar>
    </header>
  )
}

export default Header
