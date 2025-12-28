export interface PageData {
  html: string;
  metadata: Record<string, string | string[]>;
  cssClasses: string[];
  cssInfo?: {
    totalStylesheets: number;
    totalInlineStyles: number;
    blockedStylesheets: number;
    extractedCSS: string;
  };
  imageInfo?: {
    totalImages: number;
    totalSVGs: number;
    imagesWithDimensions: number;
    imagesAdded: number;
    svgsWithDimensions: number;
    svgsAdded: number;
  };
  visibilityInfo?: {
    totalElements: number;
    hiddenElements: number;
    invisibleElements: number;
    zeroOpacityElements: number;
    offscreenElements: number;
    visiblePercentage: number;
  };
}

