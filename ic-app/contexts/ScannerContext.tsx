import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import ScannerLayer, {
  type MyCode,
  type ScanEvent,
} from "@/components/ScannerLayer";
import { useUser } from "@/contexts/UserContext";

type ScannerOptions = {
  hint?: string;
  onBarcodeScanned: (event: ScanEvent) => void;
};

type ScannerApi = {
  open: (options: ScannerOptions) => void;
  close: () => void;
  isOpen: boolean;
};

const ScannerContext = createContext<ScannerApi | null>(null);

/**
 * Hosts one scanner behind everything it wraps, so opening it lowers the
 * whole interface (tab bar included) rather than a single screen.
 */
export function ScannerProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  // Kept through the closing animation so the hint does not vanish early.
  const [options, setOptions] = useState<ScannerOptions | null>(null);

  const open = useCallback((next: ScannerOptions) => {
    setOptions(next);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const api = useMemo(() => ({ open, close, isOpen }), [open, close, isOpen]);

  const { user } = useUser();
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ");
  const myCode: MyCode | undefined = user?.email
    ? {
        value: user.email,
        name: fullName || undefined,
        subtitle:
          user.groupNumber != null ? `Group ${user.groupNumber}` : undefined,
      }
    : undefined;

  return (
    <ScannerContext.Provider value={api}>
      <ScannerLayer
        open={isOpen}
        onClose={close}
        hint={options?.hint}
        onBarcodeScanned={options?.onBarcodeScanned}
        myCode={myCode}
      >
        {children}
      </ScannerLayer>
    </ScannerContext.Provider>
  );
}

export function useScanner() {
  const context = useContext(ScannerContext);

  if (!context) {
    throw new Error("useScanner must be used inside a ScannerProvider.");
  }

  return context;
}
