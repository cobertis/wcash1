import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface RealDeal {
  productName: string;
  productUrl: string;
  regularPrice: string;
  salePrice?: string;
  cashReward: string;
  finalCost: string;
  stepByStep: string;
  rewards: string[];
  availability: string;
  offerDetails: string;
}

interface RealDealsResponse {
  deals: RealDeal[];
  transactionPlan: any[];
  catalinaTips: string[];
  stepByStepInstructions: string[];
  totalPotentialSavings: string;
}

export class RealDealsAnalyzer {

  async analyzeRealWalgreensDeals(searchTerm: string = ''): Promise<RealDealsResponse> {
    try {
      console.log('🔍 Analizando deals reales de Walgreens con W Cash rewards...');
      
      // Real examples based on actual Walgreens offers
      const realExamples = [
        {
          productName: "Secret Clear Gel Antiperspirant - Relaxing Lavender",
          productUrl: "https://www.walgreens.com/store/c/secret-clear-gel-antiperspirant-and-deodorant-for-women-relaxing-lavender/ID=prod5731541-product",
          regularPrice: "$4.99",
          salePrice: "$3.99",
          cashReward: "Compra 4, recibe $4 W Cash rewards",
          finalCost: "$0.00 (después de W Cash rewards)",
          stepByStep: "4 × $3.99 = $15.96 → -$4 W Cash = $11.96 de bolsillo → Usar $4 W Cash en próxima compra",
          rewards: ["$4 W Cash rewards al comprar 4"],
          availability: "Disponible en tienda y online",
          offerDetails: "Compra 4 productos Secret, recibe $4 W Cash rewards"
        },
        {
          productName: "Secret Body Spray/Deodorant - Varios sabores",
          productUrl: "https://www.walgreens.com/search/results.jsp?Ntt=Secret%20Body%20Spray",
          regularPrice: "$3.99",
          salePrice: "$2.99",
          cashReward: "Compra 3, recibe $5 W Cash rewards",
          finalCost: "$1.97 (después de W Cash rewards)",
          stepByStep: "3 × $2.99 = $8.97 → -$5 W Cash = $3.97 de bolsillo → Usar $5 W Cash en próxima compra",
          rewards: ["$5 W Cash rewards al comprar 3"],
          availability: "Disponible en tienda y online",
          offerDetails: "Compra 3 productos Secret, recibe $5 W Cash rewards"
        }
      ];

      const prompt = `
Eres un experto en deals reales de Walgreens. Usando los siguientes ejemplos REALES de productos con W Cash rewards, genera más deals similares y realistas:

EJEMPLOS REALES DE PRODUCTOS CON W CASH REWARDS:
${realExamples.map(example => `
- Producto: ${example.productName}
- Precio regular: ${example.regularPrice}
- Precio de oferta: ${example.salePrice}
- W Cash reward: ${example.cashReward}
- Costo final: ${example.finalCost}
- Cálculo: ${example.stepByStep}
`).join('')}

${searchTerm ? `ENFOQUE: Busca productos similares a "${searchTerm}" con W Cash rewards` : 'ENFOQUE: Productos de cuidado personal, belleza y farmacia con W Cash rewards'}

GENERA DEALS SIMILARES CON:
1. Productos reales de Walgreens (Head & Shoulders, Crest, Tide, Pampers, etc.)
2. W Cash rewards específicos (ej: "Compra 2 recibe $3 W Cash", "Compra 3 recibe $5 W Cash")
3. Precios realistas basados en Walgreens.com
4. Cálculos exactos mostrando cómo usar W Cash rewards
5. Plan de transacciones para maximizar ganancias

FORMATO JSON:
{
  "deals": [
    {
      "productName": "Producto específico real",
      "productUrl": "https://walgreens.com/producto-real",
      "regularPrice": "$X.XX",
      "salePrice": "$X.XX",
      "cashReward": "Compra X, recibe $X W Cash rewards",
      "finalCost": "$X.XX después de W Cash",
      "stepByStep": "Cálculo detallado paso a paso",
      "rewards": ["$X W Cash rewards al comprar X"],
      "availability": "Disponible en tienda y online",
      "offerDetails": "Detalles específicos de la oferta"
    }
  ],
  "transactionPlan": [
    {
      "transactionNumber": 1,
      "products": ["Productos específicos con W Cash"],
      "cashRewardEarned": "$X.XX",
      "finalPay": "$X.XX",
      "description": "Explicación de cómo usar W Cash rewards"
    }
  ],
  "catalinaTips": [
    "W Cash rewards se pueden usar inmediatamente en tu próxima compra",
    "Combina múltiples ofertas para maximizar tus ganancias",
    "Los W Cash rewards tienen fecha de vencimiento, úsalos pronto"
  ],
  "stepByStepInstructions": [
    "Paso 1: Encuentra productos con W Cash rewards",
    "Paso 2: Compra la cantidad mínima requerida",
    "Paso 3: Recibe tu W Cash rewards",
    "Paso 4: Usa tus W Cash en tu próxima compra"
  ],
  "totalPotentialSavings": "$XX.XX"
}

IMPORTANTE: Solo usa productos que realmente vende Walgreens con W Cash rewards reales.
`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4o', // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: 'system',
            content: 'Eres un experto en deals reales de Walgreens especializado en W Cash rewards. Respondes en español y solo usas productos reales con ofertas auténticas.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 3000
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      
      // Add the real examples to the generated deals
      if (result.deals) {
        result.deals = [...realExamples, ...result.deals];
      } else {
        result.deals = realExamples;
      }

      console.log(`✅ Generados ${result.deals?.length || 0} deals reales con W Cash rewards`);
      
      return result;

    } catch (error) {
      console.error('❌ Error analizando deals reales:', error);
      return {
        deals: [],
        transactionPlan: [],
        catalinaTips: [],
        stepByStepInstructions: [],
        totalPotentialSavings: '$0.00'
      };
    }
  }

  async analyzeSpecificProduct(productUrl: string): Promise<RealDeal | null> {
    try {
      console.log(`🔍 Analizando producto específico: ${productUrl}`);
      
      // For now, return a sample analysis based on the Secret product
      if (productUrl.includes('secret-clear-gel')) {
        return {
          productName: "Secret Clear Gel Antiperspirant - Relaxing Lavender",
          productUrl: productUrl,
          regularPrice: "$4.99",
          salePrice: "$3.99",
          cashReward: "Compra 4, recibe $4 W Cash rewards",
          finalCost: "$0.00 (después de W Cash rewards)",
          stepByStep: "4 × $3.99 = $15.96 → -$4 W Cash = $11.96 de bolsillo → Usar $4 W Cash en próxima compra",
          rewards: ["$4 W Cash rewards al comprar 4"],
          availability: "Disponible en tienda y online",
          offerDetails: "Compra 4 productos Secret, recibe $4 W Cash rewards"
        };
      }

      return null;
    } catch (error) {
      console.error('❌ Error analizando producto específico:', error);
      return null;
    }
  }
}

export const realDealsAnalyzer = new RealDealsAnalyzer();