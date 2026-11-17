import i18n from '@/src/i18n';

/** Códigos de interesse que a IA e as regras da empresa gravam (intent:, product:, category:…) e que têm texto traduzido. */
const KNOWN = new Set([
  'intent:medical_consult', 'intent:esthetic_consult', 'intent:application', 'intent:price_check', 'intent:availability', 'intent:booking',
  'intent:followup', 'intent:product_info', 'intent:price_comparison', 'intent:cancel',
  'product:vitamin_d', 'product:b12', 'product:vitamin_c', 'product:vitamin_e', 'product:b_complex', 'product:glutathione', 'product:nad_nadh',
  'product:peptides', 'product:bioglucose', 'product:coenzyme_q10', 'product:ala', 'product:vitamin_c_iv', 'product:omega3', 'product:magnesium',
  'product:zinc', 'product:probiotic', 'product:collagen', 'product:creatine', 'product:melatonin', 'product:folate', 'product:iron',
  'product:vitamin_k2', 'product:energy_support', 'product:immune_support', 'product:anti_aging', 'product:weight_management',
  'product:body_composition', 'product:hormone_therapy', 'product:pain_support',
  'category:vitamins', 'category:injectable', 'category:hair_loss', 'category:beauty', 'category:elder_care',
  'lifecycle:returning_patient', 'source:referral', 'service:sus', 'service:private', 'priority:high',
]);

/** "vitamin_d" → "Vitamin D": o que sobra quando o código não tem tradução. */
const humanize = (token: string) => token.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * Texto para o código de interesse: traduzido no idioma do app quando conhecido; senão a parte depois dos dois-pontos,
 * sem sublinhado. Nunca mostra o código cru (`intent:booking`) para a pessoa.
 */
export function interestLabel(code: string | null | undefined): string {
  const c = (code ?? '').trim();
  if (!c) return '';
  if (KNOWN.has(c)) return i18n.t(`attendance:interest.${c.replace(':', '_')}` as 'attendance:interest.intent_booking');
  const idx = c.indexOf(':');
  return idx === -1 ? c : humanize(c.slice(idx + 1));
}
