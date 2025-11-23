import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import sp500Data from '@/lib/sp500.json';
import { getStockDataFromGemini } from '@/lib/gemini';

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
        // Try Gemini API first (free, AI-powered, real-time)
        let fundamentals;
        let correlatedStocks = [];

        try {
            const geminiData = await getStockDataFromGemini(symbol);
            console.log(`Using Gemini data for ${symbol}`);
            fundamentals = {
                price: geminiData.price,
                eps: geminiData.eps,
                pe: geminiData.pe
            };
            correlatedStocks = geminiData.correlatedStocks;
        } catch (geminiError) {
            console.error(`Gemini failed for ${symbol}:`, geminiError);
            throw geminiError;
        }

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

        return NextResponse.json({ error: 'Failed to fetch stock data from Gemini' }, { status: 500 });
    }
}




