import { NextResponse } from 'next/server';
import { getTrendingStocks, TrendingStock } from '@/lib/reddit';
import { getStockNews, getMarketNews, NewsItem } from '@/lib/news';
import sp500Data from '@/lib/sp500.json';

export async function GET() {
    try {
        // 1. Get Trending Stocks from Reddit
        const redditTrending = await getTrendingStocks();

        // 2. Get Trending Stocks from News
        const newsMentions = await getMarketNews();

        // 3. Merge Data
        const stockMap = new Map<string, TrendingStock>();

        // Add Reddit data
        redditTrending.forEach(stock => {
            stockMap.set(stock.symbol, stock);
        });

        // Add News data
        newsMentions.forEach((mentions, symbol) => {
            if (stockMap.has(symbol)) {
                stockMap.get(symbol)!.mentions += mentions * 2; // News mentions worth double?
            } else {
                // If only in news, create new entry
                stockMap.set(symbol, {
                    symbol: symbol,
                    name: sp500Data.find(s => s.symbol === symbol)?.name || symbol,
                    mentions: mentions * 2,
                    sentiment: (Math.random() * 2) - 1, // Mock sentiment
                    posts: [] // No reddit posts
                });
            }
        });

        // Convert back to array and sort
        const mergedTrending = Array.from(stockMap.values())
            .sort((a, b) => b.mentions - a.mentions)
            .slice(0, 10);

        // 4. Enrich with specific News (Why is it trending?)
        const enrichedTrending = await Promise.all(mergedTrending.map(async (stock, index) => {
            let news: NewsItem[] = [];
            if (index < 3) {
                news = await getStockNews(stock.symbol);
            }
            return { ...stock, news };
        }));

        return NextResponse.json(enrichedTrending);
    } catch (error) {
        console.error("Failed to fetch trending data:", error);
        return NextResponse.json({ error: "Failed to fetch trending data" }, { status: 500 });
    }
}
