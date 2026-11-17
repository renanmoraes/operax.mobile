import { Field } from '@/src/design-system/ui';
import { brl } from './format';

/** Campo de valor em reais que guarda centavos: cada dígito digitado entra pela direita ("1" "5" "0" → R$ 1,50). */
export function MoneyField({ label, cents, onChange, hint }: { label: string; cents: number; onChange: (cents: number) => void; hint?: string }) {
  return (
    <Field
      label={label}
      value={cents > 0 ? brl(cents) : ''}
      placeholder={hint ?? brl(0)}
      keyboardType="number-pad"
      onChangeText={(raw) => {
        const digits = raw.replace(/\D/g, '').slice(0, 11);
        onChange(digits ? Number(digits) : 0);
      }}
    />
  );
}
