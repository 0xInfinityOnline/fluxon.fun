const fetch = require('node-fetch');

async function testAnalysis() {
  const testText = "¡Hola! Este es un texto de prueba para analizar con la API de Fluxon.";
  
  try {
    // Primero, necesitamos un token JWT válido
    const loginResponse = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'testpassword'
      })
    });

    let token;
    if (loginResponse.ok) {
      const loginData = await loginResponse.json();
      token = loginData.token;
      console.log('Login exitoso, token obtenido');
    } else {
      // Si el login falla, intentamos registrarnos primero
      const registerResponse = await fetch('http://localhost:3001/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'testpassword',
          name: 'Test User'
        })
      });
      
      if (!registerResponse.ok) {
        console.error('Error al registrar usuario de prueba');
        const error = await registerResponse.text();
        console.error('Detalles:', error);
        return;
      }
      
      const registerData = await registerResponse.json();
      token = registerData.token;
      console.log('Usuario registrado exitosamente, token obtenido');
    }

    // Ahora probamos el análisis de texto
    const analysisResponse = await fetch('http://localhost:3001/api/ai/analyze-post', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        content: testText,
        modelName: 'deepseek'
      })
    });

    if (!analysisResponse.ok) {
      console.error('Error en el análisis:', analysisResponse.status, analysisResponse.statusText);
      const error = await analysisResponse.text();
      console.error('Detalles:', error);
      return;
    }

    const result = await analysisResponse.json();
    console.log('Análisis exitoso:');
    console.log('Recomendaciones:', result.recommendations);
    console.log('Puntuación de viralidad:', result.viralityScore);
    
  } catch (error) {
    console.error('Error en la prueba:', error);
  }
}

testAnalysis();
