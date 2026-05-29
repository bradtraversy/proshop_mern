import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Button } from '@/components/ui/button';
import Product from '../components/Product';
import Message from '../components/Message';
import Loader from '../components/Loader';
import Paginate from '../components/Paginate';
import ProductCarousel from '../components/ProductCarousel';
import Meta from '../components/Meta';
import { listProducts } from '../actions/productActions';

const HomeScreen = ({ match }) => {
    const keyword = match.params.keyword;
    const pageNumber = match.params.pageNumber || 1;

    const dispatch = useDispatch();
    const productList = useSelector((state) => state.productList);
    const { loading, error, products, page, pages } = productList;

    useEffect(() => {
        dispatch(listProducts(keyword, pageNumber));
    }, [dispatch, keyword, pageNumber]);

    return (
        <>
            <Meta />
            {!keyword ? (
                <ProductCarousel />
            ) : (
                <Link to="/">
                    <Button variant="outline" className="mb-4">
                        Go Back
                    </Button>
                </Link>
            )}
            <h1 className="mb-6">Latest Products</h1>
            {loading ? (
                <Loader />
            ) : error ? (
                <Message variant="danger">{error}</Message>
            ) : (
                <>
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {products.map((product) => (
                            <Product key={product._id} product={product} />
                        ))}
                    </div>
                    <Paginate pages={pages} page={page} keyword={keyword ? keyword : ''} />
                </>
            )}
        </>
    );
};

export default HomeScreen;
