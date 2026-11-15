import { useMemo } from 'react';
import Svg, { Path, Rect } from 'react-native-svg';
import QRCode from 'qrcode';

/** QR desenhado em SVG (sem imagem, sem rede): `qrcode` monta a matriz, aqui vira um caminho só. */
export function QrCode({ value, size = 240, color = '#0c1222', background = '#fff', accessibilityLabel }: { value: string; size?: number; color?: string; background?: string; accessibilityLabel?: string }) {
  const { d, n } = useMemo(() => {
    const qr = QRCode.create(value, { errorCorrectionLevel: 'M' });
    const count = qr.modules.size;
    let path = '';
    for (let y = 0; y < count; y++) for (let x = 0; x < count; x++) if (qr.modules.get(x, y)) path += `M${x + 2} ${y + 2}h1v1h-1z`;
    return { d: path, n: count + 4 };
  }, [value]);
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${n} ${n}`} accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
      <Rect x={0} y={0} width={n} height={n} fill={background} />
      <Path d={d} fill={color} />
    </Svg>
  );
}
