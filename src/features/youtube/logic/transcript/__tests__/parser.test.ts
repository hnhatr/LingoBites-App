import {parseManualTranscript} from '../parser';

describe('parseManualTranscript', () => {
  describe('F3 Format - SRT and WebVTT', () => {
    it('parses real SRT format', () => {
      const srt = `
1
00:00:00,000 --> 00:00:02,500
Hello there,
welcome to the video.

2
00:00:02,500 --> 00:00:05,000
Today we are going to learn
something new.
      `;
      const result = parseManualTranscript(srt);
      expect(result).toEqual([
        {
          startMs: 0,
          endMs: 2500,
          text: 'Hello there,\nwelcome to the video.',
        },
        {
          startMs: 2500,
          endMs: 5000,
          text: 'Today we are going to learn\nsomething new.',
        },
      ]);
    });

    it('parses real WebVTT format', () => {
      const vtt = `WEBVTT
Kind: captions
Language: en

00:00:00.000 --> 00:00:02.500
Hello there,
welcome to the video.

00:00:02.500 --> 00:00:05.000
Today we are going to learn
something new.
`;
      const result = parseManualTranscript(vtt);
      expect(result).toEqual([
        {
          startMs: 0,
          endMs: 2500,
          text: 'Hello there,\nwelcome to the video.',
        },
        {
          startMs: 2500,
          endMs: 5000,
          text: 'Today we are going to learn\nsomething new.',
        },
      ]);
    });

    it('ignores extraneous text and empty lines', () => {
      const srt = `
00:00:01,000 --> 00:00:02,000
Line 1

00:00:02,000 --> 00:00:03,000
Line 2
`;
      const result = parseManualTranscript(srt);
      expect(result).toEqual([
        {startMs: 1000, endMs: 2000, text: 'Line 1'},
        {startMs: 2000, endMs: 3000, text: 'Line 2'},
      ]);
    });
  });

  describe('F1 Format - YouTube Panel', () => {
    it('parses alternating timestamp and text lines', () => {
      const f1 = `
0:00
Hello there
0:04
how are you
1:02:05
Wow that is long
      `;
      const result = parseManualTranscript(f1);
      expect(result).toEqual([
        {startMs: 0, endMs: null, text: 'Hello there'},
        {startMs: 4000, endMs: null, text: 'how are you'},
        {startMs: 3725000, endMs: null, text: 'Wow that is long'},
      ]);
    });

    it('handles text spanning multiple lines between timestamps', () => {
      const f1 = `
0:00
Hello there
welcome back
0:04
how are you
      `;
      const result = parseManualTranscript(f1);
      expect(result).toEqual([
        {startMs: 0, endMs: null, text: 'Hello there\nwelcome back'},
        {startMs: 4000, endMs: null, text: 'how are you'},
      ]);
    });
  });

  describe('F2 Format - Inline Timestamp', () => {
    it('parses inline timestamps', () => {
      const f2 = `
0:00 Hello there
0:04 how are you
1:02:05 Wow that is long
      `;
      const result = parseManualTranscript(f2);
      expect(result).toEqual([
        {startMs: 0, endMs: null, text: 'Hello there'},
        {startMs: 4000, endMs: null, text: 'how are you'},
        {startMs: 3725000, endMs: null, text: 'Wow that is long'},
      ]);
    });

    it('handles extra spaces and weirdly formatted timestamps', () => {
      const f2 = `
00:00.123   Hello there
0:04     how are you
      `;
      const result = parseManualTranscript(f2);
      expect(result).toEqual([
        {startMs: 123, endMs: null, text: 'Hello there'},
        {startMs: 4000, endMs: null, text: 'how are you'},
      ]);
    });

    it('handles text spanning multiple lines after an inline timestamp', () => {
      const f2 = `
0:00 Hello there
welcome back
0:04 how are you
      `;
      const result = parseManualTranscript(f2);
      expect(result).toEqual([
        {startMs: 0, endMs: null, text: 'Hello there\nwelcome back'},
        {startMs: 4000, endMs: null, text: 'how are you'},
      ]);
    });
  });

  describe('Edge cases and error handling', () => {
    it('throws TRANSCRIPT_UNPARSABLE when there are no timestamps', () => {
      const invalid = `
Hello there
how are you
      `;
      expect(() => parseManualTranscript(invalid)).toThrowError(
        /TRANSCRIPT_UNPARSABLE/,
      );
    });

    it('throws TRANSCRIPT_UNPARSABLE when the string is empty', () => {
      expect(() => parseManualTranscript('')).toThrowError(
        /TRANSCRIPT_UNPARSABLE/,
      );
      expect(() => parseManualTranscript('   \\n  ')).toThrowError(
        /TRANSCRIPT_UNPARSABLE/,
      );
    });

    it('throws TRANSCRIPT_UNPARSABLE when timestamps are incorrectly formatted', () => {
      const completelyInvalid = `
a:b:c Hello there
      `;
      expect(() => parseManualTranscript(completelyInvalid)).toThrowError(
        /TRANSCRIPT_UNPARSABLE/,
      );
    });

    it('ignores extraneous lines before valid cues', () => {
      const f1 = `
Title of the video
Some description here
0:00
Hello
0:04
World
      `;
      const result = parseManualTranscript(f1);
      expect(result).toEqual([
        {startMs: 0, endMs: null, text: 'Hello'},
        {startMs: 4000, endMs: null, text: 'World'},
      ]);
    });

    it('handles a mix of blank lines everywhere', () => {
      const f2 = `

0:00 Hello

0:04 World

      `;
      const result = parseManualTranscript(f2);
      expect(result).toEqual([
        {startMs: 0, endMs: null, text: 'Hello'},
        {startMs: 4000, endMs: null, text: 'World'},
      ]);
    });
  });
});
