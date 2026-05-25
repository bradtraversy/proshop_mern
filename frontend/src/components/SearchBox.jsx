import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';

const SearchBox = ({ history }) => {
    const [keyword, setKeyword] = useState('');

    const submitHandler = (e) => {
        e.preventDefault();
        if (keyword.trim()) {
            history.push(`/search/${keyword}`);
        } else {
            history.push('/');
        }
    };

    return (
        <form onSubmit={submitHandler} className="flex items-center gap-2">
            <Input
                type="text"
                name="q"
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="Search Products..."
                aria-label="Search products"
                className="w-48 lg:w-64"
            />
            <Button type="submit" variant="secondary" size="sm">
                <Search className="h-4 w-4" />
            </Button>
        </form>
    );
};

export default SearchBox;
