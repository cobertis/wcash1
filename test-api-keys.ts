/**
 * Script de prueba para verificar todas las API keys de Walgreens
 */

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

// Número de teléfono conocido que existe en Walgreens (de los logs anteriores)
const TEST_PHONE = '3057442120';

async function testApiKey(name: string, apiKey: string, affId: string) {
  const url = 'https://services.walgreens.com/api/offers/lookup/v1';
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apiKey': apiKey,
        'affId': affId,
      },
      body: JSON.stringify({
        phoneNumber: TEST_PHONE
      })
    });

    const data = await response.json();
    
    // Verificar si la respuesta indica error 403
    if (data.errCode === '403') {
      return {
        name,
        status: '❌ ERROR 403',
        message: data.errMsg || 'Key doesn\'t Exists',
        works: false
      };
    }
    
    // Verificar si la respuesta es válida
    if (data.phoneNumber || data.matchProfiles) {
      return {
        name,
        status: '✅ FUNCIONA',
        message: 'API key válida',
        works: true
      };
    }
    
    // Cualquier otra respuesta
    return {
      name,
      status: '⚠️ RESPUESTA INESPERADA',
      message: JSON.stringify(data).substring(0, 100),
      works: false
    };
    
  } catch (error: any) {
    return {
      name,
      status: '❌ ERROR',
      message: error.message,
      works: false
    };
  }
}

async function testAllKeys() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔍 PRUEBA DE API KEYS DE WALGREENS');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`📞 Número de prueba: ${TEST_PHONE}`);
  console.log(`🔑 Total de keys a probar: ${API_KEYS.length}`);
  console.log('═══════════════════════════════════════════════════════════\n');
  
  const results = [];
  
  for (const apiKey of API_KEYS) {
    console.log(`Probando API key ${apiKey.name}...`);
    const result = await testApiKey(apiKey.name, apiKey.key, apiKey.affId);
    results.push(result);
    console.log(`  ${result.status} - ${result.message}\n`);
    
    // Pequeña pausa para no sobrecargar
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('📊 RESUMEN DE RESULTADOS');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  const working = results.filter(r => r.works);
  const failing = results.filter(r => !r.works);
  
  console.log(`✅ Keys que FUNCIONAN: ${working.length}/${API_KEYS.length}`);
  if (working.length > 0) {
    working.forEach(r => console.log(`   - Key ${r.name}: ${r.message}`));
  }
  
  console.log(`\n❌ Keys que FALLAN: ${failing.length}/${API_KEYS.length}`);
  if (failing.length > 0) {
    failing.forEach(r => console.log(`   - Key ${r.name}: ${r.message}`));
  }
  
  console.log('\n═══════════════════════════════════════════════════════════');
  
  if (working.length === 0) {
    console.log('🚨 CRÍTICO: NINGUNA API KEY FUNCIONA');
    console.log('   Todas las keys están inválidas o expiradas');
  } else if (working.length < API_KEYS.length / 2) {
    console.log('⚠️ ADVERTENCIA: Menos del 50% de las keys funcionan');
    console.log('   Reemplaza las keys que no funcionan');
  } else {
    console.log('✅ La mayoría de las keys funcionan correctamente');
  }
  
  console.log('═══════════════════════════════════════════════════════════\n');
}

testAllKeys().catch(console.error);
