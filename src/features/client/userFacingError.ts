/** Erro criado de propósito pelo app, com texto já traduzido pronto para a pessoa ler. */
export class UserFacingError extends Error {
  readonly userFacing = true;
}
