"use client"

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, MessageSquare, Newspaper, ExternalLink, Send, Search } from 'lucide-react';
import sp500Data from '@/lib/sp500.json';

interface NewsItem {
    headline: string;
    source: string;
    url: string;
    publishedAt: string;
}

interface TrendingStock {
    symbol: string;
    name: string;
    mentions: number;
    sentiment: number;
    posts: {
        title: string;
        url: string;
        score: number;
        subreddit: string;
    }[];
    news?: NewsItem[];
}

interface StockInfo {
    symbol: string;
    name: string;
    price: number | null;
    eps: number | null;
    pe: number | null;
    correlatedStocks: {
        symbol: string;
        name: string;
        correlation: number;
    }[];
}

export default function Dashboard() {
    const [trending, setTrending] = useState<TrendingStock[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedStock, setSelectedStock] = useState<TrendingStock | null>(null);
    const [smsStatus, setSmsStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

    // Stock search states
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<typeof sp500Data>([]);
    const [stockInfo, setStockInfo] = useState<StockInfo | null>(null);
    const [loadingStockInfo, setLoadingStockInfo] = useState(false);

    useEffect(() => {
        fetchTrending();
    }, []);

    const fetchTrending = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/trending');
            const data = await res.json();
            if (Array.isArray(data)) {
                setTrending(data);
                if (data.length > 0) setSelectedStock(data[0]);
            }
        } catch (error) {
            console.error("Failed to fetch trending", error);
        } finally {
            setLoading(false);
        }
    };

    const sendSms = async () => {
        setSmsStatus('sending');
        try {
            const res = await fetch('/api/cron/daily-summary');
            if (res.ok) {
                setSmsStatus('sent');
                setTimeout(() => setSmsStatus('idle'), 3000);
            } else {
                setSmsStatus('error');
            }
        } catch (error) {
            setSmsStatus('error');
        }
    };

    const handleSearch = (query: string) => {
        setSearchQuery(query);
        if (query.length >= 1) {
            const results = sp500Data.filter(stock =>
                stock.symbol.toLowerCase().includes(query.toLowerCase()) ||
                stock.name.toLowerCase().includes(query.toLowerCase())
            ).slice(0, 5);
            setSearchResults(results);
        } else {
            setSearchResults([]);
        }
    };

    const selectStock = async (symbol: string) => {
        setSearchQuery(symbol);
        setSearchResults([]);
        setLoadingStockInfo(true);

        try {
            const res = await fetch(`/api/stock-info?symbol=${symbol}`);
            const data = await res.json();
            setStockInfo(data);
        } catch (error) {
            console.error('Failed to fetch stock info:', error);
        } finally {
            setLoadingStockInfo(false);
        }
    };

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
    };

    const itemVariants = {
        hidden: { y: 20, opacity: 0 },
        visible: { y: 0, opacity: 1 }
    };

    return (
        <motion.div
            initial="hidden"
            animate="visible"
            variants={containerVariants}
            className="p-8 space-y-8 min-h-screen bg-background text-foreground"
        >
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-4xl font-bold tracking-tight flex items-center gap-3">
                        <TrendingUp className="h-10 w-10 text-primary" />
                        Social Sentiment Tracker
                    </h1>
                    <p className="text-muted-foreground">Real-time trending stocks from Reddit & News</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button onClick={sendSms} disabled={smsStatus === 'sending' || smsStatus === 'sent'} variant="outline">
                        <Send className="mr-2 h-4 w-4" />
                        {smsStatus === 'sending' ? 'Sending...' : smsStatus === 'sent' ? 'Sent!' : 'Send Daily Email'}
                    </Button>
                    <Button onClick={fetchTrending} disabled={loading}>
                        {loading ? 'Scanning...' : 'Refresh Data'}
                    </Button>
                </div>
            </div>

            {/* Stock Search Section */}
            <motion.div variants={itemVariants}>
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Search className="h-5 w-5" />
                            Stock Lookup
                        </CardTitle>
                        <CardDescription>Search for any S&P 500 stock to view fundamentals and correlations</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="relative">
                            <Input
                                placeholder="Search by symbol or name (e.g., AAPL or Apple)..."
                                value={searchQuery}
                                onChange={(e) => handleSearch(e.target.value)}
                                className="pr-10"
                            />
                            <Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />

                            {/* Autocomplete dropdown */}
                            {searchResults.length > 0 && (
                                <div className="absolute z-10 w-full mt-2 bg-card border rounded-md shadow-lg max-h-60 overflow-auto">
                                    {searchResults.map(stock => (
                                        <div
                                            key={stock.symbol}
                                            className="p-3 hover:bg-accent cursor-pointer border-b last:border-b-0"
                                            onClick={() => selectStock(stock.symbol)}
                                        >
                                            <div className="font-semibold">{stock.symbol}</div>
                                            <div className="text-sm text-muted-foreground">{stock.name}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Stock Info Display */}
                        {loadingStockInfo && (
                            <div className="mt-6 space-y-4">
                                <Skeleton className="h-20 w-full" />
                                <Skeleton className="h-32 w-full" />
                            </div>
                        )}

                        {stockInfo && !loadingStockInfo && (
                            <div className="mt-6 space-y-4">
                                {/* Fundamentals */}
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="p-4 bg-accent/50 rounded-lg">
                                        <div className="text-sm text-muted-foreground">Price</div>
                                        <div className="text-2xl font-bold">
                                            ${stockInfo.price?.toFixed(2) || 'N/A'}
                                        </div>
                                    </div>
                                    <div className="p-4 bg-accent/50 rounded-lg">
                                        <div className="text-sm text-muted-foreground">EPS</div>
                                        <div className="text-2xl font-bold">
                                            ${stockInfo.eps?.toFixed(2) || 'N/A'}
                                        </div>
                                    </div>
                                    <div className="p-4 bg-accent/50 rounded-lg">
                                        <div className="text-sm text-muted-foreground">P/E Ratio</div>
                                        <div className="text-2xl font-bold">
                                            {stockInfo.pe?.toFixed(2) || 'N/A'}
                                        </div>
                                    </div>
                                </div>

                                {/* Correlated Stocks */}
                                {stockInfo.correlatedStocks.length > 0 && (
                                    <div>
                                        <h4 className="font-semibold mb-3">Highly Correlated Stocks</h4>
                                        <div className="space-y-2">
                                            {stockInfo.correlatedStocks.map(corr => (
                                                <div key={corr.symbol} className="flex items-center justify-between p-3 bg-accent/30 rounded-lg">
                                                    <div>
                                                        <div className="font-semibold">{corr.symbol}</div>
                                                        <div className="text-sm text-muted-foreground">{corr.name}</div>
                                                    </div>
                                                    <Badge variant={corr.correlation > 0.7 ? 'default' : 'secondary'}>
                                                        {(corr.correlation * 100).toFixed(0)}% correlated
                                                    </Badge>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Leaderboard */}
                <motion.div variants={itemVariants} className="md:col-span-1 h-[700px] flex flex-col">
                    <Card className="h-full flex flex-col">
                        <CardHeader>
                            <CardTitle>Trending on Reddit</CardTitle>
                            <CardDescription>Top mentioned stocks in last 24h</CardDescription>
                        </CardHeader>
                        <CardContent className="flex-1 overflow-auto p-0">
                            {loading ? (
                                <div className="p-6 space-y-4">
                                    {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-16 w-full" />)}
                                </div>
                            ) : (
                                <div className="divide-y">
                                    {trending.map((stock, index) => (
                                        <motion.div
                                            key={stock.symbol}
                                            whileHover={{ backgroundColor: "var(--accent)" }}
                                            className={`p-4 cursor-pointer transition-colors flex items-center justify-between ${selectedStock?.symbol === stock.symbol ? 'bg-accent/50 border-l-4 border-primary' : ''}`}
                                            onClick={() => setSelectedStock(stock)}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="text-2xl font-black text-muted-foreground/20 w-8 text-center">{index + 1}</div>
                                                <div>
                                                    <div className="font-bold text-lg">{stock.symbol}</div>
                                                    <div className="text-xs text-muted-foreground">{stock.name}</div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <Badge variant="secondary" className="mb-1">
                                                    <MessageSquare className="h-3 w-3 mr-1" />
                                                    {stock.mentions}
                                                </Badge>
                                                <div className={`text-xs font-medium ${stock.sentiment > 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                    {stock.sentiment > 0 ? 'Bullish' : 'Bearish'}
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </motion.div>

                {/* Deep Dive */}
                <motion.div variants={itemVariants} className="md:col-span-2 h-[700px] flex flex-col gap-6">
                    <AnimatePresence mode="wait">
                        {selectedStock ? (
                            <motion.div
                                key={selectedStock.symbol}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="h-full flex flex-col gap-6"
                            >
                                {/* Reddit Posts */}
                                <Card className="flex-1">
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <MessageSquare className="h-5 w-5 text-[#FF4500]" />
                                            Why it's trending on Reddit
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="overflow-auto max-h-[300px] space-y-4">
                                        {selectedStock.posts.map((post, i) => (
                                            <a key={i} href={post.url} target="_blank" rel="noopener noreferrer" className="block group">
                                                <div className="p-3 rounded-lg border bg-card hover:bg-accent transition-colors">
                                                    <div className="font-medium group-hover:text-primary transition-colors line-clamp-2">
                                                        {post.title}
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                                                        <Badge variant="outline" className="text-[10px]">r/{post.subreddit}</Badge>
                                                        <span>• {post.score} upvotes</span>
                                                        <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                    </div>
                                                </div>
                                            </a>
                                        ))}
                                        {selectedStock.posts.length === 0 && <p className="text-muted-foreground">No recent top posts found.</p>}
                                    </CardContent>
                                </Card>

                                {/* News */}
                                <Card className="flex-1">
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <Newspaper className="h-5 w-5 text-blue-500" />
                                            Latest News
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="overflow-auto max-h-[300px] space-y-4">
                                        {selectedStock.news && selectedStock.news.length > 0 ? (
                                            selectedStock.news.map((item, i) => (
                                                <a key={i} href={item.url} target="_blank" rel="noopener noreferrer" className="block group">
                                                    <div className="p-3 rounded-lg border bg-card hover:bg-accent transition-colors">
                                                        <div className="font-medium group-hover:text-primary transition-colors line-clamp-2">
                                                            {item.headline}
                                                        </div>
                                                        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                                                            <span className="font-semibold text-foreground">{item.source}</span>
                                                            <span>• {new Date(item.publishedAt).toLocaleDateString()}</span>
                                                            <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                        </div>
                                                    </div>
                                                </a>
                                            ))
                                        ) : (
                                            <div className="text-center py-10 text-muted-foreground">
                                                No recent news found or loading...
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </motion.div>
                        ) : (
                            <div className="h-full flex items-center justify-center text-muted-foreground">
                                Select a stock to view details
                            </div>
                        )}
                    </AnimatePresence>
                </motion.div>
            </div>

            {/* Footer */}
            <motion.footer
                variants={itemVariants}
                className="mt-8 py-6 border-t border-border text-center text-sm text-muted-foreground"
            >
                <p>
                    Created by <span className="font-semibold text-foreground">Abhimanyu Singh</span>
                </p>
                <p className="mt-1 text-xs">
                    Social Sentiment & Trending Stocks Dashboard • Powered by Reddit, Alpha Vantage & AI
                </p>
            </motion.footer>
        </motion.div>
    );
}

