const crypto = require('node:crypto');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');

const MAGIC = Buffer.from('SSCFG001', 'ascii');
const SALT_LENGTH = 16;
const NONCE_LENGTH = 12;
const TAG_LENGTH = 16;
const HEADER_LENGTH = MAGIC.length + SALT_LENGTH + NONCE_LENGTH;
const SCRYPT_OPTIONS = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

function getPassphrase() {
  const encoded = fs.readFileSync(0, 'utf8').trim();
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) {
    throw new Error('A passphrase was not received securely.');
  }
  const passphrase = Buffer.from(encoded, 'base64');
  if (passphrase.length < 16 || passphrase.length > 4096) {
    passphrase.fill(0);
    throw new Error('Passphrase must contain at least 16 UTF-8 bytes.');
  }
  return passphrase;
}

function runPython(python, script, operation, input, extraArgs = []) {
  const result = spawnSync(
    python,
    [script, operation, ...extraArgs],
    { input, encoding: null, maxBuffer: 128 * 1024 * 1024, windowsHide: true },
  );
  if (result.error) {
    throw new Error('Could not run the configuration archive validator.');
  }
  if (result.status !== 0) {
    const message = (result.stderr || Buffer.from('Archive validation failed.')).toString('utf8').trim();
    throw new Error(message.replace(/[\r\n]+/g, ' '));
  }
  return result.stdout;
}

function encryptArchive(archive, passphrase) {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const nonce = crypto.randomBytes(NONCE_LENGTH);
  const header = Buffer.concat([MAGIC, salt, nonce]);
  const key = crypto.scryptSync(passphrase, salt, 32, SCRYPT_OPTIONS);
  try {
    const cipher = crypto.createCipheriv('aes-256-gcm', key, nonce);
    cipher.setAAD(header);
    const ciphertext = Buffer.concat([cipher.update(archive), cipher.final()]);
    return Buffer.concat([header, ciphertext, cipher.getAuthTag()]);
  } finally {
    key.fill(0);
  }
}

function decryptArchive(encrypted, passphrase) {
  if (
    encrypted.length < HEADER_LENGTH + TAG_LENGTH ||
    !encrypted.subarray(0, MAGIC.length).equals(MAGIC)
  ) {
    throw new Error('Configuration backup format is invalid.');
  }
  const header = encrypted.subarray(0, HEADER_LENGTH);
  const salt = encrypted.subarray(MAGIC.length, MAGIC.length + SALT_LENGTH);
  const nonce = encrypted.subarray(MAGIC.length + SALT_LENGTH, HEADER_LENGTH);
  const ciphertext = encrypted.subarray(HEADER_LENGTH, encrypted.length - TAG_LENGTH);
  const tag = encrypted.subarray(encrypted.length - TAG_LENGTH);
  const key = crypto.scryptSync(passphrase, salt, 32, SCRYPT_OPTIONS);
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonce);
    decipher.setAAD(header);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    throw new Error('Configuration backup authentication failed; check the passphrase or backup integrity.');
  } finally {
    key.fill(0);
  }
}

function main() {
  const [operation, python, archiveScript, sourceOrDestination, outputPath] = process.argv.slice(2);
  if (!python || !archiveScript) {
    throw new Error('Required archive tool paths are missing.');
  }
  const passphrase = getPassphrase();
  try {
    if (operation === 'encrypt') {
      const archive = runPython(
        python,
        archiveScript,
        'create-config-archive',
        undefined,
        ['--project-root', sourceOrDestination],
      );
      try {
        runPython(python, archiveScript, 'validate-config-archive', archive);
        const encrypted = encryptArchive(archive, passphrase);
        try {
          const descriptor = fs.openSync(outputPath, 'wx', 0o600);
          try {
            fs.writeFileSync(descriptor, encrypted);
          } finally {
            fs.closeSync(descriptor);
          }
          const persisted = fs.readFileSync(outputPath);
          try {
            const roundTrip = decryptArchive(persisted, passphrase);
            try {
              runPython(python, archiveScript, 'validate-config-archive', roundTrip);
            } finally {
              roundTrip.fill(0);
            }
          } finally {
            persisted.fill(0);
          }
        } finally {
          encrypted.fill(0);
        }
      } finally {
        archive.fill(0);
      }
      console.log('Configuration backup encrypted and authenticated; archive and manifest validated.');
      return;
    }

    if (operation === 'verify') {
      const encrypted = fs.readFileSync(sourceOrDestination);
      try {
        const archive = decryptArchive(encrypted, passphrase);
        try {
          runPython(python, archiveScript, 'validate-config-archive', archive);
          console.log('Configuration backup decryption and manifest validation passed.');
        } finally {
          archive.fill(0);
        }
      } finally {
        encrypted.fill(0);
      }
      return;
    }

    if (operation === 'extract') {
      const encrypted = fs.readFileSync(sourceOrDestination);
      try {
        const archive = decryptArchive(encrypted, passphrase);
        try {
          runPython(
            python,
            archiveScript,
            'extract-config-archive',
            archive,
            ['--destination', outputPath],
          );
          console.log('Configuration backup decrypted; extracted files passed manifest validation.');
        } finally {
          archive.fill(0);
        }
      } finally {
        encrypted.fill(0);
      }
      return;
    }

    throw new Error('Unsupported configuration backup operation.');
  } finally {
    passphrase.fill(0);
  }
}

try {
  main();
} catch (error) {
  console.error(`Configuration backup operation failed: ${error.message}`);
  process.exitCode = 1;
}
