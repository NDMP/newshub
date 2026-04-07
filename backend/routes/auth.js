const express  = require('express');
const router   = express.Router();
const nodemailer = require("nodemailer"); // ✅ NEW
const { createClient } = require('@supabase/supabase-js');
const path     = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const BASE_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// ✅ Nodemailer transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── OTP STORE ─────────────────────────────────────────
const otpStore   = new Map();
const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_TRIES  = 3;

function generateOTP() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function storeOTP(email, type, otp) {
  otpStore.set(`${email}:${type}`, {
    otp,
    expiresAt: Date.now() + OTP_TTL_MS,
    attempts: 0
  });
}

function verifyOTPInternal(email, type, input) {
  const key    = `${email.toLowerCase()}:${type}`;
  const record = otpStore.get(key);

  if (!record) return { valid: false, reason: 'OTP not found. Request a new one.' };
  if (Date.now() > record.expiresAt) {
    otpStore.delete(key);
    return { valid: false, reason: 'OTP expired. Request a new one.' };
  }
  if (record.attempts >= MAX_TRIES) {
    otpStore.delete(key);
    return { valid: false, reason: 'Too many attempts. Request a new OTP.' };
  }

  record.attempts++;
  if (record.otp !== String(input).trim()) {
    return { valid: false, reason: `Wrong OTP. ${MAX_TRIES - record.attempts} attempts left.` };
  }

  otpStore.delete(key);
  return { valid: true };
}

// ── EMAIL TEMPLATE ───────────────────────────────────
function generateEmailTemplate(type, email, otp) {
  const name = email.split('@')[0];

  if (type === 'signup') {
    return {
      subject: `🎉 Verify your account — ${otp}`,
      html: `<h2>Welcome ${name}!</h2>
             <p>Your OTP is:</p>
             <h1>${otp}</h1>
             <p>Valid for 5 minutes</p>`
    };
  }

  if (type === 'forgot') {
    return {
      subject: `🔑 Reset Password — ${otp}`,
      html: `<h2>Hello ${name}</h2>
             <p>Reset your password using OTP:</p>
             <h1>${otp}</h1>`
    };
  }

  return {
    subject: `🔐 OTP Code — ${otp}`,
    html: `<h2>Your OTP is ${otp}</h2>`
  };
}

// ── SEND OTP ─────────────────────────────────────────
router.post('/send-otp', async (req, res) => {
  try {
    const { email, type } = req.body;

    if (!email || !type) {
      return res.status(400).json({ error: 'email and type are required' });
    }

    const emailLower = email.toLowerCase().trim();

    const otp = generateOTP();
    storeOTP(emailLower, type, otp);

    const template = generateEmailTemplate(type, emailLower, otp);

    // ✅ SEND EMAIL
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: emailLower,
      subject: template.subject,
      html: template.html,
    });

    console.log(`[Auth] ✅ OTP sent (${type}) → ${emailLower}`);

    res.json({ success: true, message: 'OTP sent!' });

  } catch (err) {
    console.error('[Auth] Email error:', err);
    res.status(500).json({ error: 'Email delivery failed' });
  }
});

// ── VERIFY SIGNUP ────────────────────────────────────
router.post('/verify-signup', async (req, res) => {
  try {
    const { email, password, otp } = req.body;

    if (!email || !password || !otp) {
      return res.status(400).json({ error: 'email, password and otp required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const { valid, reason } = verifyOTPInternal(email, 'signup', otp);
    if (!valid) return res.status(400).json({ error: reason });

    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return res.status(400).json({ error: error.message });

    res.json({
      success: true,
      user: { id: data.user?.id, email: data.user?.email },
      session: data.session
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── VERIFY RESET ─────────────────────────────────────
router.post('/verify-reset', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ error: 'email, otp and newPassword required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const { valid, reason } = verifyOTPInternal(email, 'forgot', otp);
    if (!valid) return res.status(400).json({ error: reason });

    const { data } = await supabase.auth.admin.listUsers();
    const user = data?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());

    if (!user) return res.status(404).json({ error: 'User not found' });

    const { error } = await supabase.auth.admin.updateUserById(user.id, {
      password: newPassword
    });

    if (error) return res.status(400).json({ error: error.message });

    res.json({ success: true, message: 'Password reset successful!' });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;