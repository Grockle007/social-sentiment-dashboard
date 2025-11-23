import { NextResponse } from 'next/server';
import { getTrendingStocks } from '@/lib/reddit';
import { sendDailyEmail } from '@/lib/email';

export async function GET(request: Request) {
    try {
        const trending = await getTrendingStocks();
        const top3 = trending.slice(0, 3);

        if (top3.length === 0) {
            return NextResponse.json({ message: "No trending stocks found to send." });
        }

        const subject = `🚀 Morning Trending Stocks: ${top3.map(s => s.symbol).join(', ')}`;

        const htmlContent = `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                <h1>🚀 Morning Trending Stocks</h1>
                <p>Here are the top stocks trending on Reddit right now:</p>
                <hr />
                ${top3.map((s, i) => `
                    <div style="margin-bottom: 20px; padding: 15px; border: 1px solid #eee; border-radius: 8px;">
                        <h2 style="margin: 0;">${i + 1}. $${s.symbol} <span style="font-size: 0.8em; color: #666;">(${s.name})</span></h2>
                        <p><strong>Mentions:</strong> ${s.mentions}</p>
                        <p><strong>Sentiment:</strong> ${s.sentiment > 0 ? '🟢 Bullish' : '🔴 Bearish'}</p>
                    </div>
                `).join('')}
                <hr />
                <p><a href="http://localhost:3000">Check the dashboard for more details!</a></p>
            </div>
        `;

        const result = await sendDailyEmail(subject, htmlContent);

        return NextResponse.json({ success: result.success, message: "Email process completed", id: result.messageId });
    } catch (error) {
        console.error("Failed to send daily summary:", error);
        return NextResponse.json({ error: "Failed to send daily summary" }, { status: 500 });
    }
}
