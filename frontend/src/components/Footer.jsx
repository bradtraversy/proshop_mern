import React from 'react';
import { Separator } from '@/components/ui/separator';

const Footer = () => {
    return (
        <footer className="mt-auto">
            <Separator />
            <div className="container-main py-6 text-center text-sm text-muted-foreground">
                Copyright &copy; ProShop
            </div>
        </footer>
    );
};

export default Footer;
