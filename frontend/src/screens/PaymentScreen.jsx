import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import FormContainer from '../components/FormContainer';
import CheckoutSteps from '../components/CheckoutSteps';
import { savePaymentMethod } from '../actions/cartActions';

const PaymentScreen = ({ history }) => {
    const cart = useSelector((state) => state.cart);
    const { shippingAddress } = cart;

    if (!shippingAddress.address) {
        history.push('/shipping');
    }

    const [paymentMethod, setPaymentMethod] = useState('PayPal');
    const dispatch = useDispatch();

    const submitHandler = (e) => {
        e.preventDefault();
        dispatch(savePaymentMethod(paymentMethod));
        history.push('/placeorder');
    };

    return (
        <FormContainer>
            <CheckoutSteps step1 step2 step3 />
            <h1 className="mb-6">Payment Method</h1>
            <form onSubmit={submitHandler} className="space-y-6">
                <fieldset>
                    <Label as="legend" className="text-base font-medium">Select Method</Label>
                    <div className="mt-3 space-y-3">
                        <label className="flex items-center gap-3 cursor-pointer">
                            <input
                                type="radio"
                                name="paymentMethod"
                                value="PayPal"
                                checked={paymentMethod === 'PayPal'}
                                onChange={(e) => setPaymentMethod(e.target.value)}
                                className="h-4 w-4 accent-primary"
                            />
                            <span className="text-sm">PayPal or Credit Card</span>
                        </label>
                    </div>
                </fieldset>
                <Button type="submit" className="w-full">Continue</Button>
            </form>
        </FormContainer>
    );
};

export default PaymentScreen;
