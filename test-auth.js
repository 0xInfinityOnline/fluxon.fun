const fetch = require('node-fetch');

const API_URL = 'http://localhost:3001/api';
const TEST_EMAIL = 'test@example.com';
const TEST_PASSWORD = 'testpassword';

async function testAuth() {
  try {
    // 1. Registrar un nuevo usuario
    console.log('Intentando registrar usuario...');
    const registerRes = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        name: 'Test User'
      })
    });

    let token;
    
    if (registerRes.status === 409) {
      console.log('El usuario ya existe, iniciando sesión...');
      const loginRes = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: TEST_EMAIL,
          password: TEST_PASSWORD
        })
      });
      
      if (!loginRes.ok) {
        throw new Error(`Error al iniciar sesión: ${loginRes.status} ${loginRes.statusText}`);
      }
      
      const loginData = await loginRes.json();
      token = loginData.token;
      console.log('Inicio de sesión exitoso');
    } else if (registerRes.ok) {
      const registerData = await registerRes.json();
      token = registerData.token;
      console.log('Usuario registrado exitosamente');
    } else {
      const error = await registerRes.text();
      throw new Error(`Error al registrar usuario: ${registerRes.status} ${registerRes.statusText} - ${error}`);
    }

    // 2. Probar el análisis de texto
    console.log('\nProbando análisis de texto...');
    const analysisRes = await fetch(`${API_URL}/ai/analyze-post`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        content: 'Este es un texto de prueba para analizar con la API de Fluxon.',
        modelName: 'deepseek'
      })
    });

    if (!analysisRes.ok) {
      const error = await analysisRes.text();
      throw new Error(`Error en el análisis: ${analysisRes.status} ${analysisRes.statusText} - ${error}`);
    }

    const analysisData = await analysisRes.json();
    console.log('Análisis exitoso:');
    console.log('Recomendaciones:', analysisData.recommendations);
    console.log('Puntuación de viralidad:', analysisData.viralityScore);
    
  } catch (error) {
    console.error('Error en la prueba:', error.message);
  }
}

testAuth();
