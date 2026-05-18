import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Loader from './Loader';
import Message from './Message';
import { listTopProducts } from '../actions/productActions';

const ProductCarousel = () => {
    const [current, setCurrent] = useState(0);
    const dispatch = useDispatch();

    const productTopRated = useSelector((state) => state.productTopRated);
    const { loading, error, products } = productTopRated;

    useEffect(() => {
        dispatch(listTopProducts());
    }, [dispatch]);

    useEffect(() => {
        if (products.length > 0) {
            const timer = setInterval(() => {
                setCurrent((prev) => (prev + 1) % products.length);
            }, 5000);
            return () => clearInterval(timer);
        }
    }, [products]);

    if (loading) return <Loader />;
    if (error) return <Message variant="danger">{error}</Message>;

    return (
        <div className="relative mb-8 overflow-hidden rounded-lg bg-muted">
            <div className="relative h-64 sm:h-80 md:h-96">
                {products.map((product, index) => (
                    <Link
                        key={product._id}
                        to={`/product/${product._id}`}
                        className={cn(
                            'absolute inset-0 flex items-center justify-center transition-opacity duration-500',
                            index === current ? 'opacity-100' : 'opacity-0 pointer-events-none'
                        )}
                    >
                        <img
                            src={product.image}
                            alt={product.name}
                            className="h-full w-full object-contain p-4"
                        />
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4">
                            <h2 className="text-lg font-semibold text-white">
                                {product.name} (${product.price})
                            </h2>
                        </div>
                    </Link>
                ))}
            </div>

            {products.length > 1 && (
                <>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background"
                        onClick={() => setCurrent((prev) => (prev - 1 + products.length) % products.length)}
                    >
                        <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background"
                        onClick={() => setCurrent((prev) => (prev + 1) % products.length)}
                    >
                        <ChevronRight className="h-5 w-5" />
                    </Button>
                </>
            )}

            <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
                {products.map((_, i) => (
                    <button
                        key={i}
                        className={cn(
                            'h-1.5 rounded-full transition-all',
                            i === current ? 'w-6 bg-white' : 'w-1.5 bg-white/50'
                        )}
                        onClick={() => setCurrent(i)}
                    />
                ))}
            </div>
        </div>
    );
};

function cn(...classes) {
    return classes.filter(Boolean).join(' ');
}

export default ProductCarousel;
