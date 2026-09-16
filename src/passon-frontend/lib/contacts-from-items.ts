import type { Item, StoredContact } from "./handover";

/**
 * Key contacts, read off the mails that were summarized.
 *
 * The generator does not produce contacts -- its prompt does not ask for any --
 * so rather than show an invented list, this counts who the person actually
 * corresponded with, most frequent first. Deriving them here keeps the change
 * out of the generation code entirely.
 *
 * Two fields matter, and they are separate on purpose. `subtitle` is the
 * display name (`extraction.py` builds it as `sender.name || sender.email`, so
 * the name wins whenever there is one), and `authorEmail` is the address the
 * same payload carries alongside it. A sender with no address at all is still
 * listed, keyed by name: dropping them would lose a correspondent the person
 * plainly had.
 */
export function contactsFromItems(
  items: Item[],
  /** The logged-in person, left out of their own contacts. */
  excludeEmail?: string
): StoredContact[] {
  const byKey = new Map<string, { name: string; email: string; count: number }>();
  const own = (excludeEmail || "").trim().toLowerCase();

  for (const item of items) {
    if (item.type !== "mail") continue;
    const sender = (item.subtitle || "").trim();
    const declared = (item.authorEmail || "").trim().toLowerCase();
    if (!sender && !declared) continue;

    const angled = sender.match(/^"?(.*?)"?\s*<([^>]+)>$/);
    const email =
      declared ||
      (angled
        ? angled[2].trim().toLowerCase()
        : sender.includes("@")
          ? sender.toLowerCase()
          : "");
    const name = (angled ? angled[1].trim() : sender) || email.split("@")[0];

    // A mail you sent yourself is not one of your contacts.
    if (own && email === own) continue;

    const key = email || name.toLowerCase();
    const existing = byKey.get(key);
    if (existing) {
      existing.count += 1;
      if (!existing.email && email) existing.email = email;
    } else {
      byKey.set(key, { name, email, count: 1 });
    }
  }

  return [...byKey.values()]
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 6)
    .map((contact) => ({
      name: contact.name,
      email: contact.email,
      role: contact.count > 1 ? `${contact.count} échanges` : "1 échange",
    }));
}
