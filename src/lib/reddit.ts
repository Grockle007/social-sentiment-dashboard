import { SP500Constituent } from './api';
import sp500Data from './sp500.json';
import Sentiment from 'sentiment';

const sentimentAnalyzer = new Sentiment();

// Add stock-specific sentiment words
const stockSentimentWords = {
    'moon': 5,
    'rocket': 4,
    'bullish': 4,
    'calls': 3,
    'buy': 3,
    'long': 2,
    'gains': 4,
    'pump': 3,
    'rally': 3,
    'breakout': 3,
    'uptrend': 3,
    'strong': 2,
    'beat': 3,
    'upgrade': 4,
    'crash': -5,
    'dump': -4,
    'bearish': -4,
    'puts': -3,
    'sell': -3,
    'short': -3,
    'losses': -4,
    'tank': -4,
    'plunge': -4,
    'drop': -3,
    'fall': -3,
    'downgrade': -4,
    'miss': -3,
    'weak': -2,
    'overvalued': -3,
    'bubble': -3,
    'bagholding': -4,
    'rekt': -5,
    'rug': -5
};


// Common tickers to ignore (words that look like tickers)
const IGNORE_LIST = new Set([
    'A', 'I', 'ARE', 'CAN', 'FOR', 'ON', 'SO', 'AT', 'BE', 'DO', 'GO', 'IF', 'IN', 'IS', 'IT', 'ME', 'MY', 'NO', 'OF', 'OR', 'UP', 'WE',
    'ALL', 'AND', 'ANY', 'ARE', 'BUT', 'CAN', 'DID', 'FOR', 'GET', 'HAS', 'HAD', 'HER', 'HIM', 'HIS', 'HOW', 'ITS', 'LET', 'MAY', 'NEW', 'NOT', 'NOW', 'OFF', 'OLD', 'ONE', 'OUT', 'OWN', 'PUT', 'RUN', 'SAW', 'SAY', 'SHE', 'THE', 'TOO', 'TOP', 'TRY', 'TWO', 'USE', 'WAS', 'WAY', 'WHO', 'WHY', 'YOU',
    'EDIT', 'POST', 'YOLO', 'DD', 'RH', 'EV', 'IPO', 'ATH', 'IMO', 'TLDR', 'CEO', 'CFO', 'CTO', 'SEC', 'FED', 'USA', 'USD', 'ETF', 'SPY', 'QQQ', 'DIA', 'IWM', 'VIX'
]);

const SUBREDDITS = ['wallstreetbets', 'stocks', 'investing', 'StockMarket'];

export interface TrendingStock {
    symbol: string;
    name: string;
    mentions: number;
    sentiment: number; // -1 to 1
    posts: {
        title: string;
        url: string;
        score: number;
        subreddit: string;
    }[];
}

export async function getTrendingStocks(): Promise<TrendingStock[]> {
    const stockMap = new Map<string, TrendingStock>();
    const sp500Symbols = new Set(sp500Data.map(s => s.symbol));

    try {
        const promises = SUBREDDITS.map(async (subreddit) => {
            try {
                const response = await fetch(`https://www.reddit.com/r/${subreddit}/hot.json?limit=25`, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    },
                    next: { revalidate: 300 } // Cache for 5 minutes
                });

                if (!response.ok) {
                    console.warn(`Failed to fetch r/${subreddit}: ${response.status}`);
                    return;
                }

                const data = await response.json();
                const posts = data.data.children;

                for (const post of posts) {
                    const { title, url, score, selftext } = post.data;
                    const text = `${title} ${selftext}`.toUpperCase();

                    // Simple regex to find tickers (e.g., $AAPL or just AAPL surrounded by spaces)
                    // We filter by S&P 500 list to reduce noise
                    const words = text.split(/[^A-Z]+/);

                    for (const word of words) {
                        if (word.length >= 2 && word.length <= 5 && !IGNORE_LIST.has(word) && sp500Symbols.has(word)) {
                            if (!stockMap.has(word)) {
                                stockMap.set(word, {
                                    symbol: word,
                                    name: sp500Data.find(s => s.symbol === word)?.name || word,
                                    mentions: 0,
                                    sentiment: 0,
                                    posts: []
                                });
                            }

                            const stock = stockMap.get(word)!;
                            stock.mentions += 1;

                            // Analyze sentiment of the post with custom stock words
                            const sentimentResult = sentimentAnalyzer.analyze(`${title} ${selftext}`, {
                                extras: stockSentimentWords
                            });

                            // More aggressive normalization to spread out the scores
                            // Typical scores range from -20 to +20 for strong sentiment
                            const normalizedSentiment = Math.max(-1, Math.min(1, sentimentResult.score / 15));
                            stock.sentiment += normalizedSentiment;

                            // Only add unique posts
                            if (!stock.posts.find(p => p.url === url)) {
                                stock.posts.push({ title, url, score, subreddit });
                            }
                        }
                    }
                }
            } catch (error) {
                console.error(`Error scraping r/${subreddit}:`, error);
            }
        });

        await Promise.all(promises);

        // Convert map to array and sort by mentions
        const trending = Array.from(stockMap.values())
            .sort((a, b) => b.mentions - a.mentions)
            .slice(0, 10); // Top 10

        // Average the sentiment scores
        trending.forEach(stock => {
            if (stock.mentions > 0) {
                stock.sentiment = stock.sentiment / stock.mentions;
            }
        });

        console.log('Trending stocks with sentiment:', trending.map(s => ({
            symbol: s.symbol,
            mentions: s.mentions,
            sentiment: s.sentiment.toFixed(2)
        })));

        return trending;

    } catch (error) {
        console.error("Error in getTrendingStocks:", error);
        return [];
    }
}
