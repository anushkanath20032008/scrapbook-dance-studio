import { formatDay } from "@/lib/format";
import { formatRupees } from "@/lib/money";
import { todayInIndia } from "@/lib/validators";

export type ReminderRow = {
  charge_id: string;
  student_name: string;
  /** Who the number belongs to. When it is not the dancer (a parent), the message is addressed to them. */
  guardian_name?: string | null;
  phone: string | null;
  outstanding_paise: number;
  due_on: string;
};

/** The reminder wording used for WhatsApp tap-to-send. */
export function reminderText(
  row: Pick<ReminderRow, "student_name" | "outstanding_paise" | "due_on"> & {
    guardian_name?: string | null;
  },
  studioName = "",
  today: string = todayInIndia(),
  payLink: string | null = null,
): string {
  const from = studioName.trim() ? ` from ${studioName.trim()}` : "";
  // A fee that is not late yet "is due"; one past its date "was due".
  const tail = payLink ? `\n\nPaid already? Tell us here: ${payLink}` : "";
  const verb = row.due_on < today ? "was due on" : "is due on";
  const guardian = (row.guardian_name ?? "").trim();
  const forParent =
    guardian !== "" && guardian.toLowerCase() !== row.student_name.trim().toLowerCase();
  const who = forParent ? guardian : row.student_name;
  const fee = forParent ? `${row.student_name}'s fee` : "your fee";
  return `Hi ${who}, a reminder${from}: ${fee} of ${formatRupees(row.outstanding_paise)} ${verb} ${formatDay(row.due_on)}. Thank you!${tail}`;
}

/** A wa.me link with the reminder filled in, or null when the number cannot be used. */
export function whatsappLink(
  row: ReminderRow,
  studioName = "",
  payLink: string | null = null,
): string | null {
  const digits = (row.phone ?? "").replace(/\D/g, "");
  const international =
    digits.length === 10
      ? `91${digits}`
      : digits.length === 11 && digits.startsWith("0")
        ? `91${digits.slice(1)}`
        : digits.length >= 11 && digits.length <= 15
          ? digits
          : null;
  if (!international) return null;
  return `https://wa.me/${international}?text=${encodeURIComponent(reminderText(row, studioName, todayInIndia(), payLink))}`;
}

const KEY = "choreo-manual-reminders";

type Store = Pick<Storage, "getItem" | "setItem">;

function browserStore(): Store | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** The charges the owner has already opened a WhatsApp reminder for today. Kept on this device only. */
export function remindedToday(today: string, store: Store | null = browserStore()): Set<string> {
  try {
    const parsed = JSON.parse(store?.getItem(KEY) ?? "null") as {
      date?: string;
      ids?: string[];
    } | null;
    return parsed?.date === today && Array.isArray(parsed.ids) ? new Set(parsed.ids) : new Set();
  } catch {
    return new Set();
  }
}

export function markReminded(
  chargeId: string,
  today: string,
  store: Store | null = browserStore(),
) {
  const ids = remindedToday(today, store);
  ids.add(chargeId);
  try {
    store?.setItem(KEY, JSON.stringify({ date: today, ids: [...ids] }));
  } catch {
    // Private mode or a full disk: the reminder still opened, it just is not remembered.
  }
  return ids;
}
