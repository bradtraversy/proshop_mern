import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import Message from '../components/Message';
import CheckoutSteps from '../components/CheckoutSteps';
import { createOrder } from '../actions/orderActions';
import { ORDER_CREATE_RESET } from '../constants/orderConstants';
import { USER_DETAILS_RESET } from '../constants/userConstants';

const PlaceOrderScreen = ({ history }) => {
    const dispatch = useDispatch();
    const cart = useSelector((state) => state.cart);

    if (!cart.shippingAddress.address) {
        history.push('/shipping');
    } else if (!cart.paymentMethod) {
        history.push('/payment');
    }

    const addDecimals = (num) => (Math.round(num * 100) / 100).toFixed(2);

    cart.itemsPrice = addDecimals(cart.cartItems.reduce((acc, item) => acc + item.price * item.qty, 0));
    cart.shippingPrice = addDecimals(cart.itemsPrice > 100 ? 0 : 100);
    cart.taxPrice = addDecimals(Number((0.15 * cart.itemsPrice).toFixed(2)));
    cart.totalPrice = (Number(cart.itemsPrice) + Number(cart.shippingPrice) + Number(cart.taxPrice)).toFixed(2);

    const orderCreate = useSelector((state) => state.orderCreate);
    const { order, success, error } = orderCreate;

    useEffect(() => {
        if (success) {
            history.push(`/order/${order._id}`);
            dispatch({ type: USER_DETAILS_RESET });
            dispatch({ type: ORDER_CREATE_RESET });
        }
        // eslint-disable-next-line
    }, [history, success]);

    const placeOrderHandler = () => {
        dispatch(createOrder({
            orderItems: cart.cartItems,
            shippingAddress: cart.shippingAddress,
            paymentMethod: cart.paymentMethod,
            itemsPrice: cart.itemsPrice,
            shippingPrice: cart.shippingPrice,
            taxPrice: cart.taxPrice,
            totalPrice: cart.totalPrice,
        }));
    };

    return (
        <>
            <CheckoutSteps step1 step2 step3 step4 />
            <div className="grid gap-8 lg:grid-cols-3">
                <div className="lg:col-span-2 space-y-6">
                    <div>
                        <h2 className="mb-2">Shipping</h2>
                        <p className="text-sm text-muted-foreground">
                            {cart.shippingAddress.address}, {cart.shippingAddress.city}{' '}
                            {cart.shippingAddress.postalCode}, {cart.shippingAddress.country}
                        </p>
                    </div>
                    <Separator />
                    <div>
                        <h2 className="mb-2">Payment Method</h2>
                        <p className="text-sm text-muted-foreground">{cart.paymentMethod}</p>
                    </div>
                    <Separator />
                    <div>
                        <h2 className="mb-4">Order Items</h2>
                        {cart.cartItems.length === 0 ? (
                            <Message>Your cart is empty</Message>
                        ) : (
                            <div className="space-y-3">
                                {cart.cartItems.map((item, index) => (
                                    <div key={index} className="flex items-center gap-4">
                                        <img src={item.image} alt={item.name} className="h-12 w-12 rounded object-cover" />
                                        <Link to={`/product/${item.product}`} className="flex-1 text-sm hover:underline">
                                            {item.name}
                                        </Link>
                                        <span className="text-sm text-muted-foreground">
                                            {item.qty} x ${item.price} = ${(item.qty * item.price).toFixed(2)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Order Summary</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Items</span>
                            <span>${cart.itemsPrice}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Shipping</span>
                            <span>${cart.shippingPrice}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Tax</span>
                            <span>${cart.taxPrice}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between font-bold">
                            <span>Total</span>
                            <span>${cart.totalPrice}</span>
                        </div>
                        {error && <Message variant="danger">{error}</Message>}
                        <Button
                            className="w-full"
                            disabled={cart.cartItems.length === 0}
                            onClick={placeOrderHandler}
                        >
                            Place Order
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </>
    );
};

export default PlaceOrderScreen;
