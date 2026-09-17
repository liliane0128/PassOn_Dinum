import type { Item, StoredContact } from "./handover";

/**
 * Key contacts, read off the documents that were summarized.
 *
 * The generator does not produce contacts -- its prompt does not ask for any --
 * so rather than show an invented list, this counts who owns the documents the
 * person works with, most frequent first. Deriving them here keeps the change
 * out of the generation code entirely.
 *
 * Ownership is the whole signal now that the product reads documents only: a
 * colleague who shared a dossier is someone the successor will have to deal
 * with. Their own documents are skipped, though: a list of yourself is not a
 * list of contacts.
 *
 * Two fields matter, and they are separate on purpose. `subtitle` is the
 * display name, and `authorEmail` is the address the backend resolved for that
 * owner (see connectors/README.md -- Drive publishes none of its own). An
 * owner with no address at all is still listed, keyed by name: dropping them
 * would lose a colleague the person plainly works with.
 */
export function contactsFromItems(
  items: Item[],
  /** The logged-in person, left out of their own contacts. */
  excludeEmail?: string,
  /** Their name, for the items that carry no address to match on. */
  excludeName?: string
): StoredContact[] {
  const byKey = new Map<string, { name: string; email: string; documents: number }>();
  const own = (excludeEmail || "").trim().toLowerCase();
  const ownName = (excludeName || "").trim().toLowerCase();

  for (const item of items) {
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

    // Nothing of your own belongs in your own contacts. The name is checked
    // as well as the address because an owner may come back with only one of
    // the two, and matching on the address alone let people appear as their
    // own contact through their own documents.
    if (own && email === own) continue;
    if (ownName && !email && name.toLowerCase() === ownName) continue;

    const key = email || name.toLowerCase();
    const existing = byKey.get(key);
    if (existing) {
      existing.documents += 1;
      if (!existing.email && email) existing.email = email;
    } else {
      byKey.set(key, { name, email, documents: 1 });
    }
  }

  return [...byKey.values()]
    .sort((a, b) => b.documents - a.documents || a.name.localeCompare(b.name))
    .slice(0, 6)
    .map((contact) => ({
      name: contact.name,
      email: contact.email,
      // What the link actually is: how many of the dossiers read belong to
      // them.
      role: contact.documents > 1 ? `${contact.documents} dossiers` : "1 dossier",
    }));
}
