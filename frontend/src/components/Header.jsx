import React from 'react';
import { Route, Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { ShoppingCart, User, ChevronDown, LogOut, Settings, Package, Users, ClipboardList, ToggleLeft } from 'lucide-react';
import SearchBox from './SearchBox';
import { Button } from '@/components/ui/button';
import { logout } from '../actions/userActions';

const Header = () => {
    const dispatch = useDispatch();
    const userLogin = useSelector((state) => state.userLogin);
    const { userInfo } = userLogin;

    const logoutHandler = () => {
        dispatch(logout());
    };

    return (
        <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container-main flex h-16 items-center justify-between">
                <Link to="/" className="text-xl font-bold tracking-tight text-foreground no-underline">
                    ProShop
                </Link>

                <div className="flex items-center gap-4">
                    <Route render={({ history }) => <SearchBox history={history} />} />

                    <Link to="/cart" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground no-underline transition-colors">
                        <ShoppingCart className="h-4 w-4" />
                        <span className="hidden sm:inline">Cart</span>
                    </Link>

                    {userInfo ? (
                        <div className="relative group">
                            <Button variant="ghost" size="sm" className="gap-1.5">
                                <User className="h-4 w-4" />
                                {userInfo.name}
                                <ChevronDown className="h-3 w-3" />
                            </Button>
                            <div className="absolute right-0 top-full hidden group-hover:block pt-1 z-50">
                                <div className="w-48 rounded-md border border-border bg-popover p-1 shadow-md">
                                    <Link to="/profile" className="flex items-center gap-2 rounded-sm px-3 py-2 text-sm text-popover-foreground hover:bg-accent no-underline">
                                        <Settings className="h-4 w-4" />
                                        Profile
                                    </Link>
                                    <button
                                        onClick={logoutHandler}
                                        className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm text-popover-foreground hover:bg-accent"
                                    >
                                        <LogOut className="h-4 w-4" />
                                        Logout
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <Link to="/login" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground no-underline transition-colors">
                            <User className="h-4 w-4" />
                            <span>Sign In</span>
                        </Link>
                    )}

                    {userInfo && userInfo.isAdmin && (
                        <div className="relative group">
                            <Button variant="ghost" size="sm" className="gap-1.5">
                                Admin
                                <ChevronDown className="h-3 w-3" />
                            </Button>
                            <div className="absolute right-0 top-full hidden group-hover:block pt-1 z-50">
                                <div className="w-48 rounded-md border border-border bg-popover p-1 shadow-md">
                                    <Link to="/admin/userlist" className="flex items-center gap-2 rounded-sm px-3 py-2 text-sm text-popover-foreground hover:bg-accent no-underline">
                                        <Users className="h-4 w-4" />
                                        Users
                                    </Link>
                                    <Link to="/admin/productlist" className="flex items-center gap-2 rounded-sm px-3 py-2 text-sm text-popover-foreground hover:bg-accent no-underline">
                                        <Package className="h-4 w-4" />
                                        Products
                                    </Link>
                                    <Link to="/admin/orderlist" className="flex items-center gap-2 rounded-sm px-3 py-2 text-sm text-popover-foreground hover:bg-accent no-underline">
                                        <ClipboardList className="h-4 w-4" />
                                        Orders
                                    </Link>
                                    <Link to="/admin/featuredashboard" className="flex items-center gap-2 rounded-sm px-3 py-2 text-sm text-popover-foreground hover:bg-accent no-underline">
                                        <ToggleLeft className="h-4 w-4" />
                                        Features
                                    </Link>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
};

export default Header;
