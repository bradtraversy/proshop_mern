import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import Rating from '../components/Rating';
import Message from '../components/Message';
import Loader from '../components/Loader';
import Meta from '../components/Meta';
import { listProductDetails, createProductReview } from '../actions/productActions';
import { PRODUCT_CREATE_REVIEW_RESET } from '../constants/productConstants';

const ProductScreen = ({ history, match }) => {
    const [qty, setQty] = useState(1);
    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState('');

    const dispatch = useDispatch();

    const productDetails = useSelector((state) => state.productDetails);
    const { loading, error, product } = productDetails;

    const userLogin = useSelector((state) => state.userLogin);
    const { userInfo } = userLogin;

    const productReviewCreate = useSelector((state) => state.productReviewCreate);
    const {
        success: successProductReview,
        loading: loadingProductReview,
        error: errorProductReview,
    } = productReviewCreate;

    useEffect(() => {
        if (successProductReview) {
            setRating(0);
            setComment('');
        }
        if (!product._id || product._id !== match.params.id) {
            dispatch(listProductDetails(match.params.id));
            dispatch({ type: PRODUCT_CREATE_REVIEW_RESET });
        }
        // eslint-disable-next-line
    }, [dispatch, match, successProductReview]);

    const addToCartHandler = () => {
        history.push(`/cart/${match.params.id}?qty=${qty}`);
    };

    const submitHandler = (e) => {
        e.preventDefault();
        dispatch(createProductReview(match.params.id, { rating, comment }));
    };

    return (
        <>
            <Link to="/">
                <Button variant="outline" className="mb-6">Go Back</Button>
            </Link>
            {loading ? (
                <Loader />
            ) : error ? (
                <Message variant="danger">{error}</Message>
            ) : (
                <>
                    <Meta title={product.name} />
                    <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                        {/* Image */}
                        <div className="overflow-hidden rounded-lg">
                            <img
                                src={product.image}
                                alt={product.name}
                                className="h-full w-full object-cover"
                            />
                        </div>

                        {/* Details */}
                        <div className="space-y-4">
                            <h1 className="text-2xl font-bold">{product.name}</h1>
                            <Rating value={product.rating} text={`${product.numReviews} reviews`} />
                            <Separator />
                            <p className="text-2xl font-bold">${product.price}</p>
                            <Separator />
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                {product.description}
                            </p>
                        </div>

                        {/* Add to cart */}
                        <Card>
                            <CardContent className="space-y-4 p-6">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-muted-foreground">Price:</span>
                                    <span className="font-bold">${product.price}</span>
                                </div>
                                <Separator />
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-muted-foreground">Status:</span>
                                    <span className={product.countInStock > 0 ? 'text-success font-medium' : 'text-destructive font-medium'}>
                                        {product.countInStock > 0 ? 'In Stock' : 'Out Of Stock'}
                                    </span>
                                </div>
                                <Separator />
                                {product.countInStock > 0 && (
                                    <>
                                        <div className="flex items-center justify-between">
                                            <Label htmlFor="qty">Qty</Label>
                                            <Select
                                                id="qty"
                                                value={qty}
                                                onChange={(e) => setQty(e.target.value)}
                                                className="w-20"
                                            >
                                                {[...Array(product.countInStock).keys()].map((x) => (
                                                    <option key={x + 1} value={x + 1}>
                                                        {x + 1}
                                                    </option>
                                                ))}
                                            </Select>
                                        </div>
                                        <Separator />
                                    </>
                                )}
                                <Button
                                    onClick={addToCartHandler}
                                    className="w-full"
                                    disabled={product.countInStock === 0}
                                >
                                    Add To Cart
                                </Button>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Reviews */}
                    <div className="mt-12 max-w-2xl">
                        <h2 className="mb-4">Reviews</h2>
                        {product.reviews.length === 0 && <Message>No Reviews</Message>}
                        <div className="space-y-4">
                            {product.reviews.map((review) => (
                                <div key={review._id} className="rounded-lg border border-border p-4">
                                    <div className="flex items-center justify-between">
                                        <strong className="text-sm">{review.name}</strong>
                                        <span className="text-xs text-muted-foreground">
                                            {review.createdAt.substring(0, 10)}
                                        </span>
                                    </div>
                                    <Rating value={review.rating} />
                                    <p className="mt-2 text-sm">{review.comment}</p>
                                </div>
                            ))}
                        </div>

                        <div className="mt-8">
                            <h2 className="mb-4">Write a Customer Review</h2>
                            {successProductReview && (
                                <Message variant="success">Review submitted successfully</Message>
                            )}
                            {loadingProductReview && <Loader />}
                            {errorProductReview && (
                                <Message variant="danger">{errorProductReview}</Message>
                            )}
                            {userInfo ? (
                                <form onSubmit={submitHandler} className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="rating">Rating</Label>
                                        <Select
                                            id="rating"
                                            value={rating}
                                            onChange={(e) => setRating(e.target.value)}
                                        >
                                            <option value="">Select...</option>
                                            <option value="1">1 - Poor</option>
                                            <option value="2">2 - Fair</option>
                                            <option value="3">3 - Good</option>
                                            <option value="4">4 - Very Good</option>
                                            <option value="5">5 - Excellent</option>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="comment">Comment</Label>
                                        <textarea
                                            id="comment"
                                            rows="3"
                                            value={comment}
                                            onChange={(e) => setComment(e.target.value)}
                                            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                        />
                                    </div>
                                    <Button type="submit" disabled={loadingProductReview}>
                                        Submit
                                    </Button>
                                </form>
                            ) : (
                                <Message>
                                    Please <Link to="/login" className="underline">sign in</Link> to write a review
                                </Message>
                            )}
                        </div>
                    </div>
                </>
            )}
        </>
    );
};

export default ProductScreen;
