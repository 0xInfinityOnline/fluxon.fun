@echo off
echo Installing frontend dependencies...
call npm install

echo Installing server dependencies...
cd server
call npm init -y
call npm install express cors dotenv mysql2 multer csv-parser node-fetch zod
call npm install --save-dev typescript @types/node @types/express @types/cors @types/multer ts-node-dev

echo Setting up TypeScript...
call npx tsc --init

echo Creating .env file...
copy .env.example .env

echo Setup complete!
cd ..
echo You can now start the development servers:
echo Frontend: npm run dev
echo Backend: cd server ^&^& npm run dev
