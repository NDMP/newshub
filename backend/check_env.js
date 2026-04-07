/**
 * Run this from the backend folder to verify your environment:
 *   node check_env.js
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

console.log('\n=== NewsHub Environment Check ===\n');

const vars = {
  'SUPABASE_URL_URL':    process.env.SUPABASE_URL_URL,
  'SUPABASE_URL_ANON_KEY': process.env.SUPABASE_URL_ANON_KEY ? process.env.SUPABASE_URL_ANON_KEY.substring(0,20) + '...' : undefined,
  'GROQ_API_KEY':         process.env.GROQ_API_KEY ? process.env.GROQ_API_KEY.substring(0,15) + '...' : undefined,
  'NEWSAPI_KEY':          process.env.NEWSAPI_KEY,
  'PORT':                 process.env.PORT || '3001 (default)',
};

let allOk = true;
for (const [key, val] of Object.entries(vars)) {
  if (val) {
    console.log(`  ✓ ${key}: ${val}`);
  } else {
    console.log(`  ✗ ${key}: MISSING`);
    allOk = false;
  }
}

console.log('\n' + (allOk ? '✅ All env vars loaded. You can run: node server.js' : '❌ Some vars missing. Check your .env file location.'));
console.log('\nExpected .env location:', path.resolve(__dirname, '../.env'));
console.log('');
