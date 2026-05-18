import React from 'react';
import { Star, StarHalf } from 'lucide-react';

const Rating = ({ value, text }) => {
    const stars = [1, 2, 3, 4, 5];

    return (
        <div className="rating">
            {stars.map((s) => (
                <span key={s}>
                    {value >= s ? (
                        <Star className="inline h-4 w-4 fill-amber-400 text-amber-400" />
                    ) : value >= s - 0.5 ? (
                        <StarHalf className="inline h-4 w-4 fill-amber-400 text-amber-400" />
                    ) : (
                        <Star className="inline h-4 w-4 text-muted-foreground/30" />
                    )}
                </span>
            ))}
            {text && <span className="ml-2 text-sm text-muted-foreground">{text}</span>}
        </div>
    );
};

export default Rating;
