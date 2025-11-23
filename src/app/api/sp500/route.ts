import { NextResponse } from 'next/server';
import { FMPClient } from '@/lib/api';
import sp500Data from '@/lib/sp500.json';

const FMP_API_KEY = process.env.FMP_API_KEY;

export async function GET() {
    // Fallback to local data immediately if no key, or try API and fallback on error
    if (!FMP_API_KEY) {
        console.warn("No API Key, using static S&P 500 data");
        return NextResponse.json(sp500Data);
    }

    const client = new FMPClient(FMP_API_KEY);

    try {
        const sp500 = await client.getSP500Constituents();
        return NextResponse.json(sp500);
    } catch (error: any) {
        console.error('API Error (S&P 500):', error.message);
        // Fallback to static data on API failure (e.g. 403 Legacy Endpoint)
        return NextResponse.json(sp500Data);
    }
}
