let latestQr: string | null = null;

export const setLatestQr = (qr: string) => {
  latestQr = qr;
};

export const getLatestQr = (): string | null => latestQr;

export default { setLatestQr, getLatestQr };
