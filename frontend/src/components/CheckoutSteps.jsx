import React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

const steps = [
    { label: 'Sign In', path: '/login' },
    { label: 'Shipping', path: '/shipping' },
    { label: 'Payment', path: '/payment' },
    { label: 'Place Order', path: '/placeorder' },
];

const CheckoutSteps = ({ step1, step2, step3, step4 }) => {
    const active = [step1, step2, step3, step4];

    return (
        <nav className="mb-8 flex items-center justify-center gap-2">
            {steps.map((step, i) => (
                <React.Fragment key={step.label}>
                    {i > 0 && <div className="h-px w-8 bg-border" />}
                    {active[i] ? (
                        <Link
                            to={step.path}
                            className="text-sm font-medium text-foreground no-underline hover:text-primary"
                        >
                            {step.label}
                        </Link>
                    ) : (
                        <span className="text-sm text-muted-foreground">
                            {step.label}
                        </span>
                    )}
                </React.Fragment>
            ))}
        </nav>
    );
};

export default CheckoutSteps;
