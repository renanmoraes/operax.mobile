#!/usr/bin/env node
/**
 * Probe de integração contra API real (local por padrão).
 * Env: API_URL, OPERAX_COMPANY_CODE, OPERAX_EMAIL, OPERAX_PASSWORD
 */
import fs from 'node:fs';

const BASE = (process.env.API_URL || process.env.EXPO_PUBLIC_API_URL || 'http://127.0.0.1:3000').replace(
  /\/$/,
  '',
);
const COMPANY = process.env.OPERAX_COMPANY_CODE || 'OPRX';
const EMAIL = process.env.OPERAX_EMAIL || 'admin@operax.digital';
const PASSWORD = process.env.OPERAX_PASSWORD || 'Admin@12345';

const gaps = [];
const ok = [];

async function req(method, path, { token, body } = {}) {
  const headers = {
    Accept: 'application/json',
    'X-Client': 'operax-mobile',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text.slice(0, 200) };
  }
  return { status: res.status, data };
}

function record(name, status) {
  const pass = status >= 200 && status < 300;
  const row = { name, status, pass };
  (pass ? ok : gaps).push(row);
  console.log(`${pass ? 'OK ' : 'GAP'} ${status} ${name}`);
  return pass;
}

const login = await req('POST', '/api/auth/login', {
  body: { company_code: COMPANY, email: EMAIL, password: PASSWORD },
});
if (!record('login(+tokens)', login.status) || !login.data?.access_token) {
  console.error('Login falhou — abortando probe.');
  console.error(login.data);
  process.exit(1);
}
if (!login.data.refresh_token) {
  gaps.push({ name: 'login returns refresh_token', status: login.status, pass: false });
  console.log('GAP missing refresh_token in JSON');
}

const refresh = await req('POST', '/api/auth/refresh', {
  token: login.data.refresh_token,
  body: { refresh_token: login.data.refresh_token },
});
record('refresh(+tokens)', refresh.status);
const access = refresh.data?.access_token || login.data.access_token;

const checks = [
  ['GET', '/api/auth/me'],
  ['GET', '/api/conversations?limit=5'],
  ['GET', '/api/conversations/my-history?limit=5'],
  ['GET', '/api/conversations/unread-count'],
  ['GET', '/api/notifications?limit=5'],
  ['GET', '/api/quick-replies'],
  ['GET', '/api/templates'],
  ['GET', '/api/kanban/pipelines'],
  ['GET', '/api/contacts?limit=5'],
  ['GET', '/api/queues'],
  // Adicionados com o redesign: chat da equipe, marcações, ações da conversa e agenda
  ['GET', '/api/chat/channels'],
  ['GET', '/api/chat/unread-count'],
  ['GET', '/api/users/search?q=a&limit=5'],
  ['GET', '/api/conversations/pix-keys'],
  ['GET', '/api/scheduling/providers?limit=5'],
  ['GET', '/api/scheduling/services?limit=5'],
];

for (const [method, path] of checks) {
  const r = await req(method, path, { token: access });
  record(`${method} ${path}`, r.status);
}

const device = await req('POST', '/api/auth/device-tokens', {
  token: access,
  body: {
    token: `ExponentPushToken[probe-${Date.now()}]`,
    platform: 'android',
    app_version: '0.1.0',
  },
});
record('POST /api/auth/device-tokens', device.status);

const bookings = await req('GET', '/api/scheduling/bookings?limit=5', { token: access });
if (bookings.status === 403) {
  console.log('NOTE 403 GET /api/scheduling/bookings (plano sem agenda) — tratado na UI');
  ok.push({ name: 'GET /api/scheduling/bookings (plan lock expected)', status: 403, pass: true });
} else {
  record('GET /api/scheduling/bookings', bookings.status);
}

const report = {
  base: BASE,
  email: EMAIL,
  company: COMPANY,
  at: new Date().toISOString(),
  ok: ok.length,
  gaps: gaps.length,
  gapDetails: gaps,
};

fs.mkdirSync('docs', { recursive: true });
const gapLines = gaps.length
  ? gaps.map((g) => `- \`${g.status}\` ${g.name}`).join('\n')
  : 'Nenhum gap bloqueante neste probe.';

fs.writeFileSync(
  'docs/12-api-gaps.md',
  `# Gaps da API (probe automático)

Gerado em ${report.at}

- Base: \`${report.base}\`
- Conta: \`${report.company}\` / \`${report.email}\`
- OK: **${report.ok}**
- Gaps: **${report.gaps}**

${gapLines}

## Notas conhecidas

- Agenda pode retornar **403** se Scheduling não estiver no plano — a tela Agenda trata isso.
- Push real no aparelho exige EAS projectId + FCM/APNs.
`,
);

console.log(`\nSUMMARY ${report.ok} ok / ${report.gaps} gaps`);
if (gaps.length) process.exit(2);
