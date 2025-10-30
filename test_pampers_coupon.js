// Test script to verify the Pampers coupon analysis works correctly
import { aiPromotionsService } from './server/services/ai-promotions.js';

async function testPampersCoupon() {
  console.log('=== TESTING PAMPERS COUPON ANALYSIS ===');
  
  // The exact coupon data from user's example
  const pampersCoupon = {
    brandName: 'Pampers',
    summary: '$1.50 off 2 Pampers Single-Pack Baby Wipes',
    description: 'Pampers Single-Pack Baby Wipes Select Complete Clean, Free & Gentle or Sensitive',
    categoryName: 'Baby Care',
    expiryDate: '08/30/25',
    offerValue: 1.50,
    minQty: 2,
    code: 'PAMPERS_WIPES_150',
    offerId: 'TEST_PAMPERS_001'
  };

  const memberName = 'Usuario Test';
  const wasRedeemed = false;
  const encLoyaltyId = 'KBG6FNs8Dz8/CvQrsEouYQ==';

  try {
    console.log('Iniciando análisis del cupón de Pampers...');
    console.log('Cupón:', JSON.stringify(pampersCoupon, null, 2));
    
    const analysis = await aiPromotionsService.analyzeCouponOpportunity(
      pampersCoupon,
      memberName,
      wasRedeemed,
      encLoyaltyId
    );
    
    console.log('\n=== RESULTADO DEL ANÁLISIS ===');
    console.log(JSON.stringify(analysis, null, 2));
    
    // Verify the analysis contains key elements
    if (analysis.eligibleProducts && analysis.eligibleProducts.length > 0) {
      console.log('\n✅ PRODUCTS FOUND WITH CASH REWARDS:');
      analysis.eligibleProducts.forEach((product, index) => {
        console.log(`${index + 1}. ${product.productName}`);
        console.log(`   Price: ${product.regularPrice}`);
        console.log(`   After coupon: ${product.afterCoupon}`);
        console.log(`   W Cash rewards: ${product.wCashRewards}`);
        console.log(`   Net cost: ${product.netCost}`);
        console.log(`   Link: ${product.productLink}`);
        console.log('');
      });
    } else {
      console.log('❌ No products found with cash rewards');
    }
    
    if (analysis.actionPlan) {
      console.log('✅ ACTION PLAN GENERATED:');
      console.log(analysis.actionPlan.stepByStep);
    }
    
    if (analysis.dealRating) {
      console.log(`✅ DEAL RATING: ${analysis.dealRating.score}/10`);
      console.log(`✅ RECOMMENDATION: ${analysis.dealRating.recommendation}`);
    }
    
  } catch (error) {
    console.error('❌ Error testing Pampers coupon:', error);
  }
}

// Run the test
testPampersCoupon();