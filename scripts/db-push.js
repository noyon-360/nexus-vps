const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { execSync } = require('child_process');

console.log("Running prisma db push with dotenv...");
try {
    execSync('npx prisma db push', { stdio: 'inherit' });
} catch (e) {
    process.exit(1);
}
