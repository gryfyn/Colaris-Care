import { generateKeyPairSync } from 'crypto';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';

const secretsDir = './secrets';

try {
  mkdirSync(secretsDir, { recursive: true });

  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem'
    }
  });

  writeFileSync(`${secretsDir}/jwt.public.pem`, publicKey);
  writeFileSync(`${secretsDir}/jwt.private.pem`, privateKey);

  console.log('✓ JWT keys generated successfully');
  console.log(`  - Private key: ${secretsDir}/jwt.private.pem`);
  console.log(`  - Public key: ${secretsDir}/jwt.public.pem`);
} catch (error) {
  console.error('✗ Error generating JWT keys:', error.message);
  process.exit(1);
}
