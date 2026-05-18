import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import Rating from './Rating';

const Product = ({ product }) => {
    return (
        <Card className="group overflow-hidden transition-all hover:shadow-md">
            <Link to={`/product/${product._id}`}>
                <div className="aspect-square overflow-hidden">
                    <img
                        src={product.image}
                        alt={product.name}
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                </div>
            </Link>
            <CardContent className="p-4">
                <Link to={`/product/${product._id}`} className="no-underline">
                    <h3 className="text-sm font-semibold text-foreground line-clamp-2 hover:text-primary/80">
                        {product.name}
                    </h3>
                </Link>
                <div className="mt-2">
                    <Rating value={product.rating} text={`${product.numReviews} reviews`} />
                </div>
                <p className="mt-2 text-lg font-bold text-foreground">${product.price}</p>
            </CardContent>
        </Card>
    );
};

export default Product;
