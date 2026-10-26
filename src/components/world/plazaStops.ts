export const PLAZA_STOPS = [
  { id: "about", number: "01", label: "Fountain", title: "Meet Nicolas", position: [-6, 4, 3], size: [8, 5, 8] },
  { id: "projects", number: "02", label: "Project gallery", title: "Selected work", position: [-6, 9.5, -15], size: [21, 11, 7] },
  { id: "experience", number: "03", label: "The loggia", title: "Experience", position: [-19.2, 6, 2], size: [5, 9, 21] },
  { id: "skills", number: "04", label: "Canal workshop", title: "Capabilities", position: [19, 8, -2.2], size: [6, 9, 14] },
  { id: "contact", number: "05", label: "The landing", title: "Get in touch", position: [0, 2, 28], size: [14, 6, 13] },
] as const;
export type PlazaStop = typeof PLAZA_STOPS[number]["id"];
