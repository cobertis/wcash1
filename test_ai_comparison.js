// Test script for AI comparison between ChatGPT and Grok

async function testAIComparison() {
  try {
    console.log('=== TESTING AI COMPARISON ===');
    
    // Sample coupon data
    const coupon = {
      offerId: 'test-tampax-coupon',
      title: 'Tampax®',
      description: 'ONE Tampax® Tampons up to 20 ct (excludes trial/travel size)',
      discount: '$3 off 1',
      category: 'Personal Care',
      categoryName: 'Personal Care',
      brandName: 'Tampax®',
      summary: '$3 off 1',
      expiryDate: '07/31/25',
      status: 'active'
    };

    const memberName = 'Usuario de Prueba';
    const encLoyaltyId = 'KBG6FNs8Dz8/CvQrsEouYQ==';

    console.log('Coupon:', coupon);
    console.log('Member:', memberName);
    
    // Test the comparison endpoint
    const response = await fetch('http://localhost:5000/api/ai/compare', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        coupon: coupon,
        memberName: memberName,
        encLoyaltyId: encLoyaltyId
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('\n=== COMPARISON RESULTS ===');
    console.log('Success:', data.success);
    
    if (data.success) {
      console.log('\n--- CHATGPT ANALYSIS ---');
      console.log('Success:', data.chatGPT.success);
      if (data.chatGPT.success) {
        console.log('Analysis:', data.chatGPT.analysis.substring(0, 200) + '...');
      } else {
        console.log('Error:', data.chatGPT.error);
      }
      
      console.log('\n--- GROK ANALYSIS ---');
      console.log('Success:', data.grok.success);
      if (data.grok.success) {
        console.log('Analysis:', data.grok.analysis.substring(0, 200) + '...');
      } else {
        console.log('Error:', data.grok.error);
      }
    } else {
      console.log('Error:', data.error);
    }

  } catch (error) {
    console.error('Error testing AI comparison:', error);
  }
}

// Run the test
testAIComparison();