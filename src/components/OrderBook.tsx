'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, ArrowUp, ArrowDown } from 'lucide-react';
import Link from 'next/link';

interface OrderBookEntry {
    price: string;
    quantity: string;
}

interface OrderBookData {
    bids: OrderBookEntry[];
    asks: OrderBookEntry[];
}

export default function OrderBook() {
    const [orderBook, setOrderBook] = useState<OrderBookData>({ bids: [], asks: [] });
    const [lastPrice, setLastPrice] = useState<number | null>(null);
    const [priceDirection, setPriceDirection] = useState<'up' | 'down' | null>(null);
    const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const wsRef = useRef<WebSocket | null>(null);

    useEffect(() => {
        let ws: WebSocket | null = null;

        const connect = (url: string, isRetry = false) => {
            setConnectionStatus('connecting');
            setErrorMsg(null);

            try {
                ws = new WebSocket(url);
                wsRef.current = ws;

                ws.onopen = () => {
                    console.log(`Connected to Binance WebSocket (${url})`);
                    setConnectionStatus('connected');
                };

                ws.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        if (data.bids && data.asks) {
                            const bids = data.bids.map((b: string[]) => ({ price: b[0], quantity: b[1] }));
                            const asks = data.asks.map((a: string[]) => ({ price: a[0], quantity: a[1] }));

                            setOrderBook({ bids, asks });

                            if (bids.length > 0 && asks.length > 0) {
                                const bestBid = parseFloat(bids[0].price);
                                const bestAsk = parseFloat(asks[0].price);
                                const currentPrice = (bestBid + bestAsk) / 2;

                                setLastPrice(prev => {
                                    if (prev) {
                                        setPriceDirection(currentPrice > prev ? 'up' : 'down');
                                    }
                                    return currentPrice;
                                });
                            }
                        }
                    } catch (e) {
                        console.error('Error parsing WebSocket message:', e);
                    }
                };

                ws.onerror = (error) => {
                    console.error('WebSocket error:', error);
                    // Only set error if we haven't connected yet or if it's a fatal error
                    if (connectionStatus !== 'connected') {
                        setConnectionStatus('error');
                    }
                };

                ws.onclose = () => {
                    console.log('WebSocket connection closed');
                    if (connectionStatus === 'connected') {
                        setConnectionStatus('error');
                        setErrorMsg('Connection lost. Refresh to reconnect.');
                    } else if (!isRetry) {
                        // If failed on first attempt (likely .com blocked), try .us
                        console.log('Retrying with Binance US...');
                        connect('wss://stream.binance.us:9443/ws/btcusdt@depth20@100ms', true);
                    } else {
                        setConnectionStatus('error');
                        setErrorMsg('Failed to connect to Binance. Firewalls may be blocking the connection.');
                    }
                };
            } catch (e) {
                console.error('WebSocket connection failed:', e);
                setConnectionStatus('error');
                setErrorMsg('Failed to initialize WebSocket.');
            }
        };

        // Start with global Binance
        connect('wss://stream.binance.com:9443/ws/btcusdt@depth20@100ms');

        return () => {
            if (ws && ws.readyState === 1) {
                ws.close();
            }
        };
    }, []);

    // Helper to format numbers
    const formatPrice = (price: string) => parseFloat(price).toFixed(2);
    const formatQty = (qty: string) => parseFloat(qty).toFixed(5);

    // Calculate max volume for depth bars
    const maxBidVol = Math.max(...orderBook.bids.map(b => parseFloat(b.quantity)), 0);
    const maxAskVol = Math.max(...orderBook.asks.map(a => parseFloat(a.quantity)), 0);
    const maxVol = Math.max(maxBidVol, maxAskVol);

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/" className="p-2 hover:bg-accent rounded-full transition-colors">
                        <ArrowLeft className="h-6 w-6" />
                    </Link>
                    <h1 className="text-3xl font-bold tracking-tight">Bitcoin Live Order Book</h1>
                </div>
                {lastPrice && (
                    <div className={`text-2xl font-mono font-bold flex items-center gap-2 ${priceDirection === 'up' ? 'text-green-500' :
                        priceDirection === 'down' ? 'text-red-500' : ''
                        }`}>
                        ${lastPrice.toFixed(2)}
                        {priceDirection === 'up' && <ArrowUp className="h-6 w-6" />}
                        {priceDirection === 'down' && <ArrowDown className="h-6 w-6" />}
                    </div>
                )}
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex justify-between text-sm text-muted-foreground uppercase">
                        <span>Bid (Buy)</span>
                        <span>Ask (Sell)</span>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 gap-4 font-mono text-sm">
                        {/* Bids Side (Green) */}
                        <div className="space-y-1">
                            <div className="grid grid-cols-3 text-xs text-muted-foreground mb-2 px-2">
                                <span>Qty</span>
                                <span className="text-right">Price</span>
                                <span className="text-right">Total</span>
                            </div>
                            {orderBook.bids.slice(0, 15).map((bid, i) => (
                                <div key={i} className="relative grid grid-cols-3 px-2 py-1 hover:bg-accent/50 rounded">
                                    {/* Depth Bar */}
                                    <div
                                        className="absolute top-0 right-0 bottom-0 bg-green-500/10 transition-all duration-200"
                                        style={{ width: `${(parseFloat(bid.quantity) / maxVol) * 100}%` }}
                                    />
                                    <span className="relative z-10">{formatQty(bid.quantity)}</span>
                                    <span className="relative z-10 text-right text-green-500">{formatPrice(bid.price)}</span>
                                    <span className="relative z-10 text-right text-muted-foreground">
                                        {(parseFloat(bid.price) * parseFloat(bid.quantity)).toFixed(2)}
                                    </span>
                                </div>
                            ))}
                        </div>

                        {/* Asks Side (Red) */}
                        <div className="space-y-1">
                            <div className="grid grid-cols-3 text-xs text-muted-foreground mb-2 px-2">
                                <span>Price</span>
                                <span className="text-right">Qty</span>
                                <span className="text-right">Total</span>
                            </div>
                            {orderBook.asks.slice(0, 15).map((ask, i) => (
                                <div key={i} className="relative grid grid-cols-3 px-2 py-1 hover:bg-accent/50 rounded">
                                    {/* Depth Bar */}
                                    <div
                                        className="absolute top-0 left-0 bottom-0 bg-red-500/10 transition-all duration-200"
                                        style={{ width: `${(parseFloat(ask.quantity) / maxVol) * 100}%` }}
                                    />
                                    <span className="relative z-10 text-red-500">{formatPrice(ask.price)}</span>
                                    <span className="relative z-10 text-right">{formatQty(ask.quantity)}</span>
                                    <span className="relative z-10 text-right text-muted-foreground">
                                        {(parseFloat(ask.price) * parseFloat(ask.quantity)).toFixed(2)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="text-center text-xs text-muted-foreground space-y-2">
                <div>Real-time data provided by Binance WebSocket API</div>
                {connectionStatus === 'connecting' && (
                    <div className="text-yellow-500 animate-pulse">Connecting to Binance...</div>
                )}
                {errorMsg && (
                    <div className="text-red-500 font-medium bg-red-500/10 p-2 rounded inline-block">
                        {errorMsg}
                    </div>
                )}
            </div>
        </div>
    );
}
