import React from 'react';
import { cn } from '@/lib/utils';

const Slider = React.forwardRef(({ className, ...props }, ref) => (
    <input
        type="range"
        ref={ref}
        className={cn(
            'w-full h-2 rounded-lg appearance-none cursor-pointer bg-secondary accent-primary',
            className
        )}
        {...props}
    />
));
Slider.displayName = 'Slider';

export { Slider };
