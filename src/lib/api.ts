export interface SP500Constituent {
  symbol: string;
  name: string;
  sector: string;
  subSector: string;
  headQuarter: string;
  dateFirstAdded: string;
  cik: string;
  founded: string;
}

export interface EarningsCalendarEvent {
  date: string;
  symbol: string;
  eps: number | null;
  epsEstimated: number | null;
  revenue: number | null;
  revenueEstimated: number | null;
  fiscalDateEnding: string;
  time: 'bmo' | 'amc' | 'time-not-supplied'; // Before Market Open, After Market Close
}

export interface HistoricalPrice {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  adjClose: number;
  volume: number;
  unadjustedVolume: number;
  change: number;
  changePercent: number;
  vwap: number;
  label: string;
  changeOverTime: number;
}

export class FMPClient {
  private apiKey: string;
  private baseUrl = 'https://financialmodelingprep.com/api/v3';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async fetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
    const query = new URLSearchParams({ ...params, apikey: this.apiKey });
    const url = `${this.baseUrl}${endpoint}?${query.toString()}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`FMP API Error: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }

  async getSP500Constituents(): Promise<SP500Constituent[]> {
    return this.fetch<SP500Constituent[]>('/sp500_constituent');
  }

  async getEarningsCalendar(from: string, to: string): Promise<EarningsCalendarEvent[]> {
    return this.fetch<EarningsCalendarEvent[]>('/earning_calendar', { from, to });
  }

  async getHistoricalPrice(symbol: string, from: string, to: string): Promise<{ historical: HistoricalPrice[] }> {
    return this.fetch<{ historical: HistoricalPrice[] }>(`/historical-price-full/${symbol}`, { from, to });
  }
}
