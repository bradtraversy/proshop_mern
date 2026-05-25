import React from 'react';
import { cn } from '@/lib/utils';

const Separator = React.forwardRef(
    ({ className, orientation = 'horizontal', decorative = true, ...props }, ref) => (
        <div
            ref={ref}
            role={decorative ? 'none' : 'separator'}
            aria-orientation={!decorative ? orientation : undefined}
            className={cn(
                'shrink-0 bg-border',
                orientation === 'horizontal' ? 'h-[1px] w-full' : 'h-full w-[1px]',
                className
            )}
            {...props}
        />
    )
);
Separator.displayName = 'Separator';

export { Separator };
