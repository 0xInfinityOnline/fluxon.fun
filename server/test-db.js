const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function testConnection() {
  let client;
  try {
    console.log('Intentando conectar a la base de datos...');
    client = await pool.connect();
    console.log('Conexión exitosa a PostgreSQL');
    
    // Verificar si la base de datos existe
    const dbRes = await client.query("SELECT 1 FROM pg_database WHERE datname = 'fluxon'");
    if (dbRes.rows.length === 0) {
      console.log('La base de datos "fluxon" no existe. Creándola...');
      await client.query('CREATE DATABASE fluxon');
      console.log('Base de datos creada exitosamente');
    } else {
      console.log('La base de datos "fluxon" ya existe');
    }
    
    // Verificar tablas
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    console.log('\nTablas en la base de datos:');
    console.log(tablesRes.rows.map(row => row.table_name).join('\n') || 'No hay tablas');
    
  } catch (error) {
    console.error('Error al conectar a la base de datos:', error.message);
    
    if (error.code === '3D000') { // database does not exist
      console.log('\nPosibles soluciones:');
      console.log('1. Crea la base de datos manualmente en pgAdmin o con el comando:');
      console.log('   createdb -U postgres fluxon');
      console.log('\n2. O usa un cliente PostgreSQL para crearla');
    } else if (error.code === '28P01') { // invalid password
      console.log('\nError de autenticación. Verifica el usuario y contraseña en DATABASE_URL');
    } else if (error.code === 'ECONNREFUSED') {
      console.log('\nNo se puede conectar al servidor PostgreSQL. Asegúrate de que:');
      console.log('1. PostgreSQL esté instalado y en ejecución');
      console.log('2. El puerto en DATABASE_URL sea correcto (por defecto 5432)');
      console.log('3. El usuario y contraseña sean correctos');
    }
    
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

testConnection();
