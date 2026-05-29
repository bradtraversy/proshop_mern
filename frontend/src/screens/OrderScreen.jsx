import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { PayPalButton } from 'react-paypal-button-v2';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import Message from '../components/Message';
import Loader from '../components/Loader';
import { getOrderDetails, payOrder, deliverOrder } from '../actions/orderActions';
import { ORDER_PAY_RESET, ORDER_DELIVER_RESET } from '../constants/orderConstants';

const OrderScreen = ({ match, history }) => {
    const orderId = match.params.id;
    const [sdkReady, setSdkReady] = useState(false);

    const dispatch = useDispatch();

    const orderDetails = useSelector((state) => state.orderDetails);
    const { order, loading, error } = orderDetails;

    const orderPay = useSelector((state) => state.orderPay);
    const { loading: loadingPay, success: successPay } = orderPay;

    const orderDeliver = useSelector((state) => state.orderDeliver);
    const { loading: loadingDeliver, success: successDeliver } = orderDeliver;

    const userLogin = useSelector((state) => state.userLogin);
    const { userInfo } = userLogin;

    if (!loading && order) {
        const addDecimals = (num) => (Math.round(num * 100) / 100).toFixed(2);
        order.itemsPrice = addDecimals(order.orderItems.reduce((acc, item) => acc + item.price * item.qty, 0));
    }

    useEffect(() => {
        if (!userInfo) {
            history.push('/login');
        }

        const addPayPalScript = async () => {
            const { data: clientId } = await axios.get('/api/config/paypal');
            const script = document.createElement('script');
            script.type = 'text/javascript';
            script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}`;
            script.async = true;
            script.onload = () => setSdkReady(true);
            document.body.appendChild(script);
        };

        if (!order || successPay || successDeliver || order._id !== orderId) {
            dispatch({ type: ORDER_PAY_RESET });
            dispatch({ type: ORDER_DELIVER_RESET });
            dispatch(getOrderDetails(orderId));
        } else if (!order.isPaid) {
            if (!window.paypal) {
                addPayPalScript();
            } else {
                setSdkReady(true);
            }
        }
        // eslint-disable-next-line
    }, [dispatch, orderId, successPay, successDeliver, order]);

    const successPaymentHandler = (paymentResult) => {
        dispatch(payOrder(orderId, paymentResult));
    };

    const deliverHandler = () => {
        dispatch(deliverOrder(order));
    };

    return loading ? (
        <Loader />
    ) : error ? (
        <Message variant="danger">{error}</Message>
    ) : (
        <>
            <h1 className="mb-6 text-xl">
                Order <span className="font-mono text-muted-foreground">{order._id}</span>
            </h1>
            <div className="grid gap-8 lg:grid-cols-3">
                <div className="lg:col-span-2 space-y-6">
                    <div>
                        <h2 className="mb-2">Shipping</h2>
                        <p className="text-sm"><strong>Name:</strong> {order.user.name}</p>
                        <p className="text-sm"><strong>Email:</strong> <a href={`mailto:${order.user.email}`} className="underline">{order.user.email}</a></p>
                        <p className="text-sm text-muted-foreground mt-1">
                            {order.shippingAddress.address}, {order.shippingAddress.city}{' '}
                            {order.shippingAddress.postalCode}, {order.shippingAddress.country}
                        </p>
                        <div className="mt-2">
                            {order.isDelivered ? (
                                <Message variant="success">Delivered on {order.deliveredAt}</Message>
                            ) : (
                                <Message variant="danger">Not Delivered</Message>
                            )}
                        </div>
                    </div>
                    <Separator />
                    <div>
                        <h2 className="mb-2">Payment Method</h2>
                        <p className="text-sm text-muted-foreground">{order.paymentMethod}</p>
                        <div className="mt-2">
                            {order.isPaid ? (
                                <Message variant="success">Paid on {order.paidAt}</Message>
                            ) : (
                                <Message variant="danger">Not Paid</Message>
                            )}
                        </div>
                    </div>
                    <Separator />
                    <div>
                        <h2 className="mb-4">Order Items</h2>
                        {order.orderItems.length === 0 ? (
                            <Message>Order is empty</Message>
                        ) : (
                            <div className="space-y-3">
                                {order.orderItems.map((item, index) => (
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
                            <span>${order.itemsPrice}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Shipping</span>
                            <span>${order.shippingPrice}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Tax</span>
                            <span>${order.taxPrice}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between font-bold">
                            <span>Total</span>
                            <span>${order.totalPrice}</span>
                        </div>
                        {!order.isPaid && (
                            <div className="pt-2">
                                {loadingPay && <Loader />}
                                {!sdkReady ? <Loader /> : (
                                    <PayPalButton amount={order.totalPrice} onSuccess={successPaymentHandler} />
                                )}
                            </div>
                        )}
                        {loadingDeliver && <Loader />}
                        {userInfo && userInfo.isAdmin && order.isPaid && !order.isDelivered && (
                            <Button className="w-full" onClick={deliverHandler}>
                                Mark As Delivered
                            </Button>
                        )}
                    </CardContent>
                </Card>
            </div>
        </>
    );
};

export default OrderScreen;
