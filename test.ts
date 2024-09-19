import { MarketMakingBot } from './market-making-bot';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('MarketMakingBot', () => {
  let bot: MarketMakingBot;
  let mockLogger: jest.Mock;

  beforeEach(() => {
    mockLogger = jest.fn();
    bot = new MarketMakingBot('ethereum', mockLogger);
  });

  it('should initialize with correct balance', () => {
    expect(bot.getBalance()).toEqual({ ETH: 10, USD: 2000 });
  });

  it('should place orders correctly', () => {
    const marketData = { currentPrice: 2000, high24h: 2100, low24h: 1900 };
    bot.placeNewOrders(marketData);
    expect(bot.getOrders().length).toBe(10);
  });

  it('should fill BID orders correctly', () => {
    const order = { id: 1, side: 'BID' as const, price: 1950, amount: 1 };
    bot.addOrder(order);
    const marketData = { currentPrice: 1940, high24h: 2100, low24h: 1900 };
    bot.updateFilledOrders(marketData);
    expect(bot.getOrders().length).toBe(0);
    expect(bot.getBalance()).toEqual({ ETH: 11, USD: 50 });
  });

  it('should fill ASK orders correctly', () => {
    const order = { id: 1, side: 'ASK' as const, price: 2050, amount: 1 };
    bot.addOrder(order);
    const marketData = { currentPrice: 2060, high24h: 2100, low24h: 1900 };
    bot.updateFilledOrders(marketData);
    expect(bot.getOrders().length).toBe(0);
    expect(bot.getBalance()).toEqual({ ETH: 9, USD: 4050 });
  });

  it('should not fill orders when price conditions are not met', () => {
    const bidOrder = { id: 1, side: 'BID' as const, price: 1950, amount: 1 };
    const askOrder = { id: 2, side: 'ASK' as const, price: 2050, amount: 1 };
    bot.addOrder(bidOrder);
    bot.addOrder(askOrder);
    const marketData = { currentPrice: 2000, high24h: 2100, low24h: 1900 };
    bot.updateFilledOrders(marketData);
    expect(bot.getOrders().length).toBe(2);
    expect(bot.getBalance()).toEqual({ ETH: 10, USD: 2000 });
  });  

  it('should update balance after filling orders', () => {
    const initialBalance = bot.getBalance();
    const order = { id: 1, side: 'ASK' as const, price: 2050, amount: 1 };
    bot.addOrder(order);
    const marketData = { currentPrice: 2060, high24h: 2100, low24h: 1900 };
    bot.updateFilledOrders(marketData);
    const newBalance = bot.getBalance();
    expect(newBalance.ETH).toBe(initialBalance.ETH - 1);
    expect(newBalance.USD).toBe(initialBalance.USD + 2050);
  });

  it('should log messages correctly', () => {
    const marketData = { currentPrice: 2000, high24h: 2100, low24h: 1900 };
    bot.placeNewOrders(marketData);
    expect(mockLogger).toHaveBeenCalledTimes(10); // 10 calls for placing 10 orders
  });

  it('should handle market data fetching', async () => {
    const mockMarketData = {
      market_data: {
        current_price: { usd: 2000 },
        high_24h: { usd: 2100 },
        low_24h: { usd: 1900 }
      }
    };
    mockedAxios.get.mockResolvedValue({ data: mockMarketData });

    await bot.fetchMarketData();

    expect(mockedAxios.get).toHaveBeenCalledWith(
      'https://api.coingecko.com/api/v3/coins/ethereum',
      expect.any(Object)
    );
  });
});