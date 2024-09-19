import axios from 'axios';

const API_KEY = 'CG-oFVseB1bfGMvYUXX98Aig61T';
const BASE_URL = 'https://api.coingecko.com/api/v3';

interface Order {
  id: number;
  price: number;
  amount: number;
  side: 'BID' | 'ASK';
}

interface AssetBalance {
  ETH: number;
  USD: number;
}

interface MarketData {
  currentPrice: number;
  high24h: number;
  low24h: number;
}

interface CoinGeckoResponse {
  market_data: {
    current_price: { usd: number };
    high_24h: { usd: number };
    low_24h: { usd: number };
  };
}

export class MarketMakingBot {
  private orders: Order[] = [];
  private balance: AssetBalance = { ETH: 10, USD: 2000 };
  private orderId = 0;

  constructor(private symbol: string, private logger: (message: string) => void = console.log) {}

  public getBalance(): { ETH: number; USD: number } {
    return { ...this.balance };
  }

  public updateFilledOrders(marketData: MarketData): void {
    this.checkFilledOrders(marketData);
  }

  async run(): Promise<void> {
    this.logger('Market-making bot started...');
    await this.updateMarket();
    setInterval(() => this.updateMarket(), 5000);
    setInterval(() => this.showBalance(), 30000);
  }

  private async updateMarket(): Promise<void> {
    const marketData = await this.fetchMarketData();
    if (!marketData) return;

    this.logger(`Market update: Current price: $${marketData.currentPrice.toFixed(2)}, 24h High: $${marketData.high24h.toFixed(2)}, 24h Low: $${marketData.low24h.toFixed(2)}`);

    this.checkFilledOrders(marketData);
    this.placeNewOrders(marketData);

    this.logger(`Open orders: ${this.orders.length}`);
  }

  async fetchMarketData(): Promise<MarketData | null> {
    try {
      const url = `${BASE_URL}/coins/${this.symbol}`;
      const response = await axios.get(url, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'x-cg-demo-api-key': API_KEY
        },
      });
      
      const data = response.data as CoinGeckoResponse;
      
      if (!this.isValidCoinGeckoResponse(data)) {
        throw new Error('Invalid response structure from CoinGecko API');
      }
      
      return {
        currentPrice: data.market_data.current_price.usd,
        high24h: data.market_data.high_24h.usd,
        low24h: data.market_data.low_24h.usd,
      };
    } catch (error) {
      this.logger('Error fetching market data:' + error);
      return null;
    }
  }

  private isValidCoinGeckoResponse(data: any): data is CoinGeckoResponse {
    return (
      data &&
      data.market_data &&
      typeof data.market_data.current_price?.usd === 'number' &&
      typeof data.market_data.high_24h?.usd === 'number' &&
      typeof data.market_data.low_24h?.usd === 'number'
    );
  }

  private checkFilledOrders(marketData: MarketData): void {
    const { currentPrice } = marketData;
    const filledOrders: Order[] = [];
    this.orders = this.orders.filter(order => {
      if ((order.side === 'BID' && currentPrice <= order.price) ||
          (order.side === 'ASK' && currentPrice >= order.price)) {
        filledOrders.push(order);
        return false;
      }
      return true;
    });
    filledOrders.forEach(order => this.fillOrder(order));
  }

  private fillOrder(order: Order): void {
    if (order.side === 'BID') {
      this.balance.ETH += order.amount;
      this.balance.USD -= order.amount * order.price;
    } else {
      this.balance.ETH -= order.amount;
      this.balance.USD += order.amount * order.price;
    }
    this.logger(`FILLED ${order.side} @ ${order.price.toFixed(2)} ${order.amount.toFixed(4)} (ETH ${order.side === 'BID' ? '+' : '-'}${order.amount.toFixed(4)} USD ${order.side === 'BID' ? '-' : '+'}${(order.amount * order.price).toFixed(2)})`);
  }

  public placeNewOrders(marketData: MarketData): void {
    const { currentPrice, high24h, low24h } = marketData;
    const spread = (high24h - low24h) / 2;

    while (this.orders.length < 10) {
      const side: 'BID' | 'ASK' = this.orders.length % 2 === 0 ? 'BID' : 'ASK';
      const price = this.randomPrice(currentPrice, spread, side);
      const amount = this.randomAmount(side, price);
      this.placeOrder(side, price, amount);
    }
  }

  private randomPrice(currentPrice: number, spread: number, side: 'BID' | 'ASK'): number {
    const maxDiff = spread * 0.1; // 10% of the 24h spread
    const randomDiff = Math.random() * maxDiff;
    return side === 'BID' ? currentPrice - randomDiff : currentPrice + randomDiff;
  }

  private randomAmount(side: 'BID' | 'ASK', price: number): number {
    const maxUsdAmount = Math.min(this.balance.USD / 10, 1000); // Max 10% of USD balance or $1000
    const maxEthAmount = Math.min(this.balance.ETH / 10, maxUsdAmount / price); // Max 10% of ETH balance or equivalent of maxUsdAmount
    const maxAmount = side === 'BID' ? maxUsdAmount / price : maxEthAmount;
    return Math.random() * maxAmount;
  }

  private placeOrder(side: 'BID' | 'ASK', price: number, amount: number): void {
    this.orderId++;
    const order: Order = { id: this.orderId, side, price, amount };
    this.orders.push(order);
    this.logger(`PLACE ${side} @ ${price.toFixed(2)} ${amount.toFixed(4)}`);
  }

  private showBalance(): void {
    this.logger(`Current balance: ${this.balance.ETH.toFixed(4)} ETH, ${this.balance.USD.toFixed(2)} USD`);
  }

  public addOrder(order: Order): void {
    this.orders.push(order);
  }

  getOrders(): Order[] {
    return [...this.orders];
  }
}