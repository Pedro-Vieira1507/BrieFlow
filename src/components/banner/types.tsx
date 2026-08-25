export type ObjectFit = 'contain' | 'cover';

export type BackgroundShape = 'blob' | 'diagonal' | 'curve' | 'solid';

export interface Position {
  x: number;
  y: number;
}

export interface BannerTextBlock {
  id: string;
  text: string;
  pos: Position;
  fontSize: number;
  fontWeight: number;
  color: string;
  align: 'left' | 'center' | 'right';
  width: number;
}

export interface BannerImageData {
  id: string;
  src: string;
  pos: Position;
  width: number;
  height: number;
  objectFit: ObjectFit;
  rotation: number;
  zIndex: number;
}

export interface BannerContent {
  backgroundShape: BackgroundShape;
  backgroundColor: string;
  accentColor: string;
  heading: string;
  subheading: string;
  ctaText: string;
  textColor: string;
  productImage: BannerImageData | null;
}
