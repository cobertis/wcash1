import { walgreensAPI } from './walgreens';

export interface DealAnalysis {
  productName: string;
  productUrl: string;
  originalPrice: number;
  finalCost: number;
  totalSavings: number;
  savingsPercentage: number;
  promotions: PromotionStack[];
  netResult: 'GANANCIA' | 'CASI_GRATIS' | 'BUEN_DEAL' | 'REGULAR';
  profitAmount?: number;
}

export interface PromotionStack {
  type: 'COUPON' | 'SALE' | 'CATALINA' | 'WCASH' | 'BOGO' | 'EXTRA_DISCOUNT';
  description: string;
  value: number;
  isStackable: boolean;
}

export class DealOptimizer {
  
  async findBestDeals(encLoyaltyId: string, searchTerm?: string): Promise<DealAnalysis[]> {
    console.log('=== BUSCANDO MEJORES DEALS CON COMBINACIÓN DE PROMOCIONES ===');
    
    try {
      // 1. Obtener todas las ofertas disponibles
      const allOffers = await this.getAllAvailableOffers(encLoyaltyId);
      console.log(`Analizando ${allOffers.length} ofertas disponibles`);
      
      // 2. Filtrar por término de búsqueda si se proporciona
      const filteredOffers = searchTerm ? 
        allOffers.filter(offer => 
          offer.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          offer.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (offer.brandName && offer.brandName.toLowerCase().includes(searchTerm.toLowerCase()))
        ) : allOffers;
      
      console.log(`Ofertas filtradas: ${filteredOffers.length}`);
      
      // 3. Analizar cada oferta para encontrar combinaciones
      const dealAnalyses: DealAnalysis[] = [];
      
      for (const offer of filteredOffers.slice(0, 20)) { // Limitar a 20 para performance
        try {
          const analysis = await this.analyzeOfferForBestDeal(offer, allOffers);
          if (analysis) {
            dealAnalyses.push(analysis);
          }
        } catch (error) {
          console.error(`Error analyzing offer ${offer.offerId}:`, error);
        }
      }
      
      // 4. Ordenar por mejor deal (menor costo final, mayor ganancia)
      return dealAnalyses
        .sort((a, b) => {
          // Priorizar ganancias
          if (a.netResult === 'GANANCIA' && b.netResult !== 'GANANCIA') return -1;
          if (b.netResult === 'GANANCIA' && a.netResult !== 'GANANCIA') return 1;
          
          // Luego por costo final más bajo
          return a.finalCost - b.finalCost;
        })
        .slice(0, 10); // Top 10 deals
      
    } catch (error) {
      console.error('Error finding best deals:', error);
      return [];
    }
  }
  
  private async getAllAvailableOffers(encLoyaltyId: string): Promise<any[]> {
    try {
      const response = await walgreensAPI.fetchOffers(encLoyaltyId, { size: 1000 });
      return response.offers || [];
    } catch (error) {
      console.error('Error fetching offers:', error);
      return [];
    }
  }
  
  private async analyzeOfferForBestDeal(offer: any, allOffers: any[]): Promise<DealAnalysis | null> {
    try {
      // Extraer información básica del producto
      const productInfo = this.extractProductInfo(offer);
      if (!productInfo.estimatedPrice) return null;
      
      // Buscar todas las promociones aplicables
      const promotionStack = this.buildPromotionStack(offer, allOffers);
      
      // Calcular costo final
      const calculations = this.calculateFinalCost(productInfo.estimatedPrice, promotionStack);
      
      // Determinar tipo de deal
      const netResult = this.determineNetResult(calculations.finalCost, calculations.totalSavings);
      
      return {
        productName: productInfo.name,
        productUrl: productInfo.url,
        originalPrice: productInfo.estimatedPrice,
        finalCost: calculations.finalCost,
        totalSavings: calculations.totalSavings,
        savingsPercentage: calculations.savingsPercentage,
        promotions: promotionStack,
        netResult,
        profitAmount: calculations.finalCost < 0 ? Math.abs(calculations.finalCost) : undefined
      };
      
    } catch (error) {
      console.error('Error analyzing offer:', error);
      return null;
    }
  }
  
  private extractProductInfo(offer: any): any {
    const name = offer.title || offer.brandName || 'Producto';
    const description = offer.description || '';
    
    // Estimar precio basado en la descripción del cupón
    const estimatedPrice = this.estimateProductPrice(name, description, offer.summary);
    
    return {
      name,
      url: `https://www.walgreens.com/search/results.jsp?Ntt=${encodeURIComponent(name)}`,
      estimatedPrice
    };
  }
  
  private estimateProductPrice(name: string, description: string, summary: string): number {
    // Patrones de precios comunes en ofertas
    const text = `${name} ${description} ${summary}`.toLowerCase();
    
    // Extraer precio del cupón si está disponible
    const priceMatch = summary.match(/\$(\d+(?:\.\d{2})?)/);
    if (priceMatch) {
      const couponValue = parseFloat(priceMatch[1]);
      // Estimar precio original basado en valor del cupón
      if (couponValue >= 10) return couponValue * 1.5;
      if (couponValue >= 5) return couponValue * 2;
      if (couponValue >= 2) return couponValue * 2.5;
      return couponValue * 3;
    }
    
    // Categorías de precios estimados basados en datos reales
    if (text.includes('toothpaste') || text.includes('dental') || text.includes('scope') || text.includes('mouthwash')) {
      return 4.99; // Precio promedio productos dentales
    }
    
    if (text.includes('crest') || text.includes('oral-b')) {
      return 6.49; // Precio específico para Crest Scope
    }
    
    if (text.includes('shampoo') || text.includes('conditioner') || text.includes('hair')) {
      return 6.99; // Precio promedio productos cabello
    }
    
    if (text.includes('soap') || text.includes('body wash') || text.includes('dove')) {
      return 5.99; // Precio promedio productos cuerpo
    }
    
    if (text.includes('vitamin') || text.includes('supplement')) {
      return 12.99; // Precio promedio vitaminas
    }
    
    if (text.includes('medicine') || text.includes('pain') || text.includes('cold')) {
      return 8.99; // Precio promedio medicamentos
    }
    
    if (text.includes('baby') || text.includes('diaper') || text.includes('infant')) {
      return 11.99; // Precio promedio productos bebé
    }
    
    return 5.99; // Precio promedio por defecto
  }
  
  private buildPromotionStack(offer: any, allOffers: any[]): PromotionStack[] {
    const promotions: PromotionStack[] = [];
    
    // 1. Cupón principal
    const couponValue = this.extractCouponValue(offer.summary);
    if (couponValue > 0) {
      promotions.push({
        type: 'COUPON',
        description: `Cupón ${offer.summary}`,
        value: couponValue,
        isStackable: true
      });
    }
    
    // 2. Buscar promociones adicionales stackables
    const additionalPromotions = this.findAdditionalPromotions(offer, allOffers);
    promotions.push(...additionalPromotions);
    
    // 3. Buscar catalinas/rewards potenciales
    const catalinas = this.findPotentialCatalinas(offer);
    promotions.push(...catalinas);
    
    return promotions;
  }
  
  private extractCouponValue(summary: string): number {
    if (!summary) return 0;
    
    const match = summary.match(/\$(\d+(?:\.\d{2})?)/);
    return match ? parseFloat(match[1]) : 0;
  }
  
  private findAdditionalPromotions(offer: any, allOffers: any[]): PromotionStack[] {
    const promotions: PromotionStack[] = [];
    
    // Buscar ofertas BOGO relacionadas
    const bogoOffers = allOffers.filter(o => 
      o.offerId !== offer.offerId &&
      (o.summary.toLowerCase().includes('bogo') || 
       o.summary.toLowerCase().includes('buy 1 get 1') ||
       o.summary.toLowerCase().includes('50% off'))
    );
    
    for (const bogo of bogoOffers) {
      if (this.areOffersCompatible(offer, bogo)) {
        promotions.push({
          type: 'BOGO',
          description: `BOGO: ${bogo.summary}`,
          value: this.calculateBOGOValue(bogo),
          isStackable: true
        });
      }
    }
    
    // Buscar descuentos extra por categoría
    const extraDiscounts = this.findExtraDiscounts(offer);
    promotions.push(...extraDiscounts);
    
    return promotions;
  }
  
  private findPotentialCatalinas(offer: any): PromotionStack[] {
    const catalinas: PromotionStack[] = [];
    
    // Patrones comunes de catalinas
    const description = `${offer.title} ${offer.description}`.toLowerCase();
    
    // Catalinas comunes por categoría
    if (description.includes('dove') || description.includes('unilever')) {
      catalinas.push({
        type: 'CATALINA',
        description: 'Spend $15 get $5 W Cash',
        value: 5,
        isStackable: true
      });
    }
    
    if (description.includes('crest') || description.includes('oral-b')) {
      catalinas.push({
        type: 'CATALINA',
        description: 'Spend $25 get $10 W Cash',
        value: 10,
        isStackable: true
      });
    }
    
    if (description.includes('vitamin') || description.includes('nature made')) {
      catalinas.push({
        type: 'CATALINA',
        description: 'Spend $30 get $10 W Cash',
        value: 10,
        isStackable: true
      });
    }
    
    return catalinas;
  }
  
  private findExtraDiscounts(offer: any): PromotionStack[] {
    const discounts: PromotionStack[] = [];
    
    // Descuentos extra comunes
    discounts.push({
      type: 'EXTRA_DISCOUNT',
      description: 'Extra 10% off con myWalgreens',
      value: 0.10, // 10% como decimal
      isStackable: true
    });
    
    return discounts;
  }
  
  private areOffersCompatible(offer1: any, offer2: any): boolean {
    // Lógica para determinar si dos ofertas son compatibles
    const brand1 = offer1.brandName || offer1.title;
    const brand2 = offer2.brandName || offer2.title;
    
    // Ofertas de la misma marca generalmente son compatibles
    return brand1.toLowerCase().includes(brand2.toLowerCase()) ||
           brand2.toLowerCase().includes(brand1.toLowerCase());
  }
  
  private calculateBOGOValue(offer: any): number {
    const estimatedPrice = this.estimateProductPrice(offer.title, offer.description, offer.summary);
    
    if (offer.summary.toLowerCase().includes('50%')) {
      return estimatedPrice * 0.5;
    }
    
    return estimatedPrice; // BOGO free
  }
  
  private calculateFinalCost(originalPrice: number, promotions: PromotionStack[]): any {
    let finalCost = originalPrice;
    let totalSavings = 0;
    
    // Separar promociones por tipo para aplicar en orden correcto
    const coupons = promotions.filter(p => p.type === 'COUPON');
    const sales = promotions.filter(p => p.type === 'SALE');
    const bogos = promotions.filter(p => p.type === 'BOGO');
    const extraDiscounts = promotions.filter(p => p.type === 'EXTRA_DISCOUNT');
    const catalinas = promotions.filter(p => p.type === 'CATALINA' || p.type === 'WCASH');
    
    // 1. Aplicar descuentos de cupones primero
    for (const coupon of coupons) {
      const savings = Math.min(coupon.value, finalCost);
      finalCost -= savings;
      totalSavings += savings;
    }
    
    // 2. Aplicar descuentos de venta
    for (const sale of sales) {
      const savings = Math.min(sale.value, finalCost);
      finalCost -= savings;
      totalSavings += savings;
    }
    
    // 3. Aplicar BOGO deals
    for (const bogo of bogos) {
      const savings = Math.min(bogo.value, finalCost);
      finalCost -= savings;
      totalSavings += savings;
    }
    
    // 4. Aplicar descuentos extra (porcentajes)
    for (const discount of extraDiscounts) {
      const savings = finalCost * discount.value;
      finalCost -= savings;
      totalSavings += savings;
    }
    
    // 5. Aplicar catalinas y W Cash (estos son rewards que actúan como crédito)
    for (const catalina of catalinas) {
      const savings = Math.min(catalina.value, finalCost);
      finalCost -= savings;
      totalSavings += savings;
    }
    
    return {
      finalCost: Math.max(0, finalCost),
      totalSavings,
      savingsPercentage: originalPrice > 0 ? ((totalSavings / originalPrice) * 100) : 0,
      netProfit: finalCost < 0 ? Math.abs(finalCost) : 0
    };
  }
  
  private determineNetResult(finalCost: number, totalSavings: number): DealAnalysis['netResult'] {
    if (finalCost <= 0) return 'GANANCIA';
    if (finalCost <= 1) return 'CASI_GRATIS';
    if (totalSavings >= finalCost) return 'BUEN_DEAL';
    return 'REGULAR';
  }
}

export const dealOptimizer = new DealOptimizer();