import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const backupsDir = path.join(__dirname, 'backups');
if (!fs.existsSync(backupsDir)) {
  fs.mkdirSync(backupsDir, { recursive: true });
}

export function createBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `nmart_backup_${timestamp}.db`;
  const targetPath = path.join(backupsDir, filename);

  const dbPath = path.join(__dirname, 'data', 'nmart.db');

  // Checkpoint WAL journal to make sure database file is 100% up to date
  try {
    db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
  } catch (err) {
    console.warn('WAL checkpoint warning:', err.message);
  }

  // Copy sqlite file
  fs.copyFileSync(dbPath, targetPath);

  // Check if cloud backup path is configured in settings
  try {
    const row = db.prepare("SELECT value FROM settings WHERE key = 'cloud_backup_path'").get();
    if (row && row.value && row.value.trim() !== '') {
      const cloudDir = row.value.trim();
      if (fs.existsSync(cloudDir)) {
        const cloudTarget = path.join(cloudDir, filename);
        fs.copyFileSync(dbPath, cloudTarget);
        console.log(`[Backup] Synced to Cloud folder: ${cloudTarget}`);
      }
    }
  } catch (e) {
    console.warn('[Backup] Cloud sync skipped:', e.message);
  }

  const stat = fs.statSync(targetPath);
  return {
    filename,
    path: targetPath,
    size: stat.size,
    createdAt: new Date().toISOString()
  };
}

export function listBackups() {
  if (!fs.existsSync(backupsDir)) return [];
  const files = fs.readdirSync(backupsDir);
  return files
    .filter(f => f.endsWith('.db') || f.endsWith('.sqlite'))
    .map(filename => {
      const p = path.join(backupsDir, filename);
      const stat = fs.statSync(p);
      return {
        filename,
        size: stat.size,
        createdAt: stat.birthtime || stat.mtime
      };
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export function getBackupFilePath(filename) {
  // Prevent directory traversal
  const safeName = path.basename(filename);
  const p = path.join(backupsDir, safeName);
  if (fs.existsSync(p)) return p;
  return null;
}

// Run periodic auto-backup every 6 hours
setInterval(() => {
  try {
    console.log('[Auto-Backup] Running periodic snapshot...');
    createBackup();
  } catch (err) {
    console.error('[Auto-Backup] Failed:', err);
  }
}, 6 * 60 * 60 * 1000);
