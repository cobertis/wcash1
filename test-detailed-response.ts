const API_KEYS = [
  { name: '1', key: 'uu6AyeO7XCwo5moFWSrMJ6HHhKMQ2FZW', affId: 'AAAAAAAAAA' },
  { name: '2', key: 'NQpKJZXdhbI2KRbfApYXcvtcYHtxjyFW', affId: 'AAAAAAAAAA' },
  { name: '3', key: 'rTIthoVNMd81ZNE2KAuyZP5GB8HZzbsp', affId: 'AAAAAAAAAA' },
  { name: '4', key: 'rwwrfKcBcOG0gXXSo2S5JNEGfCwykaaB', affId: 'AAAAAAAAAA' },
  { name: '5', key: 'kGIVTPd1G3yATNZJUtPMS2WpsVq2HqKJ', affId: 'AAAAAAAAAA' },
  { name: '6', key: 'FVwViZ2wvFLgZGLsivQ3YsczkXdACq7W', affId: 'AAAAAAAAAA' },
  { name: '7', key: '3H7ojMzMa0dhE71lShvyoFnbJAcKk98o', affId: 'AAAAAAAAAA' },
  { name: '8', key: 'ABJ1WzR6PCaFZfGsqyBGTgDh4FUIa5yk', affId: 'AAAAAAAAAA' },
  { name: '9', key: 'VDdrnb75LurIxXCmsakOo4yeVYo2dI5n', affId: 'AAAAAAAAAA' },
  { name: '10', key: 'sUlRxNa2gDKFNY6Yl7aYrgMBX7Y7TYba', affId: 'AAAAAAAAAA' },
  { name: '11', key: 'IKwwPz3OcVFzOi6JIpKrI5NQkaJ78MPy', affId: 'AAAAAAAAAA' },
  { name: '12', key: 'BNNFsFz1qvMnnHPqdh7wgqnG4jr4mZXH', affId: 'AAAAAAAAAA' },
  { name: '13', key: 'JOIva07reGq1MiYI3Jcd87AcGaPQJLn6', affId: 'AAAAAAAAAA' },
  { name: '14', key: 'fXmmlUUPnKSVd2KqDvywYxCnhiaU6TG9', affId: 'AAAAAAAAAA' },
  { name: '15', key: '21oEBK4ImM6BWeke19c4XEaaxGvDO4aO', affId: 'AAAAAAAAAA' },
  { name: '16', key: 'pY7xfeIbQ9LGEG5sN10T2GNSiclbaoCX', affId: 'AAAAAAAAAA' },
  { name: '17', key: '6GWuutKwV2yNJuGX8QWdNba6as3JxzSS', affId: 'AAAAAAAAAA' },
  { name: '18', key: 'CMgWXYy7GLSxGgYVNEMlmyTmyQPk5Ybn', affId: 'AAAAAAAAAA' },
  { name: '19', key: 'GPm71CfKPp85DK6TJFwCci5h5XPDzB1l', affId: 'AAAAAAAAAA' },
  { name: '20', key: 'AufCDhkyUmZjO3pcJBMzQmRLUWGA7C6u', affId: 'AAAAAAAAAA' },
];

const TEST_PHONE = '2399450895';

async function testKey(name, apiKey, affId) {
  const url = 'https://services.walgreens.com/api/offers/lookup/v1';
  
  const requestBody = {
    phoneNumber: TEST_PHONE,
    apiKey: apiKey,
    affId: affId,
    svcRequestor: "ECOMMTP"
  };
  
  console.log(`\n${'='.repeat(70)}`);
  console.log(`🔑 KEY ${name} - ${apiKey.substring(0, 15)}...`);
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

    const text = await response.text();
    console.log(`HTTP Status: ${response.status}`);
    console.log(`Response: ${text}`);
    
    const data = JSON.parse(text);
    
    if (data.matchProfiles && data.matchProfiles.length > 0) {
      console.log(`✅ VÁLIDA - Encontró perfil`);
      return { name, works: true };
    } else if (data.errCode === '403') {
      console.log(`❌ INVÁLIDA - ${data.errMsg}`);
      return { name, works: false };
    } else {
      console.log(`⚠️ SIN MATCH - Key funciona pero no encontró el número`);
      return { name, works: true };
    }
  } catch (error) {
    console.log(`❌ ERROR - ${error.message}`);
    return { name, works: false };
  }
}

async function main() {
  console.log('\n\n');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║       PRUEBA DETALLADA DE TODAS LAS API KEYS             ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  
  const results = [];
  
  // Probar solo las primeras 10 para ver el patrón
  for (let i = 0; i < 10; i++) {
    const key = API_KEYS[i];
    const result = await testKey(key.name, key.key, key.affId);
    results.push(result);
    await new Promise(r => setTimeout(r, 800));
  }
  
  console.log('\n\n');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║                    RESUMEN PRIMERAS 10                    ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  
  const working = results.filter(r => r.works);
  const failing = results.filter(r => !r.works);
  
  console.log(`\n✅ Funcionan: ${working.length}/10`);
  working.forEach(r => console.log(`   - Key ${r.name}`));
  
  console.log(`\n❌ Fallan: ${failing.length}/10`);
  failing.forEach(r => console.log(`   - Key ${r.name}`));
  
  console.log('\n');
}

main().catch(console.error);
