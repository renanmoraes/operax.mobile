import { useEffect, useState } from 'react';
import { NativeSyntheticEvent, StyleSheet, TextInput, TextInputContentSizeChangeEventData, View } from 'react-native';
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
  accessibilityLabel = 'Mensagem',
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  editable?: boolean;
  accessibilityLabel?: string;
}) {
  const [height, setHeight] = useState(LINE);

  // Depois de enviar, o campo volta para uma linha mesmo que o evento de tamanho não venha.
  useEffect(() => {
    if (!value) setHeight(LINE);
  }, [value]);

  const onSize = (e: NativeSyntheticEvent<TextInputContentSizeChangeEventData>) => {
    const h = Math.ceil(e.nativeEvent.contentSize.height);
    setHeight(Math.max(LINE, Math.min(LINE * MAX_LINES, h)));
  };

  return (
    <View style={[styles.wrap, !editable && { opacity: 0.6 }]}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onContentSizeChange={onSize}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        accessibilityLabel={accessibilityLabel}
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
