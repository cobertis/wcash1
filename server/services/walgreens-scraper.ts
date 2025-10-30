import { parse } from 'node-html-parser';

export interface WalgreensProductInfo {
  productName: string;
  regularPrice: string;
  salePrice?: string;
  promotions: string[];
  rewards: string[];
  availability: 'IN_STOCK' | 'OUT_OF_STOCK' | 'LIMITED';
  productUrl: string;
  bogo?: {
    type: 'BOGO' | 'BOGO_50' | 'BOGO_FREE';
    description: string;
  };
  wCashRewards?: {
    amount: string;
    description: string;
  };
}

export class WalgreensScraperService {
  private readonly baseUrl = 'https://www.walgreens.com';
  private readonly searchUrl = 'https://www.walgreens.com/search/results.jsp';

  async searchProduct(productName: string): Promise<WalgreensProductInfo[]> {
    try {
      const searchParams = new URLSearchParams({
        Ntt: productName,
        Nrpp: '10',
        Nso: '0'
      });

      const response = await fetch(`${this.searchUrl}?${searchParams}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const html = await response.text();
      const document = parse(html);

      return this.parseSearchResults(document);
    } catch (error) {
      console.error('Error searching Walgreens products:', error);
      return [];
    }
  }

  async getProductDetails(productUrl: string): Promise<WalgreensProductInfo | null> {
    try {
      const response = await fetch(productUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const html = await response.text();
      const document = parse(html);

      return this.parseProductDetails(document, productUrl);
    } catch (error) {
      console.error('Error fetching product details:', error);
      return null;
    }
  }

  private parseSearchResults(document: any): WalgreensProductInfo[] {
    const products: WalgreensProductInfo[] = [];
    
    // Parse search result items
    const productElements = document.querySelectorAll('.product-item, .search-product-item, .product-card');
    
    productElements.forEach((element: any) => {
      try {
        const productInfo = this.extractProductInfo(element);
        if (productInfo) {
          products.push(productInfo);
        }
      } catch (error) {
        console.error('Error parsing product element:', error);
      }
    });

    return products;
  }

  private parseProductDetails(document: any, productUrl: string): WalgreensProductInfo | null {
    try {
      const productNameElement = document.querySelector('h1.product-title, .product-name, .pdp-product-name');
      const productName = productNameElement?.text?.trim() || 'Producto no encontrado';

      const regularPriceElement = document.querySelector('.price-regular, .regular-price, .price-original');
      const salePriceElement = document.querySelector('.price-sale, .sale-price, .price-current');
      
      const regularPrice = regularPriceElement?.text?.trim()?.replace(/[^\d.,]/g, '') || '';
      const salePrice = salePriceElement?.text?.trim()?.replace(/[^\d.,]/g, '') || '';

      // Look for BOGO promotions
      const bogoElements = document.querySelectorAll('.promotion, .promo-text, .offer-text');
      const promotions: string[] = [];
      let bogo: any = null;
      
      bogoElements.forEach((element: any) => {
        const text = element.text?.toLowerCase() || '';
        if (text.includes('buy') && text.includes('get')) {
          promotions.push(element.text?.trim());
          if (text.includes('50%')) {
            bogo = {
              type: 'BOGO_50',
              description: element.text?.trim()
            };
          } else if (text.includes('free')) {
            bogo = {
              type: 'BOGO_FREE',
              description: element.text?.trim()
            };
          } else {
            bogo = {
              type: 'BOGO',
              description: element.text?.trim()
            };
          }
        }
      });

      // Look for W Cash rewards
      const rewardElements = document.querySelectorAll('.reward, .wcash, .points, .earn');
      const rewards: string[] = [];
      let wCashRewards: any = null;
      
      rewardElements.forEach((element: any) => {
        const text = element.text?.trim() || '';
        rewards.push(text);
        if (text.toLowerCase().includes('cash') || text.includes('$')) {
          wCashRewards = {
            amount: text.match(/\$[\d.]+/)?.[0] || text,
            description: text
          };
        }
      });

      // Check availability
      const stockElement = document.querySelector('.stock-status, .availability, .in-stock');
      const availability = stockElement?.text?.toLowerCase().includes('out') ? 'OUT_OF_STOCK' : 'IN_STOCK';

      return {
        productName,
        regularPrice: regularPrice ? `$${regularPrice}` : 'Precio no disponible',
        salePrice: salePrice ? `$${salePrice}` : undefined,
        promotions,
        rewards,
        availability,
        productUrl,
        bogo,
        wCashRewards
      };
    } catch (error) {
      console.error('Error parsing product details:', error);
      return null;
    }
  }

  private extractProductInfo(element: any): WalgreensProductInfo | null {
    try {
      const productNameElement = element.querySelector('.product-title, .product-name, .item-name');
      const productName = productNameElement?.text?.trim() || '';

      const priceElement = element.querySelector('.price, .product-price, .item-price');
      const regularPrice = priceElement?.text?.trim()?.replace(/[^\d.,]/g, '') || '';

      const linkElement = element.querySelector('a[href*="/store/c/"]');
      const productUrl = linkElement?.getAttribute('href') || '';

      if (!productName || !productUrl) {
        return null;
      }

      return {
        productName,
        regularPrice: regularPrice ? `$${regularPrice}` : 'Precio no disponible',
        promotions: [],
        rewards: [],
        availability: 'IN_STOCK',
        productUrl: productUrl.startsWith('http') ? productUrl : `${this.baseUrl}${productUrl}`
      };
    } catch (error) {
      console.error('Error extracting product info:', error);
      return null;
    }
  }

  // Método para generar enlaces directos de productos basados en nombres
  generateProductSearchUrl(productName: string): string {
    const searchParams = new URLSearchParams({
      Ntt: productName,
      Nrpp: '10',
      Nso: '0'
    });
    return `${this.searchUrl}?${searchParams}`;
  }

  // Método para extraer información de promociones específicas
  async verifyPromotion(productName: string): Promise<{
    hasPromotion: boolean;
    promotionType: string;
    promotionDetails: string;
    verifiedPrice: string;
    verifiedRewards: string;
  }> {
    try {
      const products = await this.searchProduct(productName);
      
      if (products.length === 0) {
        return {
          hasPromotion: false,
          promotionType: 'NONE',
          promotionDetails: 'Producto no encontrado',
          verifiedPrice: 'No disponible',
          verifiedRewards: 'No disponible'
        };
      }

      const product = products[0];
      const detailedProduct = await this.getProductDetails(product.productUrl);
      
      if (!detailedProduct) {
        return {
          hasPromotion: false,
          promotionType: 'NONE',
          promotionDetails: 'No se pudo obtener información detallada',
          verifiedPrice: product.regularPrice,
          verifiedRewards: 'No disponible'
        };
      }

      const hasPromotion = detailedProduct.bogo !== null || detailedProduct.promotions.length > 0;
      const promotionType = detailedProduct.bogo?.type || 'REGULAR';
      const promotionDetails = detailedProduct.bogo?.description || detailedProduct.promotions[0] || 'Sin promociones';
      const verifiedPrice = detailedProduct.salePrice || detailedProduct.regularPrice;
      const verifiedRewards = detailedProduct.wCashRewards?.description || detailedProduct.rewards[0] || 'Sin rewards';

      return {
        hasPromotion,
        promotionType,
        promotionDetails,
        verifiedPrice,
        verifiedRewards
      };
    } catch (error) {
      console.error('Error verifying promotion:', error);
      return {
        hasPromotion: false,
        promotionType: 'ERROR',
        promotionDetails: 'Error al verificar promociones',
        verifiedPrice: 'No disponible',
        verifiedRewards: 'No disponible'
      };
    }
  }
}

export const walgreensScraperService = new WalgreensScraperService();