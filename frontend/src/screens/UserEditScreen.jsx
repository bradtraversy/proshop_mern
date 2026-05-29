import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Message from '../components/Message';
import Loader from '../components/Loader';
import FormContainer from '../components/FormContainer';
import { getUserDetails, updateUser } from '../actions/userActions';
import { USER_UPDATE_RESET } from '../constants/userConstants';

const UserEditScreen = ({ match, history }) => {
    const userId = match.params.id;

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [isAdmin, setIsAdmin] = useState(false);

    const dispatch = useDispatch();

    const userDetails = useSelector((state) => state.userDetails);
    const { loading, error, user } = userDetails;

    const userUpdate = useSelector((state) => state.userUpdate);
    const { loading: loadingUpdate, error: errorUpdate, success: successUpdate } = userUpdate;

    useEffect(() => {
        if (successUpdate) {
            dispatch({ type: USER_UPDATE_RESET });
            history.push('/admin/userlist');
        } else {
            if (!user.name || user._id !== userId) {
                dispatch(getUserDetails(userId));
            } else {
                setName(user.name);
                setEmail(user.email);
                setIsAdmin(user.isAdmin);
            }
        }
    }, [dispatch, history, userId, user, successUpdate]);

    const submitHandler = (e) => {
        e.preventDefault();
        dispatch(updateUser({ _id: userId, name, email, isAdmin }));
    };

    return (
        <>
            <Link to="/admin/userlist">
                <Button variant="outline" className="mb-6">Go Back</Button>
            </Link>
            <FormContainer>
                <h1 className="mb-6">Edit User</h1>
                {loadingUpdate && <Loader />}
                {errorUpdate && <Message variant="danger">{errorUpdate}</Message>}
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
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="isadmin"
                                checked={isAdmin}
                                onChange={(e) => setIsAdmin(e.target.checked)}
                                className="h-4 w-4 accent-primary"
                            />
                            <Label htmlFor="isadmin">Is Admin</Label>
                        </div>
                        <Button type="submit">Update</Button>
                    </form>
                )}
            </FormContainer>
        </>
    );
};

export default UserEditScreen;
