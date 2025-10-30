/**
 * Prueba detallada de API keys con el número específico 2399450895
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

const TEST_PHONE = '2399450895';

async function testApiKeyDetailed(name: string, apiKey: string, affId: string) {
  const url = 'https://services.walgreens.com/api/offers/lookup/v1';
  
  console.log(`\n${'='.repeat(70)}`);
  console.log(`🔑 Probando API Key ${name}`);
  console.log(`${'='.repeat(70)}`);
  console.log(`📞 Número: ${TEST_PHONE}`);
  console.log(`🔗 URL: ${url}`);
  console.log(`🔑 API Key: ${apiKey.substring(0, 10)}...`);
  console.log(`🏷️  Aff ID: ${affId}`);
  
  try {
    const requestBody = {
      phoneNumber: TEST_PHONE
    };
    
    console.log(`📤 Request Body:`, JSON.stringify(requestBody));
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apiKey': apiKey,
        'affId': affId,
      },
      body: JSON.stringify(requestBody)
    });

    console.log(`📊 HTTP Status: ${response.status} ${response.statusText}`);
    
    const responseText = await response.text();
    console.log(`📥 Response Length: ${responseText.length} bytes`);
    
    let data;
    try {
      data = JSON.parse(responseText);
      console.log(`📦 Response JSON:`, JSON.stringify(data, null, 2));
    } catch (e) {
      console.log(`⚠️ No JSON response, raw text:`, responseText);
      return {
        name,
        status: '❌ ERROR',
        message: 'Invalid JSON response',
        works: false
      };
    }
    
    // Verificar errCode 403
    if (data.errCode === '403') {
      console.log(`❌ RESULTADO: Error 403 - ${data.errMsg}`);
      return {
        name,
        status: '❌ ERROR 403',
        message: data.errMsg || 'Key doesn\'t Exists',
        works: false
      };
    }
    
    // Verificar si encontró perfil
    if (data.matchProfiles && data.matchProfiles.length > 0) {
      const profile = data.matchProfiles[0];
      console.log(`✅ RESULTADO: Perfil encontrado!`);
      console.log(`   Nombre: ${profile.firstName} ${profile.lastName}`);
      console.log(`   Email: ${profile.email || 'N/A'}`);
      console.log(`   Card: ${profile.loyaltyCardNumber || 'N/A'}`);
      return {
        name,
        status: '✅ FUNCIONA',
        message: `Encontró: ${profile.firstName} ${profile.lastName}`,
        works: true
      };
    }
    
    // No encontró perfil pero no hay error 403
    if (data.messages) {
      console.log(`ℹ️ RESULTADO: Sin resultados pero API funciona`);
      console.log(`   Mensaje:`, data.messages);
      return {
        name,
        status: '✅ FUNCIONA (sin match)',
        message: 'API key válida, número no encontrado',
        works: true
      };
    }
    
    console.log(`⚠️ RESULTADO: Respuesta inesperada`);
    return {
      name,
      status: '⚠️ RESPUESTA INESPERADA',
      message: JSON.stringify(data).substring(0, 100),
      works: false
    };
    
  } catch (error: any) {
    console.log(`❌ ERROR DE RED: ${error.message}`);
    return {
      name,
      status: '❌ ERROR DE RED',
      message: error.message,
      works: false
    };
  }
}

async function main() {
  console.log('\n');
  console.log('═'.repeat(70));
  console.log('🔍 PRUEBA DETALLADA DE API KEYS DE WALGREENS');
  console.log('═'.repeat(70));
  console.log(`📞 Número de prueba: ${TEST_PHONE}`);
  console.log(`🔑 Total de keys: ${API_KEYS.length}`);
  console.log('═'.repeat(70));
  
  const results = [];
  
  for (const apiKey of API_KEYS) {
    const result = await testApiKeyDetailed(apiKey.name, apiKey.key, apiKey.affId);
    results.push(result);
    
    // Pausa de 1 segundo entre llamadas
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n\n');
  console.log('═'.repeat(70));
  console.log('📊 RESUMEN FINAL');
  console.log('═'.repeat(70));
  
  const working = results.filter(r => r.works);
  const failing = results.filter(r => !r.works);
  
  console.log(`\n✅ Keys que FUNCIONAN: ${working.length}/${API_KEYS.length}`);
  working.forEach(r => console.log(`   ${r.status} - Key ${r.name}: ${r.message}`));
  
  console.log(`\n❌ Keys que FALLAN: ${failing.length}/${API_KEYS.length}`);
  failing.forEach(r => console.log(`   ${r.status} - Key ${r.name}: ${r.message}`));
  
  console.log('\n' + '═'.repeat(70) + '\n');
}

main().catch(console.error);
