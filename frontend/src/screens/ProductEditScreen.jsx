import axios from 'axios';
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Message from '../components/Message';
import Loader from '../components/Loader';
import FormContainer from '../components/FormContainer';
import { listProductDetails, updateProduct } from '../actions/productActions';
import { PRODUCT_UPDATE_RESET } from '../constants/productConstants';

const ProductEditScreen = ({ match, history }) => {
    const productId = match.params.id;

    const [name, setName] = useState('');
    const [price, setPrice] = useState(0);
    const [image, setImage] = useState('');
    const [brand, setBrand] = useState('');
    const [category, setCategory] = useState('');
    const [countInStock, setCountInStock] = useState(0);
    const [description, setDescription] = useState('');
    const [uploading, setUploading] = useState(false);

    const dispatch = useDispatch();

    const productDetails = useSelector((state) => state.productDetails);
    const { loading, error, product } = productDetails;

    const productUpdate = useSelector((state) => state.productUpdate);
    const { loading: loadingUpdate, error: errorUpdate, success: successUpdate } = productUpdate;

    useEffect(() => {
        if (successUpdate) {
            dispatch({ type: PRODUCT_UPDATE_RESET });
            history.push('/admin/productlist');
        } else {
            if (!product.name || product._id !== productId) {
                dispatch(listProductDetails(productId));
            } else {
                setName(product.name);
                setPrice(product.price);
                setImage(product.image);
                setBrand(product.brand);
                setCategory(product.category);
                setCountInStock(product.countInStock);
                setDescription(product.description);
            }
        }
    }, [dispatch, history, productId, product, successUpdate]);

    const uploadFileHandler = async (e) => {
        const file = e.target.files[0];
        const formData = new FormData();
        formData.append('image', file);
        setUploading(true);
        try {
            const config = { headers: { 'Content-Type': 'multipart/form-data' } };
            const { data } = await axios.post('/api/upload', formData, config);
            setImage(data);
            setUploading(false);
        } catch (error) {
            console.error(error);
            setUploading(false);
        }
    };

    const submitHandler = (e) => {
        e.preventDefault();
        dispatch(updateProduct({ _id: productId, name, price, image, brand, category, description, countInStock }));
    };

    return (
        <>
            <Link to="/admin/productlist">
                <Button variant="outline" className="mb-6">Go Back</Button>
            </Link>
            <FormContainer>
                <h1 className="mb-6">Edit Product</h1>
                {loadingUpdate && <Loader />}
                {errorUpdate && <Message variant="danger">{errorUpdate}</Message>}
                {loading ? (
                    <Loader />
                ) : error ? (
                    <Message variant="danger">{error}</Message>
                ) : (
                    <form onSubmit={submitHandler} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Name</Label>
                            <Input id="name" type="text" placeholder="Enter name" value={name} onChange={(e) => setName(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="price">Price</Label>
                            <Input id="price" type="number" placeholder="Enter price" value={price} onChange={(e) => setPrice(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="image">Image</Label>
                            <Input id="image" type="text" placeholder="Enter image url" value={image} onChange={(e) => setImage(e.target.value)} />
                            <Input id="image-file" type="file" onChange={uploadFileHandler} />
                            {uploading && <Loader />}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="brand">Brand</Label>
                            <Input id="brand" type="text" placeholder="Enter brand" value={brand} onChange={(e) => setBrand(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="countInStock">Count In Stock</Label>
                            <Input id="countInStock" type="number" placeholder="Enter count in stock" value={countInStock} onChange={(e) => setCountInStock(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="category">Category</Label>
                            <Input id="category" type="text" placeholder="Enter category" value={category} onChange={(e) => setCategory(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="description">Description</Label>
                            <textarea
                                id="description"
                                placeholder="Enter description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[80px]"
                            />
                        </div>
                        <Button type="submit">Update</Button>
                    </form>
                )}
            </FormContainer>
        </>
    );
};

export default ProductEditScreen;
