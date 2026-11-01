import type { ReactNode } from "react";

import QrScanContent, {
  type MyCode,
  type ScanEvent,
  type ScanMode,
} from "@/components/QrScanContent";
import RevealLayer from "@/components/RevealLayer";

export type { MyCode, ScanEvent, ScanMode };

type Props = {
  open: boolean;
  onClose: () => void;
  /** Ignores scanned codes while the layer stays open, e.g. under a sheet. */
  paused?: boolean;
  /** Omit to pause scanning while keeping the camera on. */
  onBarcodeScanned?: (event: ScanEvent) => void;
  title?: string;
  hint?: string;
  footer?: ReactNode;
  /** Enables the Tap tab, showing this over the blurred camera. */
  nfc?: ReactNode;
  /** Enables the My Code tab. */
  myCode?: MyCode;
  /** Control the selected tab from outside. */
  mode?: ScanMode;
  onModeChange?: (mode: ScanMode) => void;
  /** The interface that slides down to reveal the camera. */
  children: ReactNode;
};

/**
 * A full-screen QR scanner that lives behind the interface it wraps.
 */
export default function ScannerLayer({
  open,
  onClose,
  paused = false,
  onBarcodeScanned,
  title,
  hint,
  footer,
  nfc,
  myCode,
  mode,
  onModeChange,
  children,
}: Props) {
  return (
    <RevealLayer
      open={open}
      onClose={onClose}
      renderContent={(layout) => (
        <QrScanContent
          layout={layout}
          active={open && !paused}
          onBarcodeScanned={onBarcodeScanned}
          title={title}
          hint={hint}
          footer={footer}
          nfc={nfc}
          myCode={myCode}
          mode={mode}
          onModeChange={onModeChange}
        />
      )}
    >
      {children}
    </RevealLayer>
  );
}
