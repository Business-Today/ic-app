import type { ReactNode } from "react";

import QrScanContent, {
  type MyCode,
  type ScanEvent,
} from "@/components/QrScanContent";
import RevealLayer from "@/components/RevealLayer";

export type { MyCode, ScanEvent };

type Props = {
  open: boolean;
  onClose: () => void;
  /** Omit to pause scanning while keeping the camera on. */
  onBarcodeScanned?: (event: ScanEvent) => void;
  title?: string;
  hint?: string;
  footer?: ReactNode;
  /** Enables the NFC tab; mounted only while that tab is showing. */
  nfc?: ReactNode;
  /** Enables the Scan / My Code switch. */
  myCode?: MyCode;
  /** The interface that slides down to reveal the camera. */
  children: ReactNode;
};

/**
 * A full-screen QR scanner that lives behind the interface it wraps.
 */
export default function ScannerLayer({
  open,
  onClose,
  onBarcodeScanned,
  title,
  hint,
  footer,
  nfc,
  myCode,
  children,
}: Props) {
  return (
    <RevealLayer
      open={open}
      onClose={onClose}
      renderContent={(layout) => (
        <QrScanContent
          layout={layout}
          active={open}
          onBarcodeScanned={onBarcodeScanned}
          title={title}
          hint={hint}
          footer={footer}
          nfc={nfc}
          myCode={myCode}
        />
      )}
    >
      {children}
    </RevealLayer>
  );
}
