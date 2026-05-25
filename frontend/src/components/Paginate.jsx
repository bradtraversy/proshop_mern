import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const Paginate = ({ pages, page, isAdmin = false, keyword = '' }) => {
    return (
        pages > 1 && (
            <div className="flex items-center justify-center gap-1 py-4">
                {[...Array(pages).keys()].map((x) => (
                    <Link
                        key={x + 1}
                        to={
                            !isAdmin
                                ? keyword
                                    ? `/search/${keyword}/page/${x + 1}`
                                    : `/page/${x + 1}`
                                : `/admin/productlist/${x + 1}`
                        }
                    >
                        <Button
                            variant={x + 1 === page ? 'default' : 'outline'}
                            size="sm"
                            className="h-8 w-8 p-0"
                        >
                            {x + 1}
                        </Button>
                    </Link>
                ))}
            </div>
        )
    );
};

export default Paginate;
