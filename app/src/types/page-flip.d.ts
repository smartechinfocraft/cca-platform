// ============================================================
//  types/page-flip.d.ts
//  Minimal ambient typings for the "page-flip" package — it ships
//  compiled JS only (no .d.ts), so TypeScript needs a hand here.
//  Only the surface actually used by MagazineFlipbook.tsx is typed.
// ============================================================
declare module "page-flip" {
  export interface FlipEventData {
    data: number;
    object: PageFlip;
  }

  export interface PageFlipSettings {
    width: number;
    height: number;
    size?: "fixed" | "stretch";
    minWidth?: number;
    maxWidth?: number;
    minHeight?: number;
    maxHeight?: number;
    drawShadow?: boolean;
    flippingTime?: number;
    usePortrait?: boolean;
    autoSize?: boolean;
    maxShadowOpacity?: number;
    showCover?: boolean;
    mobileScrollSupport?: boolean;
    useMouseEvents?: boolean;
    showPageCorners?: boolean;
    disableFlipByClick?: boolean;
  }

  export class PageFlip {
    constructor(element: HTMLElement, settings: Partial<PageFlipSettings>);
    loadFromImages(images: string[]): void;
    updateFromImages(images: string[]): void;
    flipNext(corner?: "top" | "bottom"): void;
    flipPrev(corner?: "top" | "bottom"): void;
    turnToPage(page: number): void;
    turnToNextPage(): void;
    turnToPrevPage(): void;
    getPageCount(): number;
    getCurrentPageIndex(): number;
    destroy(): void;
    update(): void;
    on(event: "flip" | "changeState" | "init" | "update", callback: (e: FlipEventData) => void): PageFlip;
  }
}