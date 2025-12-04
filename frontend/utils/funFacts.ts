// Fun facts about photography, image editing, and technology
export const funFacts = [
  "Adobe Photoshop, the industry-standard photo editing software, was first released commercially in 1990 exclusively for Macintosh computers",
  "The world's largest camera collection belongs to Dilish Parekh of Mumbai. He owns approximately 4,500 cameras!",
  "According to Guinness, the world's longest photo negative is over 260 feet long!",
  "The first known manipulated photograph dates back to the 1840s, a self-portrait where Hippolyte Bayard faked his own drowning",
  "The first digital camera (1975) was built by Kodak engineer Steven Sasson. It weighed 8 pounds and recorded images onto a cassette tape.",
  "The first non-linear editing system (1960s), called the CMX 600, used magnetic disks instead of film reels.",
  "The word 'pixel' is a mash-up of 'Pix' (a slang term for pictures) and 'el' (for element). It was first coined in 1965 by scientists at NASA's Jet Propulsion Laboratory to describe the tiny dots that made up moon and planet scans.",
  "One of the most famous early examples is a portrait of Abraham Lincoln that is actually his head pasted onto the body of politician John Calhoun.",
  "The world's first photograph took 8 hours to expose! It was taken by Joseph Nicephore Niepce in 1826, using a process called heliography",
];

/**
 * Get a random fun fact
 * @returns A random fun fact string
 */
export const getRandomFunFact = (): string => {
  const randomIndex = Math.floor(Math.random() * funFacts.length);
  return funFacts[randomIndex];
};

