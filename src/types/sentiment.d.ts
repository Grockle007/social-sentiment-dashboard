declare module 'sentiment' {
    interface SentimentResult {
        score: number;
        comparative: number;
        tokens: string[];
        words: string[];
        positive: string[];
        negative: string[];
    }

    interface SentimentOptions {
        extras?: { [key: string]: number };
    }

    class Sentiment {
        analyze(text: string, options?: SentimentOptions): SentimentResult;
    }

    export = Sentiment;
}
