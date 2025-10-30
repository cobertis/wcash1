import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface SmartCouponDeal {
  couponDetails: {
    brandName: string;
    requirement: string;
    reward: string;
    expiration: string;
    restrictions: string;
  };
  recommendedProducts: {
    productName: string;
    regularPrice: string;
    digitalCoupon: string;
    finalPrice: string;
  }[];
  transactionBreakdown: {
    totalBeforeCoupons: string;
    digitalCouponsApplied: string;
    subtotalAfterCoupons: string;
    amountPaidOutOfPocket: string;
    wCashRewardReceived: string;
    finalNetCost: string;
    costPerUnit: string;
  };
  nextTransaction: {
    description: string;
    useWCashFrom: string;
    potentialSavings: string;
  };
  optimizationTips: string[];
}

export class SmartCouponAnalyzer {
  
  async analyzeSpecificCoupon(couponData: any): Promise<SmartCouponDeal> {
    try {
      console.log('🎯 Analizando cupón específico para crear oferta detallada...');
      
      const prompt = `
Eres un experto en cupones extremos de Walgreens. Analiza este cupón REAL y crea una oferta detallada siguiendo el ejemplo exitoso:

EJEMPLO DE ANÁLISIS EXITOSO:
- Cupón: "Compra 3+ productos Always/Tampax/L. → Recibe $10 Walgreens Cash"
- Productos recomendados: Tampax 18-20 ct ($8.29), Always Discreet Pads ($8.29), Always Liners 120ct ($7.49)
- Con cupones digitales: -$3 Tampax, -$3 Always Discreet, -$2 Always Liners
- Total: $24.07 - $8 cupones = $16.07 de bolsillo
- Recibes: $10 W Cash
- Costo real: $6.07 ($2.02 por unidad)

CUPÓN A ANALIZAR:
${JSON.stringify(couponData, null, 2)}

CREA UNA OFERTA DETALLADA CON:
1. Análisis del cupón específico
2. Productos recomendados con precios realistas de Walgreens
3. Cupones digitales disponibles para cada producto
4. Cálculo paso a paso completo
5. Costo final después de W Cash rewards
6. Próxima transacción usando el W Cash ganado
7. Tips de optimización

FORMATO JSON OBLIGATORIO:
{
  "couponDetails": {
    "brandName": "Marca específica",
    "requirement": "Compra X productos",
    "reward": "$X W Cash rewards",
    "expiration": "Fecha",
    "restrictions": "Restricciones específicas"
  },
  "recommendedProducts": [
    {
      "productName": "Producto específico real",
      "regularPrice": "$X.XX",
      "digitalCoupon": "-$X cupón digital",
      "finalPrice": "$X.XX"
    }
  ],
  "transactionBreakdown": {
    "totalBeforeCoupons": "$XX.XX",
    "digitalCouponsApplied": "-$X.XX",
    "subtotalAfterCoupons": "$XX.XX",
    "amountPaidOutOfPocket": "$XX.XX",
    "wCashRewardReceived": "$XX.XX",
    "finalNetCost": "$XX.XX",
    "costPerUnit": "$X.XX cada uno"
  },
  "nextTransaction": {
    "description": "Cómo usar el W Cash ganado",
    "useWCashFrom": "$XX W Cash de transacción anterior",
    "potentialSavings": "Productos casi gratis o con ganancia"
  },
  "optimizationTips": [
    "Tip específico 1",
    "Tip específico 2",
    "Tip específico 3"
  ]
}

IMPORTANTE: Usa precios realistas de Walgreens y cupones digitales que realmente existen.
`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4o', // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: 'system',
            content: 'Eres un experto en cupones extremos de Walgreens. Creas ofertas detalladas paso a paso que resulten en productos casi gratis o con ganancia. Respondes en español.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 2000
      });

      const analysis = JSON.parse(response.choices[0].message.content || '{}');
      
      console.log('✅ Análisis detallado completado para cupón específico');
      return analysis;
      
    } catch (error) {
      console.error('❌ Error analizando cupón específico:', error);
      throw error;
    }
  }

  async analyzeWalgreensOfferForSmartDeal(offer: any): Promise<SmartCouponDeal> {
    try {
      console.log(`🎯 Creando oferta inteligente para: ${offer.Code} - ${offer.Name}`);
      
      const couponData = {
        code: offer.Code,
        name: offer.Name,
        description: offer.Description,
        detail: offer.Detail,
        expiration: offer.EffectiveEndDate,
        brand: offer.Name?.split(' ')[0] || 'Producto'
      };
      
      return await this.analyzeSpecificCoupon(couponData);
      
    } catch (error) {
      console.error('❌ Error creando oferta inteligente:', error);
      throw error;
    }
  }

  async createMultipleSmartDeals(offers: any[]): Promise<SmartCouponDeal[]> {
    const smartDeals: SmartCouponDeal[] = [];
    
    console.log(`🎯 Creando ofertas inteligentes para ${offers.length} cupones...`);
    
    for (const offer of offers.slice(0, 10)) { // Limit to 10 to avoid rate limits
      try {
        const smartDeal = await this.analyzeWalgreensOfferForSmartDeal(offer);
        smartDeals.push(smartDeal);
        
        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`❌ Error procesando oferta ${offer.Code}:`, error);
      }
    }
    
    console.log(`✅ Creadas ${smartDeals.length} ofertas inteligentes`);
    return smartDeals;
  }
}

export const smartCouponAnalyzer = new SmartCouponAnalyzer();