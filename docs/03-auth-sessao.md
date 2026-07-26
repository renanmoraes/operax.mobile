# Auth e sessão

## Web hoje

Cookies httpOnly (`access_token`, `refresh_token`) + `sid` no JWT. Login novo revoga sessão anterior.

## Mobile (alvo)

1. Header `X-Client: operax-mobile` no login
2. Tokens no JSON + `Authorization: Bearer`
3. SecureStore (nunca AsyncStorage plaintext)
4. Copy de login avisa que o desktop será desconectado

## Fase 1

Auth mock em `src/features/auth/AuthContext.tsx` (`Entrar direto` para navegar).
