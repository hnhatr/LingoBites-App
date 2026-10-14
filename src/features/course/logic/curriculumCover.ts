import {type CoverGlyph, topicGlyph} from '@ui/components/LibraryCover';

/** Vietnamese words in a course, unit or lesson title and their icon. */
const VI_GLYPHS: ReadonlyArray<[RegExp, CoverGlyph]> = [
  [
    /du lịch|sân bay|nhập cảnh|máy bay|chuyến bay|taxi|grab|khách sạn|hỏi đường/,
    'plane',
  ],
  [/nhà hàng|quán|cà phê|món ăn|ăn uống|gọi món|đồ uống/, 'food'],
  [/mua sắm|cửa hàng|chợ|trả giá|thanh toán/, 'bag'],
  [/giao tiếp|chào hỏi|làm quen|bạn bè|gia đình|trò chuyện/, 'chat'],
  [/công việc|văn phòng|phỏng vấn|đồng nghiệp|họp/, 'work'],
  [/sức khỏe|bác sĩ|bệnh|thể thao|cảm xúc/, 'heart'],
  [/hằng ngày|thói quen|ở nhà/, 'home'],
  [/trường|lớp học/, 'school'],
];

/**
 * The icon on a curriculum default cover, guessed from its title (and
 * description): Vietnamese topic words first, then English ones, else a book.
 */
export function curriculumGlyph(
  ...texts: Array<string | null | undefined>
): CoverGlyph {
  const text = texts.filter(Boolean).join(' ').toLowerCase();
  const vi = VI_GLYPHS.find(([pattern]) => pattern.test(text))?.[1];
  if (vi) return vi;
  const en = topicGlyph(text);
  return en === 'cards' ? 'book' : en;
}
