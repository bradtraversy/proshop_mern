import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, CheckCircle2, Info, AlertTriangle } from 'lucide-react';

const variantMap = {
    danger: { variant: 'destructive', Icon: AlertCircle },
    success: { variant: 'success', Icon: CheckCircle2 },
    warning: { variant: 'warning', Icon: AlertTriangle },
    info: { variant: 'info', Icon: Info },
};

const Message = ({ variant = 'info', children }) => {
    const { variant: alertVariant, Icon } = variantMap[variant] || variantMap.info;

    return (
        <Alert variant={alertVariant} className="my-4">
            <Icon className="h-4 w-4" />
            <AlertDescription>{children}</AlertDescription>
        </Alert>
    );
};

export default Message;
