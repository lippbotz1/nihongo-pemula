"use strict";
const admin = require('firebase-admin');
const LEASE_MS = 90 * 1000;
function app() {
  if (admin.apps.length) return admin.app();
  const key = String(process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !key || !process.env.FIREBASE_DATABASE_URL) {
    throw new Error('Missing Firebase Admin environment variables');
  }
  return admin.initializeApp({
    credential: admin.credential.cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: key }),
    databaseURL: process.env.FIREBASE_DATABASE_URL
  });
}
const reply = (res, status, body) => res.status(status).json(body);
async function verify(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) throw Object.assign(new Error('Unauthorized'), { status: 401 });
  return admin.auth().verifyIdToken(header.slice(7), true); // reject revoked sessions
}
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  if (req.method !== 'POST') return reply(res, 405, { error: 'method_not_allowed' });
  try {
    app();
    const identity = await verify(req);
    const uid = identity.uid; // Never accept UID/email from request body.
    const body = req.body || {};
    const action = String(body.action || '');
    const deviceId = String(body.deviceId || '').slice(0, 160);
    const deviceName = String(body.deviceName || 'Perangkat').slice(0, 100);
    if (!['claim', 'heartbeat', 'release'].includes(action)) return reply(res, 400, { error: 'invalid_action' });
    if (!deviceId || !/^[\w.-]+$/.test(deviceId)) return reply(res, 400, { error: 'invalid_device_id' });
    const ref = admin.database().ref('device_lock/' + uid);
    const now = Date.now();
    if (action === 'release') {
      const tx = await ref.transaction(current => current && current.deviceId === deviceId ? null : current);
      const released = tx.committed && tx.snapshot.val() === null;
      return reply(res, 200, { ok: true, released });
    }
    const tx = await ref.transaction(current => {
      const stale = !current || !Number(current.lastSeen) || now - Number(current.lastSeen) > LEASE_MS;
      if (stale || current.deviceId === deviceId) {
        return { deviceId, deviceName, loginAt: current && current.deviceId === deviceId ? (Number(current.loginAt) || now) : now, lastSeen: now };
      }
      return; // Abort if another device owns a live lease.
    });
    const current = tx.snapshot.val();
    if (tx.committed && current && current.deviceId === deviceId) return reply(res, 200, { ok: true, active: true, lastSeen: current.lastSeen });
    return reply(res, 409, { ok: false, active: false, msg: 'Akun ini sedang aktif di perangkat lain. Logout dari perangkat tersebut atau tunggu sesi kedaluwarsa.' });
  } catch (error) {
    console.error('device-lock endpoint:', error);
    return reply(res, error.status || 500, { error: error.status === 401 ? 'unauthorized' : 'device_lock_unavailable' });
  }
};
