import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import FormContainer from '../components/FormContainer';
import CheckoutSteps from '../components/CheckoutSteps';
import { saveShippingAddress } from '../actions/cartActions';

const ShippingScreen = ({ history }) => {
    const cart = useSelector((state) => state.cart);
    const { shippingAddress } = cart;

    const [address, setAddress] = useState(shippingAddress.address);
    const [city, setCity] = useState(shippingAddress.city);
    const [postalCode, setPostalCode] = useState(shippingAddress.postalCode);
    const [country, setCountry] = useState(shippingAddress.country);

    const dispatch = useDispatch();

    const submitHandler = (e) => {
        e.preventDefault();
        dispatch(saveShippingAddress({ address, city, postalCode, country }));
        history.push('/payment');
    };

    return (
        <FormContainer>
            <CheckoutSteps step1 step2 />
            <h1 className="mb-6">Shipping</h1>
            <form onSubmit={submitHandler} className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="address">Address</Label>
                    <Input id="address" type="text" placeholder="Enter address" value={address} required onChange={(e) => setAddress(e.target.value)} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input id="city" type="text" placeholder="Enter city" value={city} required onChange={(e) => setCity(e.target.value)} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="postalCode">Postal Code</Label>
                    <Input id="postalCode" type="text" placeholder="Enter postal code" value={postalCode} required onChange={(e) => setPostalCode(e.target.value)} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="country">Country</Label>
                    <Input id="country" type="text" placeholder="Enter country" value={country} required onChange={(e) => setCountry(e.target.value)} />
                </div>
                <Button type="submit" className="w-full">Continue</Button>
            </form>
        </FormContainer>
    );
};

export default ShippingScreen;
