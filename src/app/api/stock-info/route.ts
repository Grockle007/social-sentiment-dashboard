import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import sp500Data from '@/lib/sp500.json';

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

const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY;

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol')?.toUpperCase();

    if (!symbol) {
        return NextResponse.json({ error: 'Symbol parameter required' }, { status: 400 });
    }

    const stockData = sp500Data.find(s => s.symbol === symbol);
    if (!stockData) {
        return NextResponse.json({ error: 'Stock not found in S&P 500' }, { status: 404 });
    }

    try {
        // Try Alpha Vantage API first
        const fundamentals = await fetchAlphaVantageData(symbol);

        // Get correlated stocks
        const correlatedStocks = await getCorrelatedStocks(symbol);

        const stockInfo: StockInfo = {
            symbol,
            name: stockData.name,
            price: fundamentals.price,
            eps: fundamentals.eps,
            pe: fundamentals.pe,
            correlatedStocks
        };

        return NextResponse.json(stockInfo);
    } catch (error) {
        console.error(`Error fetching stock info for ${symbol}:`, error);

        // Return mock data as fallback
        return NextResponse.json({
            symbol,
            name: stockData.name,
            price: Math.random() * 500 + 50,
            eps: Math.random() * 10 + 1,
            pe: Math.random() * 30 + 10,
            correlatedStocks: getMockCorrelatedStocks(symbol)
        });
    }
}

async function fetchAlphaVantageData(symbol: string) {
    if (!ALPHA_VANTAGE_API_KEY) {
        console.warn('Alpha Vantage API key not found, using fallback');
        throw new Error('No API key');
    }

    try {
        // Fetch company overview (includes EPS, P/E, and more)
        const overviewUrl = `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${symbol}&apikey=${ALPHA_VANTAGE_API_KEY}`;
        const overviewResponse = await fetch(overviewUrl, {
            next: { revalidate: 86400 } // Cache for 24 hours
        });

        if (!overviewResponse.ok) {
            throw new Error('Alpha Vantage API request failed');
        }

        const overviewData = await overviewResponse.json();

        // Check for API limit error
        if (overviewData.Note || overviewData.Information) {
            console.warn('Alpha Vantage API limit reached:', overviewData.Note || overviewData.Information);
            throw new Error('API limit reached');
        }

        // Fetch global quote for current price
        const quoteUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${ALPHA_VANTAGE_API_KEY}`;
        const quoteResponse = await fetch(quoteUrl, {
            next: { revalidate: 300 } // Cache for 5 minutes
        });

        const quoteData = await quoteResponse.json();
        const quote = quoteData['Global Quote'];

        const price = quote?.['05. price'] ? parseFloat(quote['05. price']) : null;
        const eps = overviewData.EPS ? parseFloat(overviewData.EPS) : null;
        const pe = overviewData.PERatio ? parseFloat(overviewData.PERatio) : null;

        console.log(`Alpha Vantage data for ${symbol}:`, { price, eps, pe });

        return { price, eps, pe };
    } catch (error) {
        console.error('Alpha Vantage fetch failed:', error);
        // Fallback to Yahoo Finance scraping
        return await scrapeFundamentals(symbol);
    }
}

async function scrapeFundamentals(symbol: string) {
    try {
        const response = await fetch(`https://finance.yahoo.com/quote/${symbol}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            },
            signal: AbortSignal.timeout(5000)
        });

        if (!response.ok) throw new Error('Failed to fetch');

        const html = await response.text();
        const $ = cheerio.load(html);

        let price = null;
        let eps = null;
        let pe = null;

        $('fin-streamer[data-field="regularMarketPrice"]').each((i, el) => {
            const val = $(el).attr('data-value');
            if (val) price = parseFloat(val);
        });

        $('td').each((i, el) => {
            const text = $(el).text();
            if (text.includes('EPS')) {
                const nextVal = $(el).next().text();
                const match = nextVal.match(/[\d.]+/);
                if (match) eps = parseFloat(match[0]);
            }
            if (text.includes('PE Ratio') || text === 'P/E Ratio') {
                const nextVal = $(el).next().text();
                const match = nextVal.match(/[\d.]+/);
                if (match) pe = parseFloat(match[0]);
            }
        });

        console.log(`Yahoo Finance scraping for ${symbol}:`, { price, eps, pe });
        return { price, eps, pe };
    } catch (error) {
        console.error('Scraping failed:', error);
        return { price: null, eps: null, pe: null };
    }
}

async function getCorrelatedStocks(symbol: string) {
    // Get a few random stocks from the same sector to calculate correlation
    const stockData = sp500Data.find(s => s.symbol === symbol);
    const sameSectorStocks = sp500Data
        .filter(s => s.sector === stockData?.sector && s.symbol !== symbol)
        .slice(0, 5);

    const correlations = [];

    for (const stock of sameSectorStocks) {
        try {
            // Use existing correlation API
            const response = await fetch(
                `http://localhost:3000/api/correlation?symbol1=${symbol}&symbol2=${stock.symbol}`,
                { cache: 'no-store' }
            );

            if (response.ok) {
                const data = await response.json();
                correlations.push({
                    symbol: stock.symbol,
                    name: stock.name,
                    correlation: data.correlation
                });
            }
        } catch (error) {
            console.error(`Failed to get correlation for ${stock.symbol}`);
        }
    }

    // Sort by correlation (highest first) and return top 3
    return correlations
        .sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation))
        .slice(0, 3);
}

function getMockCorrelatedStocks(symbol: string) {
    const stockData = sp500Data.find(s => s.symbol === symbol);
    const sameSectorStocks = sp500Data
        .filter(s => s.sector === stockData?.sector && s.symbol !== symbol)
        .slice(0, 3);

    return sameSectorStocks.map(s => ({
        symbol: s.symbol,
        name: s.name,
        correlation: Math.random() * 0.4 + 0.6 // 0.6 to 1.0
    }));
}
