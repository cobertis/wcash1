import { parse } from 'node-html-parser';

export class WalgreensProductScraper {
  
  async getProductInfo(productUrl: string): Promise<any> {
    try {
      console.log('Fetching product info from:', productUrl);
      
      const response = await fetch(productUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const html = await response.text();
      const root = parse(html);
      
      // Extract product information
      const productInfo = {
        title: '',
        price: '',
        wcashRewards: [],
        promotions: [],
        availability: '',
        details: []
      };

      // Extract title
      const titleElement = root.querySelector('h1[data-automation-id="product-title"]') || 
                          root.querySelector('.product-title') ||
                          root.querySelector('h1');
      if (titleElement) {
        productInfo.title = titleElement.text.trim();
      }

      // Extract price
      const priceElement = root.querySelector('[data-automation-id="product-price"]') ||
                          root.querySelector('.price') ||
                          root.querySelector('.product-price');
      if (priceElement) {
        productInfo.price = priceElement.text.trim();
      }

      // Extract W Cash rewards
      const wcashElements = root.querySelectorAll('[data-automation-id*="wcash"], [class*="wcash"], [class*="reward"]');
      wcashElements.forEach(el => {
        const text = el.text.trim();
        if (text && text.includes('Cash')) {
          productInfo.wcashRewards.push(text);
        }
      });

      // Extract promotions
      const promoElements = root.querySelectorAll('[data-automation-id*="promo"], [class*="promo"], [class*="offer"]');
      promoElements.forEach(el => {
        const text = el.text.trim();
        if (text && text.length > 0) {
          productInfo.promotions.push(text);
        }
      });

      // Extract availability
      const availabilityElement = root.querySelector('[data-automation-id="availability"]') ||
                                root.querySelector('.availability') ||
                                root.querySelector('.stock-status');
      if (availabilityElement) {
        productInfo.availability = availabilityElement.text.trim();
      }

      // Look for any text containing cash rewards or promotions
      const bodyText = root.text;
      const cashMatches = bodyText.match(/\$\d+\.?\d*\s*W\s*Cash/gi) || [];
      const promoMatches = bodyText.match(/Buy\s+\d+[^.]*get[^.]*\$\d+/gi) || [];
      
      productInfo.wcashRewards = [...productInfo.wcashRewards, ...cashMatches];
      productInfo.promotions = [...productInfo.promotions, ...promoMatches];

      // Remove duplicates
      productInfo.wcashRewards = [...new Set(productInfo.wcashRewards)];
      productInfo.promotions = [...new Set(productInfo.promotions)];

      console.log('Extracted product info:', productInfo);
      return productInfo;

    } catch (error) {
      console.error('Error fetching product info:', error);
      return null;
    }
  }

  async searchProducts(query: string): Promise<any> {
    try {
      const searchUrl = `https://www.walgreens.com/search/results.jsp?Ntt=${encodeURIComponent(query)}`;
      console.log('Searching products:', searchUrl);
      
      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Connection': 'keep-alive'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const html = await response.text();
      const root = parse(html);
      
      const products = [];
      
      // Extract product cards
      const productCards = root.querySelectorAll('[data-automation-id="product-card"], .product-card, .product-item');
      
      productCards.forEach(card => {
        const product = {
          title: '',
          price: '',
          wcashReward: '',
          promotion: '',
          link: ''
        };

        // Extract title
        const titleEl = card.querySelector('[data-automation-id="product-title"], .product-title, h3, h4');
        if (titleEl) {
          product.title = titleEl.text.trim();
        }

        // Extract price
        const priceEl = card.querySelector('[data-automation-id="product-price"], .price, .product-price');
        if (priceEl) {
          product.price = priceEl.text.trim();
        }

        // Extract W Cash reward
        const wcashEl = card.querySelector('[data-automation-id*="wcash"], [class*="wcash"], [class*="reward"]');
        if (wcashEl) {
          product.wcashReward = wcashEl.text.trim();
        }

        // Extract promotion
        const promoEl = card.querySelector('[data-automation-id*="promo"], [class*="promo"], [class*="offer"]');
        if (promoEl) {
          product.promotion = promoEl.text.trim();
        }

        // Extract link
        const linkEl = card.querySelector('a[href*="/store/c/"]');
        if (linkEl) {
          product.link = linkEl.getAttribute('href');
        }

        if (product.title) {
          products.push(product);
        }
      });

      console.log(`Found ${products.length} products for query: ${query}`);
      return products.slice(0, 5); // Return top 5 products

    } catch (error) {
      console.error('Error searching products:', error);
      return [];
    }
  }
}

export const productScraper = new WalgreensProductScraper();