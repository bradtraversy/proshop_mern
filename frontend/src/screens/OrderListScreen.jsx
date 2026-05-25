import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import Message from '../components/Message';
import Loader from '../components/Loader';
import { listOrders } from '../actions/orderActions';

const OrderListScreen = ({ history }) => {
    const dispatch = useDispatch();

    const orderList = useSelector((state) => state.orderList);
    const { loading, error, orders } = orderList;

    const userLogin = useSelector((state) => state.userLogin);
    const { userInfo } = userLogin;

    useEffect(() => {
        if (userInfo && userInfo.isAdmin) {
            dispatch(listOrders());
        } else {
            history.push('/login');
        }
    }, [dispatch, history, userInfo]);

    return (
        <>
            <h1 className="mb-6">Orders</h1>
            {loading ? (
                <Loader />
            ) : error ? (
                <Message variant="danger">{error}</Message>
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>ID</TableHead>
                            <TableHead>USER</TableHead>
                            <TableHead>DATE</TableHead>
                            <TableHead>TOTAL</TableHead>
                            <TableHead>PAID</TableHead>
                            <TableHead>DELIVERED</TableHead>
                            <TableHead></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {orders.map((order) => (
                            <TableRow key={order._id}>
                                <TableCell className="font-mono text-xs">{order._id}</TableCell>
                                <TableCell>{order.user && order.user.name}</TableCell>
                                <TableCell>{order.createdAt.substring(0, 10)}</TableCell>
                                <TableCell>${order.totalPrice}</TableCell>
                                <TableCell>
                                    {order.isPaid ? (
                                        <Badge variant="success">{order.paidAt.substring(0, 10)}</Badge>
                                    ) : (
                                        <X className="h-4 w-4 text-destructive" />
                                    )}
                                </TableCell>
                                <TableCell>
                                    {order.isDelivered ? (
                                        <Badge variant="success">{order.deliveredAt.substring(0, 10)}</Badge>
                                    ) : (
                                        <X className="h-4 w-4 text-destructive" />
                                    )}
                                </TableCell>
                                <TableCell>
                                    <Link to={`/order/${order._id}`}>
                                        <Button variant="outline" size="sm">Details</Button>
                                    </Link>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}
        </>
    );
};

export default OrderListScreen;
