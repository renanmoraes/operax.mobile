import { Ref, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, TextInput, TextInputContentSizeChangeEvent, TextInputInstance, View } from 'react-native';
import { colors, typography } from '@/src/design-system/tokens';

const LINE = 21;
const MAX_LINES = 5;

/**
 * Campo de mensagem do chat: começa com uma linha (barra baixa, mais conversa na tela)
 * e cresce linha a linha com o texto, até 5; depois rola por dentro.
 */
export function ChatInput({
  value,
  onChangeText,
  placeholder,
  editable = true,
  accessibilityLabel,
  inputRef,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  editable?: boolean;
  accessibilityLabel?: string;
  /** Para devolver o foco e pôr o cursor no fim depois de inserir algo (marcação, atalho). */
  inputRef?: Ref<TextInputInstance>;
}) {
  const { t } = useTranslation('inbox');
  const [measured, setHeight] = useState(LINE);
  // Depois de enviar (campo vazio), volta para uma linha mesmo que o evento de tamanho não venha.
  const height = value ? measured : LINE;

  const onSize = (e: TextInputContentSizeChangeEvent) => {
    const h = Math.ceil(e.nativeEvent.contentSize.height);
    setHeight(Math.max(LINE, Math.min(LINE * MAX_LINES, h)));
  };

  return (
    <View style={[styles.wrap, !editable && { opacity: 0.6 }]}>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        onContentSizeChange={onSize}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        accessibilityLabel={accessibilityLabel ?? t('chatUi.inputLabel')}
        editable={editable}
        multiline
        autoComplete="off"
        autoCorrect
        textContentType="none"
        scrollEnabled={height >= LINE * MAX_LINES}
        style={[styles.text, { height }]}
        {...({ rows: 1 } as object)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 22,
    backgroundColor: '#f0f2f5',
  },
  text: {
    fontFamily: typography.fontFamily,
    fontSize: 16,
    lineHeight: LINE,
    color: colors.text,
    padding: 0,
    margin: 0,
    textAlignVertical: 'top',
  },
});

/** Devolve o foco ao campo e coloca o cursor no fim do texto (depois de um setState). */
export function focusAtEnd(input: TextInputInstance | null, text: string) {
  setTimeout(() => {
    input?.focus();
    input?.setSelection?.(text.length, text.length);
  }, 0);
}

