/**
 * Sample English passages for the "Thử với ví dụ" buttons on Dán text, so a
 * first-time learner can try the flow without finding text of their own.
 * The passages stay English in every locale; only the labels are translated.
 */
export type PasteExample = {
  id: 'menu' | 'message' | 'email';
  labelKey: string;
  text: string;
};

export const PASTE_EXAMPLES: readonly PasteExample[] = [
  {
    id: 'menu',
    labelKey: 'paste.example_menu',
    text: [
      'CAFÉ MENU',
      'Iced latte – smooth espresso poured over cold milk and ice.',
      'Flat white – a velvety double shot with a thin layer of steamed milk.',
      'Almond croissant – buttery, flaky and filled with sweet almond cream.',
      "Ask our barista about today's seasonal special!",
    ].join('\n'),
  },
  {
    id: 'message',
    labelKey: 'paste.example_message',
    text: 'Hey! Are you free this Saturday? I was thinking we could grab lunch near the river and then catch a movie. Let me know what time works for you.',
  },
  {
    id: 'email',
    labelKey: 'paste.example_email',
    text: "Hi Anna, thanks for sending the report. I've reviewed the numbers and left a few comments. Could we schedule a quick call on Thursday to go over the next steps?",
  },
];
