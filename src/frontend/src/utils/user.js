import { collaborators } from "../data/mockData.js";

export function normalize(value) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

export function slugify(firstName, lastName) {
  return `${normalize(firstName)}-${normalize(lastName)}`.replace(/\s+/g, "-");
}

export function findCollaboratorBySlug(slug) {
  return collaborators.find((c) => slugify(c.firstName, c.lastName) === slug);
}
