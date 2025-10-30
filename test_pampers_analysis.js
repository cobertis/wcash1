// Test the Pampers coupon analysis via API endpoint
const fetch = require('node-fetch');

async function testPampersAnalysis() {
  console.log('=== TESTING PAMPERS COUPON ANALYSIS VIA API ===');
  
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
  
  const requestData = {
    coupon: pampersCoupon,
    encLoyaltyId: 'KBG6FNs8Dz8/CvQrsEouYQ==',
    memberName: 'Usuario Test'
  };
  
  try {
    console.log('Sending request to analyze Pampers coupon...');
    
    const response = await fetch('http://localhost:5000/api/ai/promotions/analyze-coupon', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestData)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const analysis = await response.json();
    
    console.log('\n=== RESULTADO DEL ANÁLISIS ===');
    console.log(JSON.stringify(analysis, null, 2));
    
    // Verify key components
    if (analysis.eligibleProducts && analysis.eligibleProducts.length > 0) {
      console.log('\n✅ PRODUCTS FOUND:');
      analysis.eligibleProducts.forEach((product, index) => {
        console.log(`${index + 1}. ${product.productName}`);
        console.log(`   Link: ${product.productLink}`);
        console.log(`   Regular Price: ${product.regularPrice}`);
        console.log(`   After Coupon: ${product.afterCoupon}`);
        console.log(`   W Cash Rewards: ${product.wCashRewards}`);
        console.log(`   Net Cost: ${product.netCost}`);
        console.log('');
      });
    }
    
    if (analysis.actionPlan) {
      console.log('✅ ACTION PLAN:');
      analysis.actionPlan.stepByStep.forEach((step, index) => {
        console.log(`   ${index + 1}. ${step}`);
      });
    }
    
    if (analysis.dealRating) {
      console.log(`\n✅ DEAL RATING: ${analysis.dealRating.score}/10`);
      console.log(`✅ RECOMMENDATION: ${analysis.dealRating.recommendation}`);
    }
    
    console.log('\n=== TEST COMPLETED SUCCESSFULLY ===');
    
  } catch (error) {
    console.error('❌ Error testing Pampers coupon:', error);
  }
}

// Run the test
testPampersAnalysis();