import React from 'react';
import { cn } from '@/lib/utils';

const Skeleton = ({ className, ...props }) => (
    <div className={cn('animate-pulse rounded-md bg-muted', className)} {...props} />
);

export { Skeleton };
