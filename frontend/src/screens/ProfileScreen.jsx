import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { X, Check } from 'lucide-react';
import Message from '../components/Message';
import Loader from '../components/Loader';
import { getUserDetails, updateUserProfile } from '../actions/userActions';
import { listMyOrders } from '../actions/orderActions';
import { USER_UPDATE_PROFILE_RESET } from '../constants/userConstants';

const ProfileScreen = ({ location, history }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [message, setMessage] = useState(null);

    const dispatch = useDispatch();

    const userDetails = useSelector((state) => state.userDetails);
    const { loading, error, user } = userDetails;

    const userLogin = useSelector((state) => state.userLogin);
    const { userInfo } = userLogin;

    const userUpdateProfile = useSelector((state) => state.userUpdateProfile);
    const { success } = userUpdateProfile;

    const orderListMy = useSelector((state) => state.orderListMy);
    const { loading: loadingOrders, error: errorOrders, orders } = orderListMy;

    useEffect(() => {
        if (!userInfo) {
            history.push('/login');
        } else {
            if (!user || !user.name || success) {
                dispatch({ type: USER_UPDATE_PROFILE_RESET });
                dispatch(getUserDetails('profile'));
                dispatch(listMyOrders());
            } else {
                setName(user.name);
                setEmail(user.email);
            }
        }
    }, [dispatch, history, userInfo, user, success]);

    const submitHandler = (e) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            setMessage('Passwords do not match');
        } else {
            dispatch(updateUserProfile({ id: user._id, name, email, password }));
        }
    };

    return (
        <div className="grid gap-8 lg:grid-cols-4">
            <div>
                <h2 className="mb-4">User Profile</h2>
                {message && <Message variant="danger">{message}</Message>}
                {success && <Message variant="success">Profile Updated</Message>}
                {loading ? (
                    <Loader />
                ) : error ? (
                    <Message variant="danger">{error}</Message>
                ) : (
                    <form onSubmit={submitHandler} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Name</Label>
                            <Input id="name" type="text" placeholder="Enter name" value={name} onChange={(e) => setName(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="email">Email Address</Label>
                            <Input id="email" type="email" placeholder="Enter email" value={email} onChange={(e) => setEmail(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">Password</Label>
                            <Input id="password" type="password" placeholder="Enter password" value={password} onChange={(e) => setPassword(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="confirmPassword">Confirm Password</Label>
                            <Input id="confirmPassword" type="password" placeholder="Confirm password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                        </div>
                        <Button type="submit">Update</Button>
                    </form>
                )}
            </div>

            <div className="lg:col-span-3">
                <h2 className="mb-4">My Orders</h2>
                {loadingOrders ? (
                    <Loader />
                ) : errorOrders ? (
                    <Message variant="danger">{errorOrders}</Message>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>ID</TableHead>
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
            </div>
        </div>
    );
};

export default ProfileScreen;
