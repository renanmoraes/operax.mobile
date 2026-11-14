export function hasPermission(permissions: string[] | undefined, required?: string): boolean {
  if (!required) return true;
  return (permissions ?? []).includes(required);
}
