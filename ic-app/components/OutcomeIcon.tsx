import SymbolIcon from "@/components/SymbolIcon";
import type { CheckInOutcome } from "@/lib/attendance";
import theme from "@/theme";

type Props = {
  outcome: CheckInOutcome;
  size?: number;
};

/**
 * The one icon-and-color pairing for a check-in result, shared by the QR
 * scanner, the NFC reader and the manual list so feedback reads the same.
 */
export default function OutcomeIcon({ outcome, size = 22 }: Props) {
  switch (outcome) {
    case "success":
      return (
        <SymbolIcon
          name="checkmark.circle.fill"
          fallback="checkmark-circle"
          size={size}
          color={theme.colors.primaryBlue}
        />
      );
    case "duplicate":
      return (
        <SymbolIcon
          name="checkmark.circle"
          fallback="checkmark-circle-outline"
          size={size}
          color={theme.colors.labelSecondary}
        />
      );
    case "rejected":
    case "failed":
    default:
      return (
        <SymbolIcon
          name="exclamationmark.circle.fill"
          fallback="alert-circle"
          size={size}
          color={theme.colors.destructive}
        />
      );
  }
}
