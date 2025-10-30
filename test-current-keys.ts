/**
 * Prueba las 4 API keys actuales en la base de datos
 */

const CURRENT_KEYS = [
  { name: 'API_KEY_1', key: 'uu6AyeO7XCwo5moFWSrMJ6HHhKMQ2FZW', affId: 'AAAAAAAAAA' },
  { name: 'API_KEY_2', key: 'NQpKJZXdhbI2KRbfApYXcvtcYHtxjyFW', affId: 'AAAAAAAAAA' },
  { name: 'API_KEY_3', key: 'rTIthoVNMd81ZNE2KAuyZP5GB8HZzbsp', affId: 'AAAAAAAAAA' },
  { name: 'API_KEY_4', key: 'rwwrfKcBcOG0gXXSo2S5JNEGfCwykaaB', affId: 'AAAAAAAAAA' },
];

const TEST_PHONE = '2399450895';

async function testKey(name: string, apiKey: string, affId: string) {
  const url = 'https://services.walgreens.com/api/offers/lookup/v1';
  
  const requestBody = {
    phoneNumber: TEST_PHONE,
    apiKey: apiKey,
    affId: affId,
    svcRequestor: "ECOMMTP"
  };
  
  console.log(`\n${'='.repeat(70)}`);
  console.log(`🔑 ${name}`);
  console.log(`${'='.repeat(70)}`);
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Origin': 'https://www.walgreens.com',
        'Referer': 'https://www.walgreens.com/',
      },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();
    
    if (data.matchProfiles && data.matchProfiles.length > 0) {
      const profile = data.matchProfiles[0];
      console.log(`✅ FUNCIONA PERFECTO`);
      console.log(`   Encontró: ${profile.firstName} ${profile.lastName}`);
      console.log(`   Email: ${profile.email}`);
      console.log(`   Card: ${profile.loyaltyCardNumber}`);
      return { name, works: true, profile: `${profile.firstName} ${profile.lastName}` };
    } else if (data.errCode === '403') {
      console.log(`❌ NO FUNCIONA`);
      console.log(`   Error: ${data.errMsg}`);
      return { name, works: false, error: data.errMsg };
    } else {
      console.log(`⚠️ Sin match (pero la key es válida)`);
      return { name, works: true, profile: 'Sin match' };
    }
  } catch (error: any) {
    console.log(`❌ ERROR DE RED: ${error.message}`);
    return { name, works: false, error: error.message };
  }
}

async function main() {
  console.log('\n');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║     CONFIRMACIÓN DE 4 API KEYS EN BASE DE DATOS          ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log(`\n📞 Número de prueba: ${TEST_PHONE}\n`);
  
  const results = [];
  
  for (const key of CURRENT_KEYS) {
    const result = await testKey(key.name, key.key, key.affId);
    results.push(result);
    await new Promise(r => setTimeout(r, 1000));
  }
  
  console.log('\n\n');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║                    RESULTADO FINAL                        ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');
  
  const working = results.filter(r => r.works);
  const failing = results.filter(r => !r.works);
  
  if (working.length === 4) {
    console.log('✅✅✅ PERFECTO - TODAS LAS 4 API KEYS FUNCIONAN ✅✅✅\n');
    working.forEach(r => {
      console.log(`   ✅ ${r.name}: ${r.profile}`);
    });
    console.log(`\n🚀 Capacidad total: 4 keys × 300 req/min = 1,200 req/min`);
    console.log(`🚀 Procesamiento: 72,000 números por hora\n`);
  } else {
    console.log(`⚠️ ATENCIÓN: ${working.length}/4 keys funcionan\n`);
    
    if (working.length > 0) {
      console.log('✅ Keys que FUNCIONAN:');
      working.forEach(r => console.log(`   ${r.name}: ${r.profile}`));
    }
    
    if (failing.length > 0) {
      console.log('\n❌ Keys que FALLAN:');
      failing.forEach(r => console.log(`   ${r.name}: ${r.error}`));
    }
  }
  
  console.log('\n' + '═'.repeat(70) + '\n');
}

main().catch(console.error);
