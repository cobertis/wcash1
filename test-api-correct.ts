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
    apiKey: apiKey,        // EN EL BODY
    affId: affId,          // EN EL BODY
    svcRequestor: "ECOMMTP"
  };
  
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
      return { name, status: '✅', message: `${profile.firstName} ${profile.lastName}`, works: true };
    } else if (data.errCode === '403') {
      return { name, status: '❌', message: data.errMsg || 'Error 403', works: false };
    } else {
      return { name, status: '⚠️', message: 'Sin match', works: true };
    }
  } catch (error) {
    return { name, status: '❌', message: error.message, works: false };
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔍 PRUEBA CORRECTA DE API KEYS');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`📞 Teléfono: ${TEST_PHONE}`);
  console.log(`🔑 Total keys: ${API_KEYS.length}\n`);
  
  const results = [];
  for (const key of API_KEYS) {
    console.log(`Probando Key ${key.name}...`);
    const result = await testKey(key.name, key.key, key.affId);
    results.push(result);
    console.log(`  ${result.status} ${result.message}\n`);
    await new Promise(r => setTimeout(r, 500));
  }
  
  const working = results.filter(r => r.works);
  const failing = results.filter(r => !r.works);
  
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`✅ Funcionan: ${working.length}/${API_KEYS.length}`);
  console.log(`❌ Fallan: ${failing.length}/${API_KEYS.length}`);
  console.log('═══════════════════════════════════════════════════════════\n');
}

main().catch(console.error);
