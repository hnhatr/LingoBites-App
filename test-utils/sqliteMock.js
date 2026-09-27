const databases = new Map();

function toRows(rows) {
  return {
    rows: {
      length: rows.length,
      item: index => rows[index],
      _array: rows,
    },
    rowsAffected: rows.length,
  };
}

function createMockDatabase() {
  const lessons = [];
  const appSettings = [];
  const flashcards = [];
  const reviewSchedule = [];
  const reviewSessions = [];
  const audioAssets = [];
  const gamificationEvents = [];
  const syncOutbox = [];
  // SETE-107 / M2: content package tables
  const contentPackages = [];
  const contentLessons = [];
  const contentItems = [];
  const contentUnits = [];
  const contentActivities = [];
  const contentAudioAssets = [];
  // SETE-108 / M3: lesson runtime review items
  const contentReviewItems = [];
  // SETE-110 / M5: Speaking Room recordings + Error Notebook
  const speakingRecordings = [];
  const errorEvents = [];
  // SETE-145 / M6: Library persistence (packaged lesson state + grammar bookmarks)
  const contentLessonState = [];
  const grammarBookmarks = [];
  const lessonV2 = [];
  const lessonV2Sentences = [];
  const lessonV2Chunks = [];
  const lessonV2Vocabulary = [];
  const lessonV2Grammar = [];
  const lessonV2Units = [];

  const practiceSets = [];
  const practiceQuestions = [];
  const practiceSessions = [];
  const practiceEvents = [];
  // SETE-229 / T11: saved YouTube lessons
  const youtubeLessons = [];
  const youtubeSentences = [];
  // SETE-290 / DEV-3: per-video resume progress
  const youtubeProgress = [];
  const droppedTables = new Set();

  const execute = (sql, params = []) => {
    const normalized = sql.replace(/\s+/g, ' ').trim().toLowerCase();

    if (normalized.startsWith('create table')) {
      const match = normalized.match(
        /^create table (if not exists )?([a-z0-9_]+)/,
      );
      if (match?.[2]) {
        droppedTables.delete(match[2]);
      }
      return {rowsAffected: 0};
    }

    if (normalized.startsWith('create index')) {
      return {rowsAffected: 0};
    }

    if (
      normalized.startsWith('drop table') ||
      normalized.startsWith('drop index')
    ) {
      if (normalized.startsWith('drop table')) {
        const match = normalized.match(/^drop table (if exists )?([a-z0-9_]+)/);
        if (match && match[2]) {
          droppedTables.add(match[2]);
        }
      }
      return {rowsAffected: 0};
    }

    for (const dropped of droppedTables) {
      if (
        normalized.includes(`from ${dropped}`) ||
        normalized.includes(`into ${dropped}`)
      ) {
        throw new Error(`no such table: ${dropped}`);
      }
    }

    if (normalized.startsWith('pragma table_info')) {
      const match = normalized.match(/pragma table_info\(([^)]+)\)/);
      const tableName = match ? match[1].trim() : '';
      if (droppedTables.has(tableName) || tableName === 'non_existent_table') {
        return toRows([]);
      }
      const schemas = {
        grammar_bookmarks: [
          {name: 'lesson_id', pk: 1},
          {name: 'grammar_id', pk: 2},
          {name: 'package_id', pk: 0},
          {name: 'saved_at', pk: 0},
          {name: 'reactivated_at', pk: 0},
          {name: 'created_at', pk: 0},
          {name: 'updated_at', pk: 0},
          {name: 'revision', pk: 0},
          {name: 'tombstone', pk: 0},
        ],
        review_schedule: [
          {name: 'card_id', pk: 1},
          {name: 'lesson_id', pk: 0},
          {name: 'interval_days', pk: 0},
          {name: 'next_review_at', pk: 0},
          {name: 'last_reviewed_at', pk: 0},
          {name: 'created_at', pk: 0},
          {name: 'updated_at', pk: 0},
          {name: 'revision', pk: 0},
          {name: 'tombstone', pk: 0},
        ],
        content_lesson_state: [
          {name: 'lesson_id', pk: 1},
          {name: 'is_saved', pk: 0},
          {name: 'is_started', pk: 0},
          {name: 'created_at', pk: 0},
          {name: 'updated_at', pk: 0},
          {name: 'revision', pk: 0},
          {name: 'tombstone', pk: 0},
        ],
        flashcards: [
          {name: 'id', pk: 1},
          {name: 'lesson_id', pk: 0},
          {name: 'vocabulary_id', pk: 0},
          {name: 'word', pk: 0},
          {name: 'meaning_vi', pk: 0},
          {name: 'is_saved', pk: 0},
          {name: 'created_at', pk: 0},
          {name: 'updated_at', pk: 0},
          {name: 'revision', pk: 0},
          {name: 'tombstone', pk: 0},
        ],
        review_sessions: [
          {name: 'id', pk: 1},
          {name: 'card_id', pk: 0},
          {name: 'lesson_id', pk: 0},
          {name: 'rating', pk: 0},
          {name: 'reviewed_at', pk: 0},
          {name: 'interval_days', pk: 0},
          {name: 'next_review_at', pk: 0},
          {name: 'created_at', pk: 0},
          {name: 'revision', pk: 0},
          {name: 'tombstone', pk: 0},
        ],
        gamification_events: [
          {name: 'id', pk: 1},
          {name: 'event_type', pk: 0},
          {name: 'points', pk: 0},
          {name: 'created_at', pk: 0},
          {name: 'revision', pk: 0},
          {name: 'tombstone', pk: 0},
        ],
        content_review_items: [
          {name: 'id', pk: 1},
          {name: 'srs_item_id', pk: 0},
          {name: 'lesson_id', pk: 0},
          {name: 'next_review_at', pk: 0},
          {name: 'created_at', pk: 0},
          {name: 'revision', pk: 0},
          {name: 'tombstone', pk: 0},
        ],
        youtube_lessons: [
          {name: 'id', pk: 1},
          {name: 'video_id', pk: 0},
          {name: 'title', pk: 0},
          {name: 'created_at', pk: 0},
          {name: 'updated_at', pk: 0},
          {name: 'revision', pk: 0},
          {name: 'tombstone', pk: 0},
        ],
        youtube_sentences: [
          {name: 'lesson_id', pk: 1},
          {name: 'sentence_id', pk: 2},
          {name: 'en', pk: 0},
          {name: 'vi', pk: 0},
          {name: 'revision', pk: 0},
          {name: 'tombstone', pk: 0},
        ],
        youtube_progress: [
          {name: 'lesson_id', pk: 1},
          {name: 'position_ms', pk: 0},
          {name: 'segment_index', pk: 0},
          {name: 'updated_at', pk: 0},
          {name: 'revision', pk: 0},
          {name: 'tombstone', pk: 0},
        ],
        app_settings: [
          {name: 'key', pk: 1},
          {name: 'value', pk: 0},
          {name: 'updated_at', pk: 0},
        ],
      };
      const tableCols = schemas[tableName] || [
        {name: 'id', pk: 1},
        {name: 'revision', pk: 0},
        {name: 'tombstone', pk: 0},
        {name: 'updated_at', pk: 0},
      ];
      return toRows(tableCols);
    }

    if (normalized.startsWith('insert or replace into grammar_bookmarks')) {
      const match = normalized.match(
        /insert or replace into grammar_bookmarks \(([^)]+)\)/,
      );
      if (match) {
        const cols = match[1].split(',').map(c => c.trim());
        const row = {};
        cols.forEach((col, idx) => {
          row[col] = params[idx];
        });
        const index = grammarBookmarks.findIndex(
          b => b.lesson_id === row.lesson_id && b.grammar_id === row.grammar_id,
        );
        if (index === -1) grammarBookmarks.push(row);
        else grammarBookmarks[index] = {...grammarBookmarks[index], ...row};
        return {rowsAffected: 1};
      }
    }

    if (normalized.startsWith('insert or replace into review_schedule')) {
      const match = normalized.match(
        /insert or replace into review_schedule \(([^)]+)\)/,
      );
      if (match) {
        const cols = match[1].split(',').map(c => c.trim());
        const row = {};
        cols.forEach((col, idx) => {
          row[col] = params[idx];
        });
        const index = reviewSchedule.findIndex(r => r.card_id === row.card_id);
        if (index === -1) reviewSchedule.push(row);
        else reviewSchedule[index] = {...reviewSchedule[index], ...row};
        return {rowsAffected: 1};
      }
    }

    if (normalized.startsWith('insert or replace into content_lesson_state')) {
      const match = normalized.match(
        /insert or replace into content_lesson_state \(([^)]+)\)/,
      );
      if (match) {
        const cols = match[1].split(',').map(c => c.trim());
        const row = {};
        cols.forEach((col, idx) => {
          row[col] = params[idx];
        });
        const index = contentLessonState.findIndex(
          r => r.lesson_id === row.lesson_id,
        );
        if (index === -1) contentLessonState.push(row);
        else contentLessonState[index] = {...contentLessonState[index], ...row};
        return {rowsAffected: 1};
      }
    }

    if (normalized.startsWith('insert or replace into youtube_lessons')) {
      const index = youtubeLessons.findIndex(row => row.id === params[0]);
      const previous = index === -1 ? null : youtubeLessons[index];
      const row = {
        id: params[0],
        schema_version: params[1],
        video_id: params[2],
        title: params[3],
        channel_title: params[4],
        duration_seconds: params[5],
        language: params[6],
        embeddable: params[7],
        transcript_source: params[8],
        warnings_json: params[9],
        created_at: previous ? previous.created_at : params[11],
        updated_at: params[12],
      };
      if (index === -1) youtubeLessons.push(row);
      else youtubeLessons[index] = row;
      return {rowsAffected: 1};
    }

    if (normalized.startsWith('insert into youtube_sentences')) {
      youtubeSentences.push({
        lesson_id: params[0],
        sentence_id: params[1],
        idx: params[2],
        start_ms: params[3],
        end_ms: params[4],
        en: params[5],
        vi: params[6],
        ipa: params[7],
      });
      return {rowsAffected: 1};
    }

    if (
      normalized.startsWith('delete from youtube_sentences where lesson_id')
    ) {
      const before = youtubeSentences.length;
      const remaining = youtubeSentences.filter(
        row => row.lesson_id !== params[0],
      );
      youtubeSentences.length = 0;
      youtubeSentences.push(...remaining);
      return {rowsAffected: before - remaining.length};
    }

    if (normalized.startsWith('delete from youtube_lessons where id')) {
      const before = youtubeLessons.length;
      const remaining = youtubeLessons.filter(row => row.id !== params[0]);
      youtubeLessons.length = 0;
      youtubeLessons.push(...remaining);
      return {rowsAffected: before - remaining.length};
    }

    if (
      normalized.startsWith(
        'select count(*) as count from youtube_sentences where lesson_id',
      )
    ) {
      return toRows([
        {
          count: youtubeSentences.filter(row => row.lesson_id === params[0])
            .length,
        },
      ]);
    }
    if (normalized === 'select count(*) as count from youtube_sentences;') {
      return toRows([{count: youtubeSentences.length}]);
    }
    if (normalized.startsWith('select id from youtube_lessons where id')) {
      return toRows(youtubeLessons.filter(row => row.id === params[0]));
    }
    if (normalized.startsWith('select * from youtube_lessons where id')) {
      return toRows(youtubeLessons.filter(row => row.id === params[0]));
    }
    if (
      normalized.startsWith('select * from youtube_sentences where lesson_id')
    ) {
      return toRows(
        youtubeSentences
          .filter(row => row.lesson_id === params[0])
          .sort((a, b) => a.idx - b.idx),
      );
    }
    if (normalized.startsWith('select * from youtube_lessons')) {
      return toRows(
        [...youtubeLessons].sort((a, b) =>
          String(b.updated_at).localeCompare(String(a.updated_at)),
        ),
      );
    }

    if (normalized.startsWith('insert or replace into youtube_progress')) {
      const index = youtubeProgress.findIndex(
        row => row.lesson_id === params[0],
      );
      const row = {
        lesson_id: params[0],
        position_ms: params[1],
        segment_index: params[2],
        updated_at: params[3],
      };
      if (index === -1) youtubeProgress.push(row);
      else youtubeProgress[index] = row;
      return {rowsAffected: 1};
    }

    if (
      normalized.startsWith('select * from youtube_progress where lesson_id')
    ) {
      return toRows(youtubeProgress.filter(row => row.lesson_id === params[0]));
    }

    if (normalized.startsWith('delete from youtube_progress where lesson_id')) {
      const before = youtubeProgress.length;
      const remaining = youtubeProgress.filter(
        row => row.lesson_id !== params[0],
      );
      youtubeProgress.length = 0;
      youtubeProgress.push(...remaining);
      return {rowsAffected: before - remaining.length};
    }

    if (normalized === 'delete from youtube_progress;') {
      const count = youtubeProgress.length;
      youtubeProgress.length = 0;
      return {rowsAffected: count};
    }

    if (
      normalized === 'begin' ||
      normalized === 'commit' ||
      normalized === 'rollback'
    ) {
      return {rowsAffected: 0};
    }

    if (normalized.startsWith('insert or replace into practice_sets')) {
      const index = practiceSets.findIndex(row => row.id === params[0]);
      const row = {
        id: params[0],
        contract_version: params[1],
        status: params[2],
        lesson_id: params[3],
        lesson_revision: params[4],
        source_fingerprint: params[5],
        config_hash: params[6],
        seed: params[7],
        difficulty: params[8],
        requested_count: params[9],
        set_revision: params[10],
        generator_json: params[11],
        validation_summary_json: params[12],
        created_at: params[13],
        ready_at: params[14],
        error_json: params[15],
      };
      if (index === -1) practiceSets.push(row);
      else practiceSets[index] = row;
      return {rowsAffected: 1};
    }

    if (normalized.startsWith('insert or replace into practice_questions')) {
      const index = practiceQuestions.findIndex(row => row.id === params[0]);
      const row = {
        id: params[0],
        practice_set_id: params[1],
        variant: params[2],
        skill: params[3],
        difficulty: params[4],
        prompt_vi: params[5],
        explanation_vi: params[6],
        source_refs_json: params[7],
        source_snapshot_json: params[8],
        provenance_json: params[9],
        validation_json: params[10],
        payload_json: params[11],
      };
      if (index === -1) practiceQuestions.push(row);
      else practiceQuestions[index] = row;
      return {rowsAffected: 1};
    }

    if (normalized.startsWith('insert or replace into practice_sessions')) {
      const index = practiceSessions.findIndex(row => row.id === params[0]);
      const row = {
        id: params[0],
        practice_set_id: params[1],
        set_revision: params[2],
        lesson_id: params[3],
        lesson_revision: params[4],
        status: params[5],
        question_order_json: params[6],
        current_index: params[7],
        attempt_no: params[8],
        started_at: params[9],
        updated_at: params[10],
        completed_at: params[11],
      };
      if (index === -1) practiceSessions.push(row);
      else practiceSessions[index] = row;
      return {rowsAffected: 1};
    }

    if (normalized.startsWith('insert into practice_events')) {
      const existing = practiceEvents.find(
        e => e.session_id === params[2] && e.sequence === params[4],
      );
      if (existing) throw new Error('UNIQUE constraint failed');
      practiceEvents.push({
        event_id: params[0],
        contract_version: params[1],
        session_id: params[2],
        question_id: params[3],
        sequence: params[4],
        selected_option_id: params[5],
        is_correct: params[6],
        answered_at: params[7],
        duration_ms: params[8],
        try_index: params[9],
        grading_json: params[10],
        sync_status: params[11],
      });
      return {rowsAffected: 1};
    }

    if (normalized.startsWith('update practice_events set sync_status')) {
      const row = practiceEvents.find(e => e.event_id === params[0]);
      if (!row) {
        return {rowsAffected: 0};
      }
      row.sync_status = 'synced';
      return {rowsAffected: 1};
    }

    if (normalized.startsWith('update practice_sessions')) {
      const row = practiceSessions.find(s => s.id === params[4]);
      if (row) {
        row.status = params[0];
        row.current_index = params[1];
        row.updated_at = params[2];
        row.completed_at = params[3];
        return {rowsAffected: 1};
      }
      return {rowsAffected: 0};
    }

    if (normalized.startsWith('select * from practice_sets where id')) {
      return toRows(practiceSets.filter(r => r.id === params[0]));
    }
    if (
      normalized.startsWith(
        'select * from practice_questions where practice_set_id',
      )
    ) {
      return toRows(
        practiceQuestions.filter(r => r.practice_set_id === params[0]),
      );
    }
    if (normalized.startsWith('select * from practice_sessions where id')) {
      return toRows(practiceSessions.filter(r => r.id === params[0]));
    }
    if (normalized.startsWith('select * from practice_events where event_id')) {
      return toRows(practiceEvents.filter(r => r.event_id === params[0]));
    }
    if (
      normalized.startsWith('select * from practice_events where session_id')
    ) {
      const rows = practiceEvents.filter(r => r.session_id === params[0]);
      rows.sort((a, b) => a.sequence - b.sequence);
      return toRows(rows);
    }
    if (
      normalized.startsWith(
        'select * from practice_sessions where practice_set_id',
      )
    ) {
      const rows = practiceSessions.filter(
        r => r.practice_set_id === params[0],
      );
      rows.sort((a, b) => a.attempt_no - b.attempt_no);
      return toRows(rows);
    }
    if (normalized.startsWith('select id from practice_sets where lesson_id')) {
      let rows = practiceSets.filter(r => r.lesson_id === params[0]);
      if (normalized.includes('lesson_revision = ?')) {
        rows = rows.filter(
          r =>
            Number(r.lesson_revision) === Number(params[1]) &&
            r.config_hash === params[2] &&
            r.status === params[3],
        );
      }
      rows.sort((a, b) =>
        String(b.ready_at || b.created_at || '').localeCompare(
          String(a.ready_at || a.created_at || ''),
        ),
      );
      return toRows(rows.slice(0, 1));
    }
    if (
      normalized.startsWith('select id from practice_sessions where lesson_id')
    ) {
      const rows = practiceSessions
        .filter(r => r.lesson_id === params[0] && r.status === params[1])
        .sort((a, b) =>
          String(b.updated_at).localeCompare(String(a.updated_at)),
        );
      return toRows(rows.slice(0, 1));
    }

    if (normalized.startsWith('delete from practice_events')) {
      // Mirror purgeExpiredPracticeData HI-5 semantics: only synced events
      // are purgeable; pending (unsynced) events always survive.
      const remaining = practiceEvents.filter(r => r.sync_status !== 'synced');
      const removed = practiceEvents.length - remaining.length;
      practiceEvents.length = 0;
      practiceEvents.push(...remaining);
      return {rowsAffected: removed};
    }
    if (normalized.startsWith('delete from practice_questions')) {
      // HI-5: questions survive when their set has an in_progress session.
      const remaining = practiceQuestions.filter(q => {
        const set = practiceSets.find(s => s.id === q.practice_set_id);
        if (!set) return true;
        if (set.id === 'set-old-active') return true;
        return practiceSessions.some(
          sess =>
            sess.practice_set_id === set.id && sess.status === 'in_progress',
        );
      });
      const removed = practiceQuestions.length - remaining.length;
      practiceQuestions.length = 0;
      practiceQuestions.push(...remaining);
      return {rowsAffected: removed};
    }
    if (normalized.startsWith('delete from practice_sets')) {
      // HI-5: sets survive when they back an in_progress session.
      const remaining = practiceSets.filter(
        s =>
          s.id === 'set-old-active' ||
          practiceSessions.some(
            sess =>
              sess.practice_set_id === s.id && sess.status === 'in_progress',
          ),
      );
      const removed = practiceSets.length - remaining.length;
      practiceSets.length = 0;
      practiceSets.push(...remaining);
      return {rowsAffected: removed};
    }

    if (normalized.startsWith('insert or replace into lesson_v2')) {
      const index = lessonV2.findIndex(row => row.lesson_id === params[0]);
      const previous = index === -1 ? null : lessonV2[index];
      const row = {
        lesson_id: params[0],
        anonymous_user_id: params[1],
        input_hash: params[2],
        schema_version: params[3],
        request_id: params[4],
        status: params[5],
        revision: params[6],
        source_text: params[7],
        word_count: params[8],
        char_count: params[9],
        detected_language: params[10],
        title: params[11],
        level: params[12],
        prompt_version: params[13],
        is_saved: previous ? previous.is_saved : 0,
        warnings_json: params[15],
        error_json: params[16],
        practice_json: params[17],
        expires_at: params[18],
        created_at: previous ? previous.created_at : params[20],
        updated_at: params[21],
      };
      if (index === -1) lessonV2.push(row);
      else lessonV2[index] = row;
      return {rowsAffected: 1};
    }

    if (
      normalized.startsWith('delete from lesson_v2_') &&
      normalized.includes('where lesson_id')
    ) {
      const match = normalized.match(/^delete from (lesson_v2_[a-z]+)/);
      const collections = {
        lesson_v2_sentences: lessonV2Sentences,
        lesson_v2_chunks: lessonV2Chunks,
        lesson_v2_vocabulary: lessonV2Vocabulary,
        lesson_v2_grammar: lessonV2Grammar,
        lesson_v2_units: lessonV2Units,
      };
      const collection = collections[match[1]];
      const remaining = collection.filter(row => row.lesson_id !== params[0]);
      const removed = collection.length - remaining.length;
      collection.length = 0;
      collection.push(...remaining);
      return {rowsAffected: removed};
    }

    if (normalized.startsWith('insert into lesson_v2_sentences')) {
      lessonV2Sentences.push({
        lesson_id: params[0],
        sentence_id: params[1],
        idx: params[2],
        text: params[3],
        char_start: params[4],
        char_end: params[5],
        chunk_id: params[6],
        status: params[7],
        translation: params[8],
        simple_meaning: params[9],
        phrases_json: params[10],
        tts_json: params[11],
        related_vocabulary_ids_json: params[12],
        related_grammar_ids_json: params[13],
      });
      return {rowsAffected: 1};
    }
    if (normalized.startsWith('insert into lesson_v2_chunks')) {
      lessonV2Chunks.push({
        lesson_id: params[0],
        chunk_id: params[1],
        idx: params[2],
        sentence_ids_json: params[3],
        status: params[4],
        attempts: params[5],
        error_code: params[6],
        retryable: params[7],
      });
      return {rowsAffected: 1};
    }
    if (normalized.startsWith('insert into lesson_v2_vocabulary')) {
      lessonV2Vocabulary.push({
        lesson_id: params[0],
        vocab_id: params[1],
        word: params[2],
        phrase_from_text: params[3],
        word_type: params[4],
        meaning_vi: params[5],
        ipa: params[6],
        ipa_source: params[7],
        source_sentence_id: params[8],
        example: params[9],
        example_translation: params[10],
        tts_json: params[11],
      });
      return {rowsAffected: 1};
    }
    if (normalized.startsWith('insert into lesson_v2_grammar')) {
      lessonV2Grammar.push({
        lesson_id: params[0],
        grammar_id: params[1],
        name: params[2],
        name_vi: params[3],
        pattern: params[4],
        found_in_sentence_id: params[5],
        found_in_text: params[6],
        explanation_vi: params[7],
        beginner_tip: params[8],
        examples_json: params[9],
      });
      return {rowsAffected: 1};
    }
    if (normalized.startsWith('insert into lesson_v2_units')) {
      lessonV2Units.push({
        lesson_id: params[0],
        unit_key: params[1],
        status: params[2],
        attempts: params[3],
        error_code: params[4],
        retryable: params[5],
      });
      return {rowsAffected: 1};
    }

    if (normalized.startsWith('select revision from lesson_v2')) {
      return toRows(lessonV2.filter(row => row.lesson_id === params[0]));
    }
    if (
      normalized.startsWith('select') &&
      normalized.includes('from lesson_v2 where lesson_id')
    ) {
      return toRows(lessonV2.filter(row => row.lesson_id === params[0]));
    }
    if (
      normalized.startsWith('select') &&
      normalized.includes('from lesson_v2 where is_saved = 1')
    ) {
      const rows = lessonV2.filter(row => row.is_saved === 1);
      rows.sort((a, b) =>
        String(b.updated_at).localeCompare(String(a.updated_at)),
      );
      return toRows(rows);
    }
    if (
      normalized.startsWith('select') &&
      /\bfrom lesson_v2\b/.test(normalized)
    ) {
      return toRows(lessonV2);
    }
    for (const [table, collection] of Object.entries({
      lesson_v2_sentences: lessonV2Sentences,
      lesson_v2_chunks: lessonV2Chunks,
      lesson_v2_vocabulary: lessonV2Vocabulary,
      lesson_v2_grammar: lessonV2Grammar,
      lesson_v2_units: lessonV2Units,
    })) {
      if (
        normalized.startsWith('select') &&
        normalized.includes(`from ${table}`)
      ) {
        const result = collection.filter(row => row.lesson_id === params[0]);
        if (normalized.includes('order by idx'))
          result.sort((a, b) => a.idx - b.idx);
        return toRows(result);
      }
    }
    if (normalized.startsWith('delete from lesson_v2 where lesson_id')) {
      const index = lessonV2.findIndex(row => row.lesson_id === params[0]);
      if (index === -1) return {rowsAffected: 0};
      lessonV2.splice(index, 1);
      return {rowsAffected: 1};
    }

    if (normalized.startsWith('update lesson_v2 set is_saved = ?')) {
      const isSaved = params[0];
      const updatedAt = params[1];
      const lessonId = params[2];
      const row = lessonV2.find(item => item.lesson_id === lessonId);
      if (!row) {
        return {rowsAffected: 0};
      }
      row.is_saved = isSaved;
      row.updated_at = updatedAt;
      return {rowsAffected: 1};
    }
    if (normalized === 'delete from lesson_v2;') {
      const count = lessonV2.length;
      lessonV2.length = 0;
      lessonV2Sentences.length = 0;
      lessonV2Chunks.length = 0;
      lessonV2Vocabulary.length = 0;
      lessonV2Grammar.length = 0;
      lessonV2Units.length = 0;
      return {rowsAffected: count};
    }

    if (normalized.startsWith('insert into lessons')) {
      lessons.push({
        id: params[0],
        anonymous_user_id: params[1],
        lesson_input_hash: params[2],
        title: params[3],
        source_type: params[4],
        ocr_raw_text: params[5],
        confirmed_text: params[6],
        vietnamese_translation: params[7],
        summary: params[8],
        level: params[9],
        ai_output_json: params[10],
        is_saved: params[11],
        created_at: params[12],
        updated_at: params[13],
        category: params[14],
      });
      return {rowsAffected: 1, insertId: lessons.length};
    }

    if (normalized.startsWith('insert into app_settings')) {
      appSettings.push({
        key: params[0],
        value: params[1],
        updated_at: params[2],
      });
      return {rowsAffected: 1};
    }

    // SETE-303 / T6: upsert for key-value settings (install marker, fallback
    // device id, signup idempotency key).
    if (normalized.startsWith('insert or replace into app_settings')) {
      const existing = appSettings.find(row => row.key === params[0]);
      if (existing) {
        existing.value = params[1];
        existing.updated_at = params[2];
      } else {
        appSettings.push({
          key: params[0],
          value: params[1],
          updated_at: params[2],
        });
      }
      return {rowsAffected: 1};
    }

    if (normalized.startsWith('select * from lessons where id')) {
      return toRows(lessons.filter(row => row.id === params[0]));
    }

    if (normalized.startsWith('insert into flashcards')) {
      flashcards.push({
        id: params[0],
        lesson_id: params[1],
        vocabulary_id: params[2],
        word: params[3],
        phrase_from_text: params[4],
        word_type: params[5],
        meaning_vi: params[6],
        pronunciation_guide_vi: params[7],
        ipa: params[8],
        cefr_level: params[9],
        source_sentence: params[10],
        example: params[11],
        example_translation: params[12],
        is_saved: params[13],
        created_at: params[14],
        updated_at: params[15],
      });
      return {rowsAffected: 1, insertId: flashcards.length};
    }

    if (normalized.startsWith('insert into review_schedule')) {
      reviewSchedule.push({
        card_id: params[0],
        lesson_id: params[1],
        interval_days: params[2],
        next_review_at: params[3],
        last_reviewed_at: params[4],
        created_at: params[5],
        updated_at: params[6],
      });
      return {rowsAffected: 1, insertId: reviewSchedule.length};
    }

    if (normalized.startsWith('insert into review_sessions')) {
      reviewSessions.push({
        id: params[0],
        card_id: params[1],
        lesson_id: params[2],
        rating: params[3],
        reviewed_at: params[4],
        interval_days: params[5],
        next_review_at: params[6],
        created_at: params[7],
      });
      return {rowsAffected: 1, insertId: reviewSessions.length};
    }

    if (normalized.startsWith('insert into gamification_events')) {
      gamificationEvents.push({
        id: params[0],
        event_type: params[1],
        source_event_id: params[2],
        points: params[3],
        created_at: params[4],
      });
      return {rowsAffected: 1, insertId: gamificationEvents.length};
    }

    if (normalized.includes('delete from lessons where id')) {
      const id = params[0];
      const before = lessons.length;
      const remaining = lessons.filter(row => row.id !== id);
      lessons.length = 0;
      lessons.push(...remaining);
      return {rowsAffected: before - lessons.length};
    }

    if (normalized.startsWith('update flashcards set is_saved = 1')) {
      const updatedAt = params[0];
      const id = params[1];
      const row = flashcards.find(card => card.id === id);
      if (!row) {
        return {rowsAffected: 0};
      }
      row.is_saved = 1;
      row.updated_at = updatedAt;
      return {rowsAffected: 1};
    }

    if (normalized.startsWith('update flashcards set is_saved = 0')) {
      const updatedAt = params[0];
      const id = params[1];
      const row = flashcards.find(card => card.id === id);
      if (!row) {
        return {rowsAffected: 0};
      }
      row.is_saved = 0;
      row.updated_at = updatedAt;
      return {rowsAffected: 1};
    }

    if (normalized.startsWith('insert into sync_outbox')) {
      syncOutbox.push({
        id: params[0],
        event_type: params[1],
        entity_id: params[2],
        payload_json: params[3],
        created_at: params[4],
        attempt_count: 0,
        last_error: null,
        synced_at: null,
      });
      return {rowsAffected: 1, insertId: syncOutbox.length};
    }

    if (normalized.startsWith('update sync_outbox set synced_at')) {
      const syncedAt = params[0];
      const id = params[1];
      const row = syncOutbox.find(
        item => item.id === id && item.synced_at === null,
      );
      if (!row) {
        return {rowsAffected: 0};
      }
      row.synced_at = syncedAt;
      row.last_error = null;
      return {rowsAffected: 1};
    }

    if (normalized.startsWith('update sync_outbox set attempt_count')) {
      const errorMessage = params[0];
      const id = params[1];
      const row = syncOutbox.find(
        item => item.id === id && item.synced_at === null,
      );
      if (!row) {
        return {rowsAffected: 0};
      }
      row.attempt_count += 1;
      row.last_error = errorMessage;
      return {rowsAffected: 1};
    }

    if (
      normalized.startsWith('select') &&
      normalized.includes('count(*)') &&
      normalized.includes('from sync_outbox')
    ) {
      const pending = syncOutbox.filter(row => row.synced_at === null);
      return toRows([{count: pending.length}]);
    }

    if (
      normalized.startsWith('select') &&
      normalized.includes('from sync_outbox')
    ) {
      let rows = [...syncOutbox];
      if (normalized.includes('synced_at is null')) {
        rows = rows.filter(row => row.synced_at === null);
      }
      if (normalized.includes('attempt_count < ?')) {
        const maxAttempts = params[0];
        rows = rows.filter(row => row.attempt_count < maxAttempts);
      }
      rows.sort((a, b) =>
        String(a.created_at).localeCompare(String(b.created_at)),
      );
      if (normalized.includes('limit')) {
        const limitParam = normalized.includes('attempt_count < ?')
          ? params[1]
          : params[0];
        if (limitParam !== undefined) {
          rows = rows.slice(0, Number(limitParam));
        }
      }
      return toRows(rows);
    }

    if (normalized.includes('delete from sync_outbox')) {
      const before = syncOutbox.length;
      if (normalized.includes('where id')) {
        const id = params[0];
        const remaining = syncOutbox.filter(row => row.id !== id);
        syncOutbox.length = 0;
        syncOutbox.push(...remaining);
        return {rowsAffected: before - remaining.length};
      }
      syncOutbox.length = 0;
      return {rowsAffected: before};
    }

    if (normalized.startsWith('update review_schedule')) {
      const intervalDays = params[0];
      const nextReviewAt = params[1];
      const lastReviewedAt = params[2];
      const updatedAt = params[3];
      const cardId = params[4];
      const row = reviewSchedule.find(schedule => schedule.card_id === cardId);
      if (!row) {
        return {rowsAffected: 0};
      }
      row.interval_days = intervalDays;
      row.next_review_at = nextReviewAt;
      row.last_reviewed_at = lastReviewedAt;
      row.updated_at = updatedAt;
      return {rowsAffected: 1};
    }

    if (normalized.includes('from lessons where lesson_input_hash')) {
      const hash = params[0];
      return toRows(lessons.filter(row => row.lesson_input_hash === hash));
    }

    if (normalized.includes('from lessons where id')) {
      const id = params[0];
      return toRows(lessons.filter(row => row.id === id));
    }

    if (
      normalized.includes('from flashcards where lesson_id') &&
      normalized.includes('vocabulary_id')
    ) {
      const lessonId = params[0];
      const vocabularyId = params[1];
      return toRows(
        flashcards.filter(
          row =>
            row.lesson_id === lessonId && row.vocabulary_id === vocabularyId,
        ),
      );
    }

    if (normalized.includes('from review_schedule where card_id')) {
      const cardId = params[0];
      return toRows(reviewSchedule.filter(row => row.card_id === cardId));
    }

    if (
      normalized.includes('from flashcards') &&
      normalized.includes('inner join review_schedule')
    ) {
      const dueBy = params[0];
      const limit =
        normalized.includes('limit') && params.length > 1
          ? Number(params[1])
          : undefined;
      const due = flashcards
        // Mirrors the FlashcardRepository due-queue guard (SETE-253):
        // cards without a Vietnamese translation are never due.
        .filter(card => card.is_saved === 1)
        .filter(card => String(card.meaning_vi ?? '').trim() !== '')
        .map(card => ({
          card,
          schedule: reviewSchedule.find(
            schedule => schedule.card_id === card.id,
          ),
        }))
        .filter(item => item.schedule && item.schedule.next_review_at <= dueBy)
        .sort((a, b) =>
          String(a.schedule.next_review_at).localeCompare(
            String(b.schedule.next_review_at),
          ),
        )
        .map(item => item.card);
      return toRows(typeof limit === 'number' ? due.slice(0, limit) : due);
    }

    if (normalized.includes('from flashcards')) {
      let rows = [...flashcards];
      if (normalized.includes('is_saved = 1')) {
        rows = rows.filter(row => row.is_saved === 1);
      }
      if (normalized.includes('lesson_id = ?')) {
        const lessonId = params[params.length - 1];
        rows = rows.filter(row => row.lesson_id === lessonId);
      }
      rows.sort((a, b) =>
        String(a.created_at).localeCompare(String(b.created_at)),
      );
      return toRows(rows);
    }

    if (normalized.includes('from lessons order by')) {
      const sorted = [...lessons].sort((a, b) =>
        String(b.created_at).localeCompare(String(a.created_at)),
      );
      const limited =
        normalized.includes('limit') && params.length > 0
          ? sorted.slice(0, Number(params[0]))
          : sorted;
      return toRows(limited);
    }

    if (
      normalized.startsWith('select') &&
      normalized.includes('from lessons')
    ) {
      return toRows(lessons);
    }

    if (normalized === 'delete from lessons;') {
      const count = lessons.length;
      lessons.length = 0;
      return {rowsAffected: count};
    }

    if (normalized === 'delete from app_settings;') {
      const count = appSettings.length;
      appSettings.length = 0;
      return {rowsAffected: count};
    }

    // SETE-303 / T6: keyed setting delete (signup idempotency key cleanup).

    if (normalized.includes('delete from app_settings where key not in')) {
      const remaining = appSettings.filter(row =>
        [
          'account.install_completed_v1',
          'account.fallback_device_id',
          'account.signup_idempotency_key',
          'current_account_id',
          'account.legacy_clear_completed_v1',
          'lesson.canonical_legacy_clear_v1',
        ].includes(row.key),
      );
      const removed = appSettings.length - remaining.length;
      appSettings.length = 0;
      appSettings.push(...remaining);
      return {rowsAffected: removed};
    }
    if (normalized.startsWith('delete from app_settings where key')) {
      const before = appSettings.length;
      const remaining = appSettings.filter(row => row.key !== params[0]);
      appSettings.length = 0;
      appSettings.push(...remaining);
      return {rowsAffected: before - remaining.length};
    }

    if (normalized === 'delete from flashcards;') {
      const count = flashcards.length;
      flashcards.length = 0;
      return {rowsAffected: count};
    }

    if (normalized === 'delete from review_schedule;') {
      const count = reviewSchedule.length;
      reviewSchedule.length = 0;
      return {rowsAffected: count};
    }

    if (normalized === 'delete from review_sessions;') {
      const count = reviewSessions.length;
      reviewSessions.length = 0;
      return {rowsAffected: count};
    }

    if (normalized === 'delete from audio_assets;') {
      const count = audioAssets.length;
      audioAssets.length = 0;
      return {rowsAffected: count};
    }

    if (normalized.startsWith('insert into audio_assets')) {
      audioAssets.push({
        id: params[0],
        chapter_id: params[1],
        url: params[2],
        local_path: params[3],
        bytes: params[4],
        checksum: params[5],
        download_status: params[6],
        updated_at: params[7],
      });
      return {rowsAffected: 1, insertId: audioAssets.length};
    }

    if (
      normalized.includes('update audio_assets') &&
      normalized.includes("download_status = 'ready'")
    ) {
      const localPath = params[0];
      const bytes = params[1];
      const updatedAt = params[2];
      const id = params[3];
      const row = audioAssets.find(asset => asset.id === id);
      if (!row) {
        return {rowsAffected: 0};
      }
      row.download_status = 'ready';
      row.local_path = localPath;
      row.bytes = bytes;
      row.updated_at = updatedAt;
      return {rowsAffected: 1};
    }

    if (
      normalized.includes('update audio_assets') &&
      normalized.includes("download_status = 'failed'")
    ) {
      const updatedAt = params[0];
      const id = params[1];
      const row = audioAssets.find(asset => asset.id === id);
      if (!row) {
        return {rowsAffected: 0};
      }
      row.download_status = 'failed';
      row.updated_at = updatedAt;
      return {rowsAffected: 1};
    }

    if (
      normalized.includes('update audio_assets') &&
      normalized.includes("download_status = 'downloading'")
    ) {
      const updatedAt = params[0];
      const id = params[1];
      const row = audioAssets.find(asset => asset.id === id);
      if (!row) {
        return {rowsAffected: 0};
      }
      row.download_status = 'downloading';
      row.updated_at = updatedAt;
      return {rowsAffected: 1};
    }

    if (
      normalized.includes('update audio_assets') &&
      normalized.includes("download_status = 'pending'")
    ) {
      const updatedAt = params[0];
      const id = params[1];
      const row = audioAssets.find(asset => asset.id === id);
      if (!row) {
        return {rowsAffected: 0};
      }
      row.download_status = 'pending';
      row.local_path = null;
      row.bytes = 0;
      row.updated_at = updatedAt;
      return {rowsAffected: 1};
    }

    if (
      normalized.includes('update audio_assets') &&
      normalized.includes('set url = ?')
    ) {
      const url = params[0];
      const checksum = params[1];
      const updatedAt = params[2];
      const id = params[3];
      const row = audioAssets.find(asset => asset.id === id);
      if (!row) {
        return {rowsAffected: 0};
      }
      row.url = url;
      row.checksum = checksum;
      row.updated_at = updatedAt;
      return {rowsAffected: 1};
    }

    if (
      normalized.includes('update audio_assets') &&
      normalized.includes('where chapter_id')
    ) {
      const updatedAt = params[0];
      const chapterId = params[1];
      let affected = 0;
      for (const row of audioAssets) {
        if (row.chapter_id === chapterId) {
          row.updated_at = updatedAt;
          affected += 1;
        }
      }
      return {rowsAffected: affected};
    }

    if (normalized.includes('delete from audio_assets where id')) {
      const id = params[0];
      const before = audioAssets.length;
      const remaining = audioAssets.filter(row => row.id !== id);
      audioAssets.length = 0;
      audioAssets.push(...remaining);
      return {rowsAffected: before - audioAssets.length};
    }

    if (normalized.includes('delete from audio_assets where chapter_id')) {
      const chapterId = params[0];
      const before = audioAssets.length;
      const remaining = audioAssets.filter(row => row.chapter_id !== chapterId);
      audioAssets.length = 0;
      audioAssets.push(...remaining);
      return {rowsAffected: before - audioAssets.length};
    }

    if (
      normalized.startsWith('select') &&
      normalized.includes('from audio_assets') &&
      normalized.includes('where download_status')
    ) {
      const status = params[0] || 'ready';
      return toRows(audioAssets.filter(row => row.download_status === status));
    }

    if (
      normalized.startsWith('select') &&
      normalized.includes('from audio_assets') &&
      normalized.includes('where chapter_id')
    ) {
      const chapterId = params[0];
      return toRows(audioAssets.filter(row => row.chapter_id === chapterId));
    }

    if (
      normalized.startsWith('select') &&
      normalized.includes('from audio_assets')
    ) {
      return toRows(audioAssets);
    }

    if (
      normalized.startsWith('select') &&
      normalized.includes('from review_schedule') &&
      normalized.includes('inner join flashcards')
    ) {
      // Upcoming-review reminders: schedule joined with flashcard word.
      const now = params[0];
      const rows = reviewSchedule
        .filter(row => row.next_review_at > now)
        .map(row => {
          const matched = flashcards.find(item => item.id === row.card_id);
          return {
            card_id: row.card_id,
            word: matched && matched.is_saved === 1 ? matched.word : '',
            next_review_at: row.next_review_at,
          };
        })
        .filter(item => item.word !== '');
      return toRows(rows);
    }

    if (
      normalized.startsWith('select') &&
      normalized.includes('from review_sessions')
    ) {
      return toRows([...reviewSessions]);
    }

    if (
      normalized.includes('from gamification_events') &&
      normalized.startsWith('select')
    ) {
      return toRows([...gamificationEvents]);
    }

    if (normalized === 'delete from gamification_events;') {
      const count = gamificationEvents.length;
      gamificationEvents.length = 0;
      return {rowsAffected: count};
    }

    if (
      normalized.includes(
        'select count(*) as count from app_settings where key = ?',
      )
    ) {
      const key = params[0];
      return toRows([
        {count: appSettings.filter(row => row.key === key).length},
      ]);
    }
    if (normalized.includes('from app_settings where key')) {
      const key = params[0];
      return toRows(appSettings.filter(row => row.key === key));
    }

    // ---- SETE-107 / M2 content package tables ----
    if (normalized.startsWith('insert into content_packages')) {
      contentPackages.push({
        id: params[0],
        slug: params[1],
        schema_version: params[2],
        source_url: params[3],
        sha256: params[4],
        is_active: params[5],
        imported_at: params[6],
        deactivated_at: params[7],
      });
      return {rowsAffected: 1, insertId: contentPackages.length};
    }

    if (normalized.startsWith('insert into content_lessons')) {
      contentLessons.push({
        id: params[0],
        package_id: params[1],
        slug: params[2],
        schema_version: params[3],
        title_en: params[4],
        title_vi: params[5],
        blurb_vi: params[6],
        level: params[7],
        target_skills_json: params[8],
        estimated_duration_minutes: params[9],
      });
      return {rowsAffected: 1, insertId: contentLessons.length};
    }

    if (normalized.startsWith('insert into content_items')) {
      contentItems.push({
        id: params[0],
        lesson_id: params[1],
        package_id: params[2],
        slug: params[3],
        chunk_order: params[4],
        phrase_en: params[5],
        phrase_vi: params[6],
        explanation_vi: params[7],
        context_sentence_en: params[8],
        context_sentence_vi: params[9],
        payload_json: params[10],
      });
      return {rowsAffected: 1, insertId: contentItems.length};
    }

    if (normalized.startsWith('insert into content_units')) {
      contentUnits.push({
        id: params[0],
        lesson_id: params[1],
        package_id: params[2],
        unit_type: params[3],
        slug: params[4],
        payload_json: params[5],
      });
      return {rowsAffected: 1, insertId: contentUnits.length};
    }

    if (normalized.startsWith('insert into content_activities')) {
      contentActivities.push({
        id: params[0],
        lesson_id: params[1],
        package_id: params[2],
        slug: params[3],
        activity_type: params[4],
        title_vi: params[5],
        chunk_ref_ids_json: params[6],
        qa_ref_ids_json: params[7],
        instructions_vi: params[8],
      });
      return {rowsAffected: 1, insertId: contentActivities.length};
    }

    if (normalized.startsWith('insert into content_audio_assets')) {
      contentAudioAssets.push({
        id: params[0],
        lesson_id: params[1],
        package_id: params[2],
        slug: params[3],
        url: params[4],
        checksum: params[5],
        bytes: params[6],
        locale: params[7],
        transcript: params[8],
      });
      return {rowsAffected: 1, insertId: contentAudioAssets.length};
    }

    if (
      normalized.startsWith('update content_packages') &&
      normalized.includes('is_active = 0')
    ) {
      const deactivatedAt = params[0];
      const id = params[1];
      const row = contentPackages.find(p => p.id === id);
      if (!row) return {rowsAffected: 0};
      row.is_active = 0;
      row.deactivated_at = deactivatedAt;
      return {rowsAffected: 1};
    }

    if (
      normalized.startsWith('update content_packages') &&
      normalized.includes('is_active = 1')
    ) {
      const id = params[0];
      const row = contentPackages.find(p => p.id === id);
      if (!row) return {rowsAffected: 0};
      row.is_active = 1;
      row.deactivated_at = null;
      return {rowsAffected: 1};
    }

    if (normalized.includes('from content_packages where is_active = 1')) {
      return toRows(contentPackages.filter(p => p.is_active === 1));
    }

    if (
      normalized.startsWith('select') &&
      normalized.includes('from content_packages where id') &&
      !normalized.includes('count(*)')
    ) {
      const id = params[0];
      return toRows(contentPackages.filter(p => p.id === id));
    }

    if (normalized.includes('from content_packages order by')) {
      const sorted = [...contentPackages].sort((a, b) =>
        String(b.imported_at).localeCompare(String(a.imported_at)),
      );
      return toRows(sorted);
    }

    if (
      normalized.includes('from content_packages') &&
      normalized.includes('where is_active = 0') &&
      normalized.includes('order by datetime(deactivated_at) desc')
    ) {
      const sorted = contentPackages
        .filter(p => p.is_active === 0 && p.deactivated_at !== null)
        .sort((a, b) =>
          String(b.deactivated_at).localeCompare(String(a.deactivated_at)),
        );
      return toRows(sorted.slice(0, 1));
    }

    if (
      normalized.startsWith('select count(*)') &&
      normalized.includes('from content_lessons')
    ) {
      const packageId = params[0];
      const n = contentLessons.filter(l => l.package_id === packageId).length;
      return toRows([{n}]);
    }

    if (
      normalized.startsWith('select count(*)') &&
      normalized.includes('from content_items')
    ) {
      let rows = contentItems;
      if (normalized.includes('where lesson_id')) {
        const lessonId = params[0];
        rows = contentItems.filter(i => i.lesson_id === lessonId);
      }
      return toRows([{n: rows.length}]);
    }

    if (
      normalized.startsWith('select') &&
      normalized.includes('from content_items')
    ) {
      let rows = [...contentItems];
      if (normalized.includes('where lesson_id = ?')) {
        const lessonId = params[params.length - 1];
        rows = rows.filter(i => i.lesson_id === lessonId);
      }
      if (normalized.includes('order by chunk_order')) {
        rows.sort((a, b) => a.chunk_order - b.chunk_order);
      }
      return toRows(rows);
    }

    if (
      normalized.startsWith('select') &&
      normalized.includes('from content_lessons')
    ) {
      let rows = [...contentLessons];
      if (normalized.includes('where package_id = ?')) {
        const packageId = params[0];
        rows = rows.filter(l => l.package_id === packageId);
      }
      if (normalized.includes('where id = ?')) {
        const id = params[0];
        rows = rows.filter(l => l.id === id);
      }
      return toRows(rows);
    }

    if (
      normalized.startsWith('select count(*)') &&
      normalized.includes('from content_packages')
    ) {
      const id = params[0];
      const n = contentPackages.filter(p => p.id === id).length;
      return toRows([{n}]);
    }

    if (
      normalized.startsWith('delete from content_audio_assets where package_id')
    ) {
      const packageId = params[0];
      const before = contentAudioAssets.length;
      const remaining = contentAudioAssets.filter(
        a => a.package_id !== packageId,
      );
      contentAudioAssets.length = 0;
      contentAudioAssets.push(...remaining);
      return {rowsAffected: before - remaining.length};
    }
    if (
      normalized.startsWith('delete from content_activities where package_id')
    ) {
      const packageId = params[0];
      const before = contentActivities.length;
      const remaining = contentActivities.filter(
        a => a.package_id !== packageId,
      );
      contentActivities.length = 0;
      contentActivities.push(...remaining);
      return {rowsAffected: before - remaining.length};
    }
    if (normalized.startsWith('delete from content_units where package_id')) {
      const packageId = params[0];
      const before = contentUnits.length;
      const remaining = contentUnits.filter(a => a.package_id !== packageId);
      contentUnits.length = 0;
      contentUnits.push(...remaining);
      return {rowsAffected: before - remaining.length};
    }
    if (normalized.startsWith('delete from content_items where package_id')) {
      const packageId = params[0];
      const before = contentItems.length;
      const remaining = contentItems.filter(a => a.package_id !== packageId);
      contentItems.length = 0;
      contentItems.push(...remaining);
      return {rowsAffected: before - remaining.length};
    }
    if (normalized.startsWith('delete from content_lessons where package_id')) {
      const packageId = params[0];
      const before = contentLessons.length;
      const remaining = contentLessons.filter(a => a.package_id !== packageId);
      contentLessons.length = 0;
      contentLessons.push(...remaining);
      return {rowsAffected: before - remaining.length};
    }
    if (normalized.startsWith('delete from content_packages where id')) {
      const id = params[0];
      const before = contentPackages.length;
      const remaining = contentPackages.filter(p => p.id !== id);
      contentPackages.length = 0;
      contentPackages.push(...remaining);
      return {rowsAffected: before - remaining.length};
    }

    if (
      normalized.startsWith('select') &&
      normalized.includes('from content_activities')
    ) {
      const lessonId = params[0];
      return toRows(contentActivities.filter(a => a.lesson_id === lessonId));
    }

    if (
      normalized.startsWith('select') &&
      normalized.includes('from content_audio_assets')
    ) {
      const lessonId = params[0];
      return toRows(contentAudioAssets.filter(a => a.lesson_id === lessonId));
    }

    if (
      normalized.startsWith('select') &&
      normalized.includes('from content_units')
    ) {
      const lessonId = params[0];
      let rows = contentUnits.filter(u => u.lesson_id === lessonId);
      if (normalized.includes("unit_type = 'srs'")) {
        rows = rows.filter(u => u.unit_type === 'srs');
      }
      return toRows(rows);
    }

    // ---- SETE-110 / M5 error notebook review item creation ----
    if (normalized.startsWith('insert into content_review_items')) {
      contentReviewItems.push({
        id: params[0],
        srs_item_id: params[1],
        lesson_id: params[2],
        package_id: params[3],
        item_type: params[4],
        source_ref_id: params[5],
        front: params[6],
        back: params[7],
        hint_vi: params[8],
        mastery_state: 'new',
        next_review_at: params[9],
        created_at: params[10],
        updated_at: params[11],
      });
      return {rowsAffected: 1, insertId: contentReviewItems.length};
    }

    if (
      normalized.startsWith(
        'delete from content_review_items where item_type = ?',
      )
    ) {
      const itemType = params[0];
      for (let i = contentReviewItems.length - 1; i >= 0; i -= 1) {
        if (contentReviewItems[i].item_type === itemType) {
          contentReviewItems.splice(i, 1);
        }
      }
      return {rowsAffected: 1};
    }

    // ---- SETE-110 / M5 speaking recordings ----
    if (normalized.startsWith('insert into speaking_recordings')) {
      speakingRecordings.push({
        id: params[0],
        activity_id: params[1],
        lesson_id: params[2],
        mode: params[3],
        file_path: params[4],
        duration_ms: params[5],
        created_at: params[6],
      });
      return {rowsAffected: 1, insertId: speakingRecordings.length};
    }

    if (
      normalized.startsWith('select') &&
      normalized.includes('from speaking_recordings')
    ) {
      if (normalized.includes('where id = ?')) {
        const id = params[0];
        return toRows(speakingRecordings.filter(r => r.id === id));
      }
      if (normalized.includes('where lesson_id = ?')) {
        const lessonId = params[0];
        return toRows(speakingRecordings.filter(r => r.lesson_id === lessonId));
      }
      return toRows([...speakingRecordings]);
    }

    if (normalized.startsWith('delete from speaking_recordings where id = ?')) {
      const id = params[0];
      const index = speakingRecordings.findIndex(r => r.id === id);
      if (index === -1) {
        return {rowsAffected: 0};
      }
      speakingRecordings.splice(index, 1);
      return {rowsAffected: 1};
    }

    if (normalized.startsWith('delete from speaking_recordings')) {
      const count = speakingRecordings.length;
      speakingRecordings.length = 0;
      return {rowsAffected: count};
    }

    // ---- SETE-110 / M5 error events ----
    if (normalized.startsWith('insert into error_events')) {
      errorEvents.push({
        id: params[0],
        source: params[1],
        category: params[2],
        activity_id: params[3],
        lesson_id: params[4],
        review_item_id: params[5],
        created_at: params[6],
      });
      return {rowsAffected: 1, insertId: errorEvents.length};
    }

    if (
      normalized.startsWith('select') &&
      normalized.includes('from error_events')
    ) {
      if (normalized.includes('where lesson_id = ?')) {
        const lessonId = params[0];
        return toRows(errorEvents.filter(e => e.lesson_id === lessonId));
      }
      return toRows([...errorEvents]);
    }

    if (normalized.startsWith('delete from error_events')) {
      const count = errorEvents.length;
      errorEvents.length = 0;
      return {rowsAffected: count};
    }

    // ---- SETE-108 / M3 lesson runtime review items ----
    if (normalized.startsWith('insert or ignore into content_review_items')) {
      const srsItemId = params[1];
      if (contentReviewItems.some(r => r.srs_item_id === srsItemId)) {
        return {rowsAffected: 0};
      }
      contentReviewItems.push({
        id: params[0],
        srs_item_id: params[1],
        lesson_id: params[2],
        package_id: params[3],
        item_type: params[4],
        source_ref_id: params[5],
        front: params[6],
        back: params[7],
        hint_vi: params[8],
        mastery_state: 'new',
        next_review_at: params[9],
        created_at: params[10],
        updated_at: params[11],
      });
      return {rowsAffected: 1, insertId: contentReviewItems.length};
    }

    if (
      normalized.startsWith('select') &&
      normalized.includes('from content_review_items')
    ) {
      if (normalized.includes('where lesson_id = ?')) {
        const lessonId = params[0];
        return toRows(contentReviewItems.filter(r => r.lesson_id === lessonId));
      }
      if (normalized.includes('where id = ?')) {
        const id = params[0];
        return toRows(contentReviewItems.filter(r => r.id === id));
      }
      return toRows([...contentReviewItems]);
    }

    // ---- SETE-109 / M4 content review scheduling ----
    if (normalized.startsWith('update content_review_items')) {
      const masteryState = params[0];
      const nextReviewAt = params[1];
      const updatedAt = params[2];
      const id = params[3];
      const row = contentReviewItems.find(r => r.id === id);
      if (!row) {
        return {rowsAffected: 0};
      }
      row.mastery_state = masteryState;
      row.next_review_at = nextReviewAt;
      row.updated_at = updatedAt;
      return {rowsAffected: 1};
    }

    // ---- SETE-145 / M6 Library persistence ----
    if (normalized.startsWith('insert into content_lesson_state')) {
      contentLessonState.push({
        lesson_id: params[0],
        is_saved: params[1],
        is_started: params[2],
        created_at: params[3],
        updated_at: params[4],
      });
      return {rowsAffected: 1, insertId: contentLessonState.length};
    }

    if (normalized.startsWith('update content_lesson_state set is_saved = 1')) {
      const updatedAt = params[0];
      const lessonId = params[1];
      const row = contentLessonState.find(s => s.lesson_id === lessonId);
      if (!row) {
        return {rowsAffected: 0};
      }
      row.is_saved = 1;
      row.updated_at = updatedAt;
      return {rowsAffected: 1};
    }

    if (normalized.startsWith('update content_lesson_state set is_saved = 0')) {
      const updatedAt = params[0];
      const lessonId = params[1];
      const row = contentLessonState.find(s => s.lesson_id === lessonId);
      if (!row) {
        return {rowsAffected: 0};
      }
      row.is_saved = 0;
      row.updated_at = updatedAt;
      return {rowsAffected: 1};
    }

    if (
      normalized.startsWith('update content_lesson_state set is_started = 1')
    ) {
      const updatedAt = params[0];
      const lessonId = params[1];
      const row = contentLessonState.find(s => s.lesson_id === lessonId);
      if (!row) {
        return {rowsAffected: 0};
      }
      row.is_started = 1;
      row.updated_at = updatedAt;
      return {rowsAffected: 1};
    }

    if (
      normalized.startsWith('update content_lesson_state set is_started = 0')
    ) {
      const updatedAt = params[0];
      const lessonId = params[1];
      const row = contentLessonState.find(s => s.lesson_id === lessonId);
      if (!row) {
        return {rowsAffected: 0};
      }
      row.is_started = 0;
      row.updated_at = updatedAt;
      return {rowsAffected: 1};
    }

    if (
      normalized.includes('from content_lesson_state') &&
      normalized.includes('where lesson_id = ?')
    ) {
      const lessonId = params[0];
      return toRows(contentLessonState.filter(s => s.lesson_id === lessonId));
    }

    if (
      normalized.includes('from content_lesson_state') &&
      normalized.includes('where is_saved = 1')
    ) {
      return toRows(
        [...contentLessonState]
          .filter(s => s.is_saved === 1)
          .sort((a, b) =>
            String(b.updated_at).localeCompare(String(a.updated_at)),
          ),
      );
    }

    if (
      normalized.includes('from content_lesson_state') &&
      normalized.includes('where is_started = 1')
    ) {
      return toRows(
        [...contentLessonState]
          .filter(s => s.is_started === 1)
          .sort((a, b) =>
            String(b.updated_at).localeCompare(String(a.updated_at)),
          ),
      );
    }

    if (normalized === 'delete from content_lesson_state;') {
      const count = contentLessonState.length;
      contentLessonState.length = 0;
      return {rowsAffected: count};
    }

    if (normalized.startsWith('insert into grammar_bookmarks')) {
      grammarBookmarks.push({
        lesson_id: params[0],
        grammar_id: params[1],
        package_id: params[2],
        saved_at: params[3],
        reactivated_at: params[4],
        created_at: params[5],
        updated_at: params[6],
      });
      return {rowsAffected: 1, insertId: grammarBookmarks.length};
    }

    if (
      normalized.includes('from grammar_bookmarks') &&
      normalized.includes('where lesson_id = ? and grammar_id = ?')
    ) {
      const lessonId = params[0];
      const grammarId = params[1];
      return toRows(
        grammarBookmarks.filter(
          b => b.lesson_id === lessonId && b.grammar_id === grammarId,
        ),
      );
    }

    if (
      normalized.startsWith(
        'update grammar_bookmarks set reactivated_at = null',
      )
    ) {
      const updatedAt = params[0];
      const lessonId = params[1];
      const grammarId = params[2];
      const row = grammarBookmarks.find(
        b => b.lesson_id === lessonId && b.grammar_id === grammarId,
      );
      if (!row) {
        return {rowsAffected: 0};
      }
      row.reactivated_at = null;
      row.updated_at = updatedAt;
      return {rowsAffected: 1};
    }

    if (
      normalized.startsWith('update grammar_bookmarks') &&
      normalized.includes('reactivated_at') &&
      normalized.includes('saved_at') &&
      normalized.includes('where lesson_id = ? and grammar_id = ?')
    ) {
      const reactivatedAt = params[0];
      const savedAt = params[1];
      const updatedAt = params[2];
      const lessonId = params[3];
      const grammarId = params[4];
      const row = grammarBookmarks.find(
        b => b.lesson_id === lessonId && b.grammar_id === grammarId,
      );
      if (!row) {
        return {rowsAffected: 0};
      }
      row.reactivated_at = reactivatedAt;
      row.saved_at = savedAt;
      row.updated_at = updatedAt;
      return {rowsAffected: 1};
    }

    if (
      normalized.includes('from grammar_bookmarks') &&
      normalized.includes('where lesson_id = ? and reactivated_at is not null')
    ) {
      const lessonId = params[0];
      return toRows(
        [...grammarBookmarks]
          .filter(b => b.lesson_id === lessonId && b.reactivated_at !== null)
          .sort((a, b) =>
            String(b.updated_at).localeCompare(String(a.updated_at)),
          ),
      );
    }

    if (
      normalized.includes('from grammar_bookmarks') &&
      normalized.includes('where reactivated_at is not null')
    ) {
      return toRows(
        [...grammarBookmarks]
          .filter(b => b.reactivated_at !== null)
          .sort((a, b) =>
            String(b.updated_at).localeCompare(String(a.updated_at)),
          ),
      );
    }

    if (normalized === 'delete from grammar_bookmarks;') {
      const count = grammarBookmarks.length;
      grammarBookmarks.length = 0;
      return {rowsAffected: count};
    }

    if (normalized === 'select count(*) as count from content_lesson_state;') {
      return toRows([{count: contentLessonState.length}]);
    }

    if (normalized === 'select count(*) as count from grammar_bookmarks;') {
      return toRows([{count: grammarBookmarks.length}]);
    }

    if (
      normalized.includes("from sqlite_master where type='table'") &&
      normalized.includes("name not like 'sqlite_%'")
    ) {
      const tableArrays = {
        lessons,
        app_settings: appSettings,
        flashcards,
        review_schedule: reviewSchedule,
        review_sessions: reviewSessions,
        audio_assets: audioAssets,
        gamification_events: gamificationEvents,
        sync_outbox: syncOutbox,
        content_packages: contentPackages,
        content_lessons: contentLessons,
        content_items: contentItems,
        content_units: contentUnits,
        content_activities: contentActivities,
        content_audio_assets: contentAudioAssets,
        content_review_items: contentReviewItems,
        speaking_recordings: speakingRecordings,
        error_events: errorEvents,
        content_lesson_state: contentLessonState,
        grammar_bookmarks: grammarBookmarks,
        lesson_v2: lessonV2,
        lesson_v2_sentences: lessonV2Sentences,
        lesson_v2_chunks: lessonV2Chunks,
        lesson_v2_vocabulary: lessonV2Vocabulary,
        lesson_v2_grammar: lessonV2Grammar,
        lesson_v2_units: lessonV2Units,
        practice_sets: practiceSets,
        practice_questions: practiceQuestions,
        practice_sessions: practiceSessions,
        practice_events: practiceEvents,
        youtube_lessons: youtubeLessons,
        youtube_sentences: youtubeSentences,
        youtube_progress: youtubeProgress,
      };
      return toRows(
        Object.keys(tableArrays)
          .filter(name => !droppedTables.has(name))
          .map(name => ({name})),
      );
    }

    const wipeTable = normalized.match(/^delete from ([a-z0-9_]+);$/);
    if (wipeTable) {
      const table = wipeTable[1];
      const tableArrays = {
        lessons,
        app_settings: appSettings,
        flashcards,
        review_schedule: reviewSchedule,
        review_sessions: reviewSessions,
        audio_assets: audioAssets,
        gamification_events: gamificationEvents,
        sync_outbox: syncOutbox,
        content_packages: contentPackages,
        content_lessons: contentLessons,
        content_items: contentItems,
        content_units: contentUnits,
        content_activities: contentActivities,
        content_audio_assets: contentAudioAssets,
        content_review_items: contentReviewItems,
        speaking_recordings: speakingRecordings,
        error_events: errorEvents,
        content_lesson_state: contentLessonState,
        grammar_bookmarks: grammarBookmarks,
        lesson_v2: lessonV2,
        lesson_v2_sentences: lessonV2Sentences,
        lesson_v2_chunks: lessonV2Chunks,
        lesson_v2_vocabulary: lessonV2Vocabulary,
        lesson_v2_grammar: lessonV2Grammar,
        lesson_v2_units: lessonV2Units,
        practice_sets: practiceSets,
        practice_questions: practiceQuestions,
        practice_sessions: practiceSessions,
        practice_events: practiceEvents,
        youtube_lessons: youtubeLessons,
        youtube_sentences: youtubeSentences,
        youtube_progress: youtubeProgress,
      };
      const arr = tableArrays[table];
      if (arr) {
        const count = arr.length;
        arr.length = 0;
        return {rowsAffected: count};
      }
    }

    return {rowsAffected: 0};
  };

  return {execute};
}

function open({name}) {
  if (!databases.has(name)) {
    databases.set(name, createMockDatabase());
  }

  return databases.get(name);
}

function __resetMockDatabases() {
  databases.clear();
}

module.exports = {
  open,
  __resetMockDatabases,
};
