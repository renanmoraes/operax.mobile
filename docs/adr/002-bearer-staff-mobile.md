# ADR 002 — Bearer para staff mobile

## Decisão

Estender JWT strategy para aceitar `Authorization: Bearer` além de cookies; login mobile devolve tokens no JSON.

## Motivo

Cookies httpOnly são frágeis em RN; mesma política de `sid`/revogação.
