/**
 * Comportamento do `KeyboardAvoidingView` em todo o app. O Android também usa `padding`: com a tela
 * inteira (edge-to-edge) a janela não encolhe sozinha quando o teclado abre, e o teclado passava por cima
 * do campo (anotações, comentário, painéis de baixo). `undefined` aqui deixava o Android sem proteção.
 */
export const KEYBOARD_BEHAVIOR = 'padding' as const;
