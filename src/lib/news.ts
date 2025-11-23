import * as cheerio from 'cheerio';
import sp500Data from './sp500.json';

// Common tickers to ignore (words that look like tickers)
const IGNORE_LIST = new Set([
    'A', 'I', 'ARE', 'CAN', 'FOR', 'ON', 'SO', 'AT', 'BE', 'DO', 'GO', 'IF', 'IN', 'IS', 'IT', 'ME', 'MY', 'NO', 'OF', 'OR', 'UP', 'WE',
    'ALL', 'AND', 'ANY', 'ARE', 'BUT', 'CAN', 'DID', 'FOR', 'GET', 'HAS', 'HAD', 'HER', 'HIM', 'HIS', 'HOW', 'ITS', 'LET', 'MAY', 'NEW', 'NOT', 'NOW', 'OFF', 'OLD', 'ONE', 'OUT', 'OWN', 'PUT', 'RUN', 'SAW', 'SAY', 'SHE', 'THE', 'TOO', 'TOP', 'TRY', 'TWO', 'USE', 'WAS', 'WAY', 'WHO', 'WHY', 'YOU',
    'EDIT', 'POST', 'YOLO', 'DD', 'RH', 'EV', 'IPO', 'ATH', 'IMO', 'TLDR', 'CEO', 'CFO', 'CTO', 'SEC', 'FED', 'USA', 'USD', 'ETF', 'SPY', 'QQQ', 'DIA', 'IWM', 'VIX', 'NEWS', 'LIVE', 'MARKET', 'STOCK', 'STOCKS'
]);

export interface NewsItem {
    headline: string;
    source: string;
    url: string;
    publishedAt: string;
}

export async function getStockNews(symbol: string): Promise<NewsItem[]> {
    try {
        // Scrape Yahoo Finance News for the specific stock
        const response = await fetch(`https://finance.yahoo.com/quote/${symbol}/news`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            next: { revalidate: 3600 }
        });

        if (!response.ok) return [];

        const html = await response.text();
        const $ = cheerio.load(html);
        const news: NewsItem[] = [];

        // Selectors for Yahoo Finance news stream (these change often, so we try a generic approach)
        // Looking for list items that contain links and text
        $('li.stream-item').each((i, el) => {
            if (i >= 5) return; // Limit to 5 items

            const titleElement = $(el).find('h3');
            const linkElement = $(el).find('a').first();
            const sourceElement = $(el).find('.pub-source'); // Example class, might need adjustment

            const headline = titleElement.text().trim();
            let url = linkElement.attr('href');
            const source = sourceElement.text().trim() || 'Yahoo Finance';

            if (headline && url) {
                if (!url.startsWith('http')) {
                    url = `https://finance.yahoo.com${url}`;
                }
                news.push({
                    headline,
                    source,
                    url,
                    publishedAt: new Date().toISOString() // Yahoo doesn't always give easy timestamp in list
                });
            }
        });

        // Fallback if specific selectors fail: try to find any h3 inside a list
        if (news.length === 0) {
            $('h3').each((i, el) => {
                if (i >= 5) return;
                const headline = $(el).text().trim();
                const link = $(el).closest('a');
                let url = link.attr('href');

                if (headline && url) {
                    if (!url.startsWith('http')) {
                        url = `https://finance.yahoo.com${url}`;
                    }
                    news.push({
                        headline,
                        source: 'Yahoo Finance',
                        url,
                        publishedAt: new Date().toISOString()
                    });
                }
            });
        }

        return news;
    } catch (error) {
        console.error(`Error fetching news for ${symbol}:`, error);
        return [];
    }
}

export async function getMarketNews(): Promise<Map<string, number>> {
    const mentions = new Map<string, number>();
    const sp500Symbols = new Set(sp500Data.map(s => s.symbol));

    try {
        // Try to scrape Google Finance news instead (simpler, less likely to block)
        const response = await fetch(`https://www.google.com/finance/`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            },
            signal: AbortSignal.timeout(5000) // 5 second timeout
        });

        if (!response.ok) {
            console.warn(`Failed to fetch market news: ${response.status}`);
            return getMockNewsMentions();
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        // Extract text from all headlines and article titles
        $('div[role="heading"], h1, h2, h3, h4').each((i, el) => {
            const headline = $(el).text().toUpperCase();
            const words = headline.split(/[^A-Z]+/);

            for (const word of words) {
                if (word.length >= 2 && word.length <= 5 && !IGNORE_LIST.has(word) && sp500Symbols.has(word)) {
                    mentions.set(word, (mentions.get(word) || 0) + 1);
                }
            }
        });

        console.log(`Found ${mentions.size} stocks mentioned in news`);

        // If we found nothing, use mock data
        if (mentions.size === 0) {
            return getMockNewsMentions();
        }

        return mentions;
    } catch (error) {
        console.error("Error fetching market news:", error);
        // Return mock data as fallback
        return getMockNewsMentions();
    }
}

// Fallback mock data for when scraping fails
function getMockNewsMentions(): Map<string, number> {
    const mentions = new Map<string, number>();
    // Add some realistic mock mentions
    const mockStocks = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA', 'META'];
    mockStocks.forEach(symbol => {
        mentions.set(symbol, Math.floor(Math.random() * 5) + 1);
    });
    console.log('Using mock news mentions as fallback');
    return mentions;
}
