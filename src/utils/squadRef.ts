export const toAlphanumeric = (value: string): string => value.replace(/[^a-zA-Z0-9]/g, '');

export const buildSquadRef = (prefix: string, ...parts: Array<string | number>): string => {
  const timestamp = Date.now().toString();
  const cleanPrefix = toAlphanumeric(prefix);
  const cleanParts = parts.map((part) => toAlphanumeric(String(part))).join('');
  return `${cleanPrefix}${cleanParts}${timestamp}`;
};
