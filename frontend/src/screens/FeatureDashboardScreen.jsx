import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import Message from '../components/Message';
import Loader from '../components/Loader';
import { listFeatures, updateFeature } from '../actions/featureActions';
import { FEATURE_UPDATE_RESET } from '../constants/featureConstants';

const FeatureDashboardScreen = ({ history }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [localTraffic, setLocalTraffic] = useState({});
    const debounceTimers = useRef({});

    const dispatch = useDispatch();

    const featureList = useSelector((state) => state.featureList);
    const { loading, error, features } = featureList;

    const featureUpdate = useSelector((state) => state.featureUpdate);
    const { success: successUpdate, error: errorUpdate } = featureUpdate;

    const userLogin = useSelector((state) => state.userLogin);
    const { userInfo } = userLogin;

    useEffect(() => {
        if (!userInfo || !userInfo.isAdmin) {
            history.push('/login');
            return;
        }
        if (successUpdate) {
            dispatch({ type: FEATURE_UPDATE_RESET });
        }
        dispatch(listFeatures());
    }, [dispatch, history, userInfo, successUpdate]);

    useEffect(() => {
        const trafficMap = {};
        features.forEach((f) => { trafficMap[f.key] = f.traffic_percentage; });
        setLocalTraffic(trafficMap);
    }, [features]);

    const toggleHandler = (key, currentStatus) => {
        const newStatus = currentStatus === 'Enabled' ? 'Disabled' : 'Enabled';
        dispatch(updateFeature(key, { status: newStatus }));
    };

    const statusChangeHandler = (key, newStatus) => {
        dispatch(updateFeature(key, { status: newStatus }));
    };

    const sliderHandler = useCallback((key, value) => {
        setLocalTraffic((prev) => ({ ...prev, [key]: value }));
        if (debounceTimers.current[key]) {
            clearTimeout(debounceTimers.current[key]);
        }
        debounceTimers.current[key] = setTimeout(() => {
            dispatch(updateFeature(key, { traffic_percentage: value }));
        }, 500);
    }, [dispatch]);

    const filteredFeatures = features.filter((feature) => {
        const matchesSearch = feature.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'All' || feature.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const statusBadgeVariant = (status) => {
        switch (status) {
            case 'Enabled': return 'success';
            case 'Testing': return 'warning';
            case 'Disabled': return 'secondary';
            default: return 'outline';
        }
    };

    const filters = ['All', 'Enabled', 'Testing', 'Disabled'];

    return (
        <>
            <h1 className="mb-6">Feature Dashboard</h1>

            {errorUpdate && <Message variant="danger">{errorUpdate}</Message>}

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
                <Input
                    type="text"
                    placeholder="Search features..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    aria-label="Search features by name"
                    className="max-w-sm"
                />
                <div className="flex gap-1">
                    {filters.map((status) => (
                        <Button
                            key={status}
                            variant={statusFilter === status ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setStatusFilter(status)}
                            aria-pressed={statusFilter === status}
                        >
                            {status}
                        </Button>
                    ))}
                </div>
            </div>

            {loading ? (
                <Loader />
            ) : error ? (
                <Message variant="danger">{error}</Message>
            ) : filteredFeatures.length === 0 ? (
                <Message variant="info">No features found matching your criteria</Message>
            ) : (
                <Table aria-label="Feature flags management table">
                    <TableHeader>
                        <TableRow>
                            <TableHead>NAME</TableHead>
                            <TableHead>STATUS</TableHead>
                            <TableHead>TRAFFIC %</TableHead>
                            <TableHead>LAST MODIFIED</TableHead>
                            <TableHead>TOGGLE</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredFeatures.map((feature) => (
                            <TableRow key={feature.key}>
                                <TableCell className="font-medium">{feature.name}</TableCell>
                                <TableCell>
                                    <Badge variant={statusBadgeVariant(feature.status)}>
                                        {feature.status}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-3 min-w-[160px]">
                                        <Slider
                                            min={0}
                                            max={100}
                                            value={localTraffic[feature.key] !== undefined ? localTraffic[feature.key] : feature.traffic_percentage}
                                            onChange={(e) => sliderHandler(feature.key, Number(e.target.value))}
                                            aria-label={`Traffic percentage for ${feature.name}`}
                                            aria-valuemin={0}
                                            aria-valuemax={100}
                                            aria-valuenow={localTraffic[feature.key] !== undefined ? localTraffic[feature.key] : feature.traffic_percentage}
                                            className="flex-1"
                                        />
                                        <span className="text-sm text-muted-foreground w-10 text-right tabular-nums">
                                            {localTraffic[feature.key] !== undefined ? localTraffic[feature.key] : feature.traffic_percentage}%
                                        </span>
                                    </div>
                                </TableCell>
                                <TableCell className="text-muted-foreground text-sm">{feature.last_modified}</TableCell>
                                <TableCell>
                                    {feature.status === 'Testing' ? (
                                        <div className="flex gap-2">
                                            <Button
                                                variant="success"
                                                size="sm"
                                                onClick={() => statusChangeHandler(feature.key, 'Enabled')}
                                                aria-label={`Enable ${feature.name} — currently ${feature.status}`}
                                            >
                                                Enable
                                            </Button>
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                onClick={() => statusChangeHandler(feature.key, 'Disabled')}
                                                aria-label={`Disable ${feature.name} — currently ${feature.status}`}
                                            >
                                                Disable
                                            </Button>
                                        </div>
                                    ) : (
                                        <Button
                                            variant={feature.status === 'Enabled' ? 'secondary' : 'success'}
                                            size="sm"
                                            onClick={() => toggleHandler(feature.key, feature.status)}
                                            aria-label={`Toggle ${feature.name} — currently ${feature.status}`}
                                        >
                                            {feature.status === 'Enabled' ? 'Disable' : 'Enable'}
                                        </Button>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}
        </>
    );
};

export default FeatureDashboardScreen;
