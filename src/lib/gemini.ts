// Gemini API integration for stock fundamentals
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent';

interface GeminiStockData {
    price: number | null;
    eps: number | null;
    pe: number | null;
    correlatedStocks: {
        symbol: string;
        name: string;
        correlation: number;
    }[];
}

export async function getStockDataFromGemini(symbol: string): Promise<GeminiStockData> {
    if (!GEMINI_API_KEY) {
        console.warn('Gemini API key not found');
        throw new Error('No Gemini API key');
    }

    try {
        const prompt = `Get the latest stock data for ${symbol}. Provide ONLY the following in JSON format:
{
  "price": current stock price as a number,
  "eps": earnings per share as a number,
  "pe": price to earnings ratio as a number,
  "correlatedStocks": [
    {
      "symbol": "TICKER",
      "name": "Company Name",
      "correlation": number between 0.5 and 1.0 representing correlation strength
    }
  ]
}

For correlated stocks, identify 3 major companies that are highly correlated with ${symbol} based on sector, market movements, and business model.
If any value is not available, use null. Return ONLY valid JSON, no other text.`;

        const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }],
                generationConfig: {
                    temperature: 0.1,
                    topK: 1,
                    topP: 1,
                    maxOutputTokens: 1024,
                }
            })
        });

        if (!response.ok) {
            throw new Error(`Gemini API error: ${response.status}`);
        }

        const data = await response.json();
        const text = data.candidates[0].content.parts[0].text;

        // Extract JSON from response (Gemini might wrap it in markdown)
        const maxRetries = 3;
        const retryDelayMs = 1000; // 1 second

        for (let i = 0; i < maxRetries; i++) {
            const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: prompt
                        }]
                    }],
                    generationConfig: {
                        temperature: 0.1,
                        topK: 1,
                        topP: 1,
                        maxOutputTokens: 1024,
                    }
                })
            });

            if (response.status === 429 && i < maxRetries - 1) {
                console.warn(`Gemini API rate limit hit (429). Retrying in ${retryDelayMs / 1000}s... (Attempt ${i + 1}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, retryDelayMs));
                continue; // Retry the request
            }

            if (!response.ok) {
                throw new Error(`Gemini API error: ${response.status} - ${response.statusText}`);
            }

            const data = await response.json();
            const text = data.candidates[0].content.parts[0].text;

            // Extract JSON from response (Gemini might wrap it in markdown)
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON found in Gemini response');
            }

            const stockData = JSON.parse(jsonMatch[0]);

            console.log(`Gemini data for ${symbol}:`, stockData);

            return {
                price: stockData.price,
                eps: stockData.eps,
                pe: stockData.pe,
                correlatedStocks: stockData.correlatedStocks || []
            };
        }
        // If the loop finishes without returning, it means all retries failed
        throw new Error(`Gemini API request failed after ${maxRetries} attempts.`);

    } catch (error) {
        console.error('Gemini API failed:', error);
        throw error;
    }
}
