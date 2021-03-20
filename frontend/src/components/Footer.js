import React from "react";
import { Container, Row, Col } from "react-bootstrap";


const Footer = () => {
  return (
    <footer>
      <Container>
        <Row>
          <Col className="text-center py-3">
            Copyright &copy; Creative Duo Shop
          </Col>
          <Col className="text-center py-3">
            Copyright &copy;{" "}
            <a href="https://creativeduo.netlify.app">Creative Duo</a>
          </Col>
        </Row>
        <Row className="rowfoot">
          <Col className="text-center py-3">
            <p style={{ display: "inline" }}>External Links: </p>
            <a href="https://creativeduo.netlify.app/privacy.html">
              Privacy Policy{" "}
            </a>{" "}
            {" - "}{" "}
            <a href="https://creativeduo.netlify.app/terms_and_conditions.html">
              Terms & Conditions{" "}
            </a>
          </Col>
        </Row>
      </Container>
    </footer>
  );
};

export default Footer;
