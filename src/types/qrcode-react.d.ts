declare module 'qrcode.react' {
  import { FC } from 'react';
  
  export interface QRCodeSVGProps {
    id?: string;
    value: string;
    size?: number;
    level?: 'L' | 'M' | 'Q' | 'H';
    bgColor?: string;
    fgColor?: string;
    includeMargin?: boolean;
  }
  
  export const QRCodeSVG: FC<QRCodeSVGProps>;
} 