import { contactsFromItems } from "./contacts-from-items";
import {
  fetchItems,
  generateDossier,
  saveHandover,
  type Handover,
} from "./handover";

/**
 * One full generation: read the person's documents and mails, have the model
 * write a sheet from them, and store it.
 *
 * Shared because two screens start it -- the entry page's checklist and the
 * handover page's "Régénérer" -- and both must do exactly the same thing:
 * `/api/dossier/` only generates, so the answer has to be saved, and the
 * contacts (which the model is not asked for) are derived from the mails in
 * the same write.
 *
 * It is slow by nature: every item's content is fetched before the model is
 * called. That is why nothing calls it on a timer.
 */
export async function runGeneration(
  collaboratorId: string,
  ownEmail?: string,
  ownName?: string
): Promise<Handover> {
  const generated = await generateDossier();
  const items = await fetchItems(collaboratorId)
    .then((answer) => answer.items)
    .catch(() => []);

  return saveHandover(collaboratorId, {
    ...generated,
    contacts: contactsFromItems(items, ownEmail, ownName),
  });
}
