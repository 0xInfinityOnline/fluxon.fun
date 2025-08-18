const fetch = require('node-fetch');

async function testDeepSeek() {
  const apiKey = 'sk-8058a6b4013a4b8389528439ffd5aa4d';
  const endpoint = 'https://api.deepseek.com/v1/chat/completions';

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'user',
            content: 'Hola, ¿puedes confirmar que la API está funcionando?'
          }
        ],
        temperature: 0.7,
        max_tokens: 100
      })
    });

    if (!response.ok) {
      console.error('Error en la respuesta:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('Detalles del error:', errorText);
      return;
    }

    const data = await response.json();
    console.log('Respuesta exitosa:');
    console.log(JSON.stringify(data, null, 2));
    
  } catch (error) {
    console.error('Error al hacer la petición:', error);
  }
}

testDeepSeek();
