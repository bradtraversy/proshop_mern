import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import Message from '../components/Message';
import { addToCart, removeFromCart } from '../actions/cartActions';

const CartScreen = ({ match, location, history }) => {
    const productId = match.params.id;
    const qty = location.search ? Number(location.search.split('=')[1]) : 1;

    const dispatch = useDispatch();
    const cart = useSelector((state) => state.cart);
    const { cartItems } = cart;

    useEffect(() => {
        if (productId) {
            dispatch(addToCart(productId, qty));
        }
    }, [dispatch, productId, qty]);

    const removeFromCartHandler = (id) => {
        dispatch(removeFromCart(id));
    };

    const checkoutHandler = () => {
        history.push('/login?redirect=shipping');
    };

    return (
        <div className="grid gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2">
                <h1 className="mb-6">Shopping Cart</h1>
                {cartItems.length === 0 ? (
                    <Message>
                        Your cart is empty. <Link to="/" className="underline">Go Back</Link>
                    </Message>
                ) : (
                    <div className="space-y-4">
                        {cartItems.map((item) => (
                            <div key={item.product} className="flex items-center gap-4 rounded-lg border border-border p-4">
                                <img
                                    src={item.image}
                                    alt={item.name}
                                    className="h-16 w-16 rounded-md object-cover"
                                />
                                <div className="flex-1">
                                    <Link to={`/product/${item.product}`} className="text-sm font-medium hover:underline">
                                        {item.name}
                                    </Link>
                                    <p className="text-sm font-bold mt-1">${item.price}</p>
                                </div>
                                <Select
                                    value={item.qty}
                                    onChange={(e) => dispatch(addToCart(item.product, Number(e.target.value)))}
                                    className="w-16"
                                >
                                    {[...Array(item.countInStock).keys()].map((x) => (
                                        <option key={x + 1} value={x + 1}>{x + 1}</option>
                                    ))}
                                </Select>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removeFromCartHandler(item.product)}
                                >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div>
                <Card>
                    <CardHeader>
                        <CardTitle>
                            Subtotal ({cartItems.reduce((acc, item) => acc + item.qty, 0)}) items
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-2xl font-bold">
                            ${cartItems.reduce((acc, item) => acc + item.qty * item.price, 0).toFixed(2)}
                        </p>
                        <Separator />
                        <Button
                            className="w-full"
                            disabled={cartItems.length === 0}
                            onClick={checkoutHandler}
                        >
                            Proceed To Checkout
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default CartScreen;
