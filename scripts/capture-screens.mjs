#!/usr/bin/env node
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.EXPO_WEB_URL || 'http://127.0.0.1:8081';
const OUT = path.resolve('screenshots');
fs.mkdirSync(OUT, { recursive: true });

const phone = { width: 390, height: 844, deviceScaleFactor: 2 };

async function settle(page, ms = 700) {
  await page.waitForTimeout(ms);
}

async function shot(page, name) {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log('saved', file);
  return file;
}

async function dismissOverlays(page) {
  for (const label of ['Dismiss', 'Close', '×', 'OK']) {
    const btn = page.getByText(label, { exact: true }).first();
    if (await btn.count()) {
      await btn.click({ force: true }).catch(() => {});
    }
  }
  await page.evaluate(() => {
    document.getElementById('error-overlay')?.remove();
    document.querySelectorAll('[id*="error"]').forEach((el) => {
      if (el.id === 'error-overlay' || el.getAttribute('role') === 'dialog') el.remove();
    });
  }).catch(() => {});
}

async function tapText(page, text) {
  await dismissOverlays(page);
  const el = page.getByText(text, { exact: true }).first();
  await el.waitFor({ state: 'attached', timeout: 10000 });
  await el.click({ force: true });
}

async function go(page, route, expectText) {
  const url = `${BASE}${route.startsWith('/') ? route : `/${route}`}`;
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  await settle(page, 1200);
  await dismissOverlays(page);
  if (expectText) {
    await page.getByText(expectText, { exact: false }).first().waitFor({
      state: 'visible',
      timeout: 15000,
    });
  }
}

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});
const context = await browser.newContext({
  viewport: { width: phone.width, height: phone.height },
  deviceScaleFactor: phone.deviceScaleFactor,
  isMobile: true,
  hasTouch: true,
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
});
const page = await context.newPage();

try {
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.evaluate(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {}
  });
  await page.reload({ waitUntil: 'networkidle', timeout: 120000 });
  await settle(page, 2000);
  await dismissOverlays(page);

  await page.waitForSelector('text=Entrar', { timeout: 60000 });
  await dismissOverlays(page);
  await shot(page, '01-login');

  // MFA (estado visual com campos pré-preenchidos)
  await go(page, '/mfa');
  await settle(page, 600);
  await shot(page, '01b-mfa');

  await go(page, '/login');
  await settle(page, 800);
  await tapText(page, 'Entrar direto (demo)');
  await settle(page, 2000);
  await dismissOverlays(page);
  await page.waitForSelector('text=Atendimento', { timeout: 30000 });
  await shot(page, '02-atendimento');

  const menuBtn = page.getByLabel(/Abrir fila/i).first();
  if (await menuBtn.count()) await menuBtn.click({ force: true });
  await settle(page, 900);
  await shot(page, '03-fila-drawer');
  await page.getByLabel(/Fechar fila/i).first().click({ force: true }).catch(() => {});
  await settle(page, 400);
  await page.getByText('Maria Silva').first().click({ force: true });
  await settle(page, 1000);
  await shot(page, '05-conversa');

  await page.getByLabel('Ações do atendimento').first().click({ force: true });
  await settle(page);
  await shot(page, '06-conversa-acoes');
  await page.keyboard.press('Escape');
  await page.getByText('Cancelar').first().click({ force: true }).catch(() => {});
  await settle(page, 400);

  const attach = page.getByLabel('Anexar mídia').first();
  if (await attach.count()) {
    await attach.click({ force: true });
    await settle(page);
    await shot(page, '07-conversa-anexar');
    await page.keyboard.press('Escape');
    await settle(page, 400);
  }

  await go(page, '/history', 'Histórico');
  await settle(page, 500);
  await shot(page, '04-historico');

  // Contato e demais telas via rota (mock persiste em localStorage)
  await go(page, '/contact/c1', 'Maria Silva');
  await settle(page, 500);
  await shot(page, '08-contato');

  await go(page, '/kanban', 'Kanban');
  await settle(page, 500);
  await shot(page, '09-kanban');

  await go(page, '/agenda', 'Agenda');
  await settle(page, 500);
  await shot(page, '10-agenda');

  await go(page, '/notifications', 'Avisos');
  await settle(page, 500);
  await shot(page, '11-avisos');

  await go(page, '/notification-prefs', 'Notificações push');
  await settle(page, 500);
  await shot(page, '12-prefs-push');

  await go(page, '/more', 'Mais');
  await shot(page, '13b-mais');
  await go(page, '/profile', 'Ana Atendente');
  await settle(page, 500);
  await shot(page, '13-perfil');

  await go(page, '/quick-replies', 'Respostas');
  await settle(page, 500);
  await shot(page, '14-quick-replies');

  await go(page, '/templates', 'Templates');
  await settle(page, 500);
  await shot(page, '15-templates');

  const count = fs.readdirSync(OUT).filter((f) => f.endsWith('.png') && !f.startsWith('99')).length;
  console.log('DONE', count, 'screens');
} catch (err) {
  console.error('CAPTURE_ERROR', err);
  await shot(page, '99-error-state').catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
}
