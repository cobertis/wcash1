import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface CouponAnalysis {
  productName: string;
  brandName: string;
  offerType: string;
  wCashRewards: string;
  quantity: number;
  savings: string;
  finalCost: string;
  stepByStep: string;
  expirationDate: string;
  offerCode: string;
  realDeal: boolean;
}

export class CouponAnalyzer {
  
  async analyzeWalgreensOffer(offer: any): Promise<CouponAnalysis | null> {
    try {
      console.log(`🔍 Analizando oferta: ${offer.Code} - ${offer.Name}`);
      
      // Extract key information from the offer
      const offerDetail = offer.Detail || '';
      const offerName = offer.Name || '';
      const offerDescription = offer.Description || '';
      
      // Check if this offer has W Cash rewards
      const hasWCashRewards = this.detectWCashRewards(offerDetail) || 
                              this.detectWCashRewards(offerDescription);
      
      if (!hasWCashRewards) {
        console.log(`❌ No W Cash rewards found in offer ${offer.Code}`);
        return null;
      }
      
      // Use ChatGPT to analyze the offer in detail
      const prompt = `
Analiza esta oferta REAL de Walgreens y extrae los detalles específicos:

OFERTA REAL:
Código: ${offer.Code}
Nombre: ${offerName}
Descripción: ${offerDescription}
Detalle: ${offerDetail}
Válido hasta: ${offer.EffectiveEndDate}

EJEMPLO DE ANÁLISIS CORRECTO:
- Secret Clear Gel: "Compra 4, recibe $4 W Cash rewards"
- Cálculo: 4 × $3.99 = $15.96 - $4 W Cash = $11.96 de bolsillo
- Costo final: $2.99 por producto después de W Cash

EXTRAE Y CALCULA:
1. Producto específico
2. Cantidad requerida para W Cash rewards
3. Cantidad de W Cash rewards
4. Precio estimado realista
5. Cálculo paso a paso
6. Costo final después de W Cash

Responde en JSON:
{
  "productName": "Producto específico",
  "brandName": "Marca",
  "offerType": "W Cash rewards",
  "wCashRewards": "$X W Cash al comprar X",
  "quantity": X,
  "savings": "$X.XX",
  "finalCost": "$X.XX por producto",
  "stepByStep": "Cálculo detallado",
  "expirationDate": "Fecha de vencimiento",
  "offerCode": "Código de oferta",
  "realDeal": true
}

IMPORTANTE: Solo analiza si hay W Cash rewards claros en la oferta.
`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'Eres un experto en análisis de cupones de Walgreens. Extraes información específica sobre W Cash rewards de ofertas reales.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 1000
      });

      const analysis = JSON.parse(response.choices[0].message.content || '{}');
      
      if (analysis.realDeal) {
        console.log(`✅ Análisis exitoso: ${analysis.productName} - ${analysis.wCashRewards}`);
        return analysis;
      }
      
      return null;
      
    } catch (error) {
      console.error('❌ Error analizando oferta:', error);
      return null;
    }
  }

  private detectWCashRewards(text: string): boolean {
    if (!text) return false;
    
    const lowerText = text.toLowerCase();
    return lowerText.includes('w cash') || 
           lowerText.includes('cash reward') || 
           lowerText.includes('extrabucks') || 
           lowerText.includes('earn $') ||
           lowerText.includes('bonus cash') ||
           lowerText.includes('get $') ||
           (lowerText.includes('buy') && lowerText.includes('get') && lowerText.includes('$'));
  }

  async analyzeMultipleOffers(offers: any[]): Promise<CouponAnalysis[]> {
    const analyses: CouponAnalysis[] = [];
    
    console.log(`🔍 Analizando ${offers.length} ofertas para encontrar W Cash rewards...`);
    
    for (const offer of offers) {
      const analysis = await this.analyzeWalgreensOffer(offer);
      if (analysis) {
        analyses.push(analysis);
      }
    }
    
    console.log(`✅ Encontradas ${analyses.length} ofertas con W Cash rewards`);
    return analyses;
  }

  async findBestDeals(offers: any[]): Promise<CouponAnalysis[]> {
    const analyses = await this.analyzeMultipleOffers(offers);
    
    // Sort by best value (highest savings relative to cost)
    return analyses.sort((a, b) => {
      const aSavings = parseFloat(a.savings.replace('$', ''));
      const bSavings = parseFloat(b.savings.replace('$', ''));
      return bSavings - aSavings;
    });
  }
}

export const couponAnalyzer = new CouponAnalyzer();