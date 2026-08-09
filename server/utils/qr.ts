import QRCode from 'qrcode';

export async function qrToDataUrl(raw: string, width = 300): Promise<string> {
  return QRCode.toDataURL(raw, { width, margin: 1 });
}
