export const PLAZA_STOPS = [
  { id: "about", number: "01", label: "About", title: "About me", landmark: "The fountain", position: [-6, 4, 3], size: [8, 5, 8] },
  { id: "projects", number: "02", label: "Projects", title: "Projects", landmark: "The project gallery", position: [-6, 9.5, -15], size: [21, 11, 7] },
  { id: "experience", number: "03", label: "Experience", title: "Experience", landmark: "The loggia", position: [-19.2, 6, 2], size: [5, 9, 21] },
  { id: "skills", number: "04", label: "Skills", title: "Skills", landmark: "The canal workshop", position: [19, 8, -2.2], size: [6, 9, 14] },
  { id: "contact", number: "05", label: "Contact", title: "Contact", landmark: "The landing", position: [0, 2, 28], size: [14, 6, 13] },
] as const;
export type PlazaStop = typeof PLAZA_STOPS[number]["id"];
