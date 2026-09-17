import type { Item, StoredContact } from "./handover";

/**
 * Key contacts, read off the mails that were summarized.
 *
 * The generator does not produce contacts -- its prompt does not ask for any --
 * so rather than show an invented list, this counts who the person actually
 * corresponded with, most frequent first. Deriving them here keeps the change
 * out of the generation code entirely.
 *
 * Documents count too, through whoever owns them. A colleague who shared a
 * dossier is someone the successor will have to deal with, and as mail leaves
 * the product that ownership becomes the only evidence left of who works on
 * what. Their own documents are skipped, though: a list of yourself is not a
 * list of contacts.
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
  excludeEmail?: string,
  /** Their name, for the items that carry no address to match on. */
  excludeName?: string
): StoredContact[] {
  const byKey = new Map<
    string,
    { name: string; email: string; mails: number; documents: number }
  >();
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

    // Nothing of your own belongs in your own contacts -- neither a mail you
    // sent yourself nor a document you created. The name is checked as well
    // as the address because an upstream payload may carry only one of the
    // two, and matching on the address alone let people appear as their own
    // contact through their own documents.
    if (own && email === own) continue;
    if (ownName && !email && name.toLowerCase() === ownName) continue;

    const key = email || name.toLowerCase();
    const existing = byKey.get(key);
    if (existing) {
      if (item.type === "mail") existing.mails += 1;
      else existing.documents += 1;
      if (!existing.email && email) existing.email = email;
    } else {
      byKey.set(key, {
        name,
        email,
        mails: item.type === "mail" ? 1 : 0,
        documents: item.type === "mail" ? 0 : 1,
      });
    }
  }

  return [...byKey.values()]
    .sort(
      (a, b) =>
        b.mails + b.documents - (a.mails + a.documents) ||
        a.name.localeCompare(b.name)
    )
    .slice(0, 6)
    .map((contact) => ({
      name: contact.name,
      email: contact.email,
      // What the link actually is, rather than one number covering both:
      // "3 échanges" about a document owner would be a claim the data does
      // not support.
      role: describe(contact.mails, contact.documents),
    }));
}

function describe(mails: number, documents: number): string {
  const parts: string[] = [];
  if (mails) parts.push(mails > 1 ? `${mails} échanges` : "1 échange");
  if (documents) {
    parts.push(documents > 1 ? `${documents} dossiers` : "1 dossier");
  }
  return parts.join(" · ");
}
