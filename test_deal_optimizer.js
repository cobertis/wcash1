import { dealOptimizer } from './server/services/deal-optimizer.js';

// Test the deal optimizer with real data
async function testDealOptimizer() {
  console.log('🔍 Testing Deal Optimizer with real encLoyaltyId...');
  
  const encLoyaltyId = 'KBG6FNs8Dz8/CvQrsEouYQ==';
  
  try {
    // Test 1: General best deals
    console.log('\n=== TEST 1: General Best Deals ===');
    const generalDeals = await dealOptimizer.findBestDeals(encLoyaltyId);
    console.log(`Found ${generalDeals.length} general deals`);
    
    if (generalDeals.length > 0) {
      const bestDeal = generalDeals[0];
      console.log(`Best deal: ${bestDeal.productName}`);
      console.log(`Original price: $${bestDeal.originalPrice}`);
      console.log(`Final cost: $${bestDeal.finalCost}`);
      console.log(`Total savings: $${bestDeal.totalSavings}`);
      console.log(`Net result: ${bestDeal.netResult}`);
      console.log(`Promotions: ${bestDeal.promotions.length}`);
    }
    
    // Test 2: Search for specific products
    console.log('\n=== TEST 2: Search for Crest Products ===');
    const crestDeals = await dealOptimizer.findBestDeals(encLoyaltyId, 'Crest');
    console.log(`Found ${crestDeals.length} Crest deals`);
    
    if (crestDeals.length > 0) {
      const crestDeal = crestDeals[0];
      console.log(`Crest deal: ${crestDeal.productName}`);
      console.log(`Original price: $${crestDeal.originalPrice}`);
      console.log(`Final cost: $${crestDeal.finalCost}`);
      console.log(`Net result: ${crestDeal.netResult}`);
    }
    
    // Test 3: Search for vitamins
    console.log('\n=== TEST 3: Search for Vitamin Products ===');
    const vitaminDeals = await dealOptimizer.findBestDeals(encLoyaltyId, 'vitamin');
    console.log(`Found ${vitaminDeals.length} vitamin deals`);
    
    if (vitaminDeals.length > 0) {
      const vitaminDeal = vitaminDeals[0];
      console.log(`Vitamin deal: ${vitaminDeal.productName}`);
      console.log(`Original price: $${vitaminDeal.originalPrice}`);
      console.log(`Final cost: $${vitaminDeal.finalCost}`);
      console.log(`Net result: ${vitaminDeal.netResult}`);
    }
    
    console.log('\n✅ Deal Optimizer test completed successfully!');
    
  } catch (error) {
    console.error('❌ Deal Optimizer test failed:', error);
  }
}

// Run the test
testDealOptimizer();