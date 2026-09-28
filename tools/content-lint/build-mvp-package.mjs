#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import {createHash} from 'crypto';
import {fileURLToPath} from 'url';

const pkgDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  'packages',
  'daily-standup',
);

function makeId(seed) {
  return createHash('sha256').update(seed, 'utf8').digest('hex').slice(0, 16);
}

const lessonsData = [
  // Unit 1: Introduction
  {
    slug: 'self-introduction',
    unit_slug: 'introduction',
    unit_title_vi: 'Giới thiệu bản thân & Công nghệ',
    stage: 1,
    level: 'A1',
    title_en: 'Self Introduction & Tech Stack',
    title_vi: 'Giới thiệu bản thân và Công nghệ sử dụng',
    blurb_vi:
      'Học cách giới thiệu tên, vai trò và các công nghệ lập trình bạn đang làm việc trong môi trường quốc tế.',
    objective_vi:
      'Trình bày thành thạo 8 cụm từ giới thiệu bản thân và công nghệ trong 2 phút.',
    situation_vi: 'Buổi gặp mặt thành viên mới trong dự án phần mềm.',
    learner_role_vi: 'Lập trình viên mới gia nhập đội ngũ.',
    prerequisite_lesson_slugs: [],
    pronunciation_focus_vi:
      'Phát âm rõ ràng các tên công nghệ (React, Node, Python, SQL).',
    final_speaking_task_vi:
      'Giới thiệu bản thân, vai trò và công nghệ chính bạn đang sử dụng.',
    pass_conditions_vi:
      'Hoàn thành bài tập nói với ít nhất 80% câu đúng và phát âm tên công nghệ chuẩn.',
    chunks: [
      {
        slug: 'hi-im-dev',
        phrase_en: "Hi, I'm a full-stack developer",
        phrase_vi: 'Xin chào, tôi là lập trình viên full-stack',
        explanation_vi:
          'Cụm từ tiêu chuẩn để giới thiệu vai trò lập trình viên của bạn.',
      },
      {
        slug: 'working-with-react',
        phrase_en: "I've been working with React and Node.js",
        phrase_vi: 'Tôi đã làm việc với React và Node.js',
        explanation_vi:
          'Thì hiện tại hoàn thành tiếp diễn thể hiện kinh nghiệm làm việc liên tục.',
      },
      {
        slug: 'my-main-focus',
        phrase_en: 'My main focus is frontend development',
        phrase_vi: 'Trọng tâm chính của tôi là phát triển giao diện (frontend)',
        explanation_vi: 'Cụm từ dùng để nêu chuyên môn chính của bạn.',
      },
      {
        slug: 'glad-to-join',
        phrase_en: "I'm glad to join the team",
        phrase_vi: 'Tôi rất vui được gia nhập nhóm',
        explanation_vi: 'Lời chào xã giao lịch sự khi mới tham gia dự án.',
      },
      {
        slug: 'responsible-for-api',
        phrase_en: "I'm responsible for building REST APIs",
        phrase_vi: 'Tôi chịu trách nhiệm xây dựng các REST API',
        explanation_vi:
          'Cụm be responsible for + V-ing dùng để giải thích trách nhiệm công việc.',
      },
      {
        slug: 'comfortable-with-ts',
        phrase_en: "I'm comfortable working with TypeScript",
        phrase_vi: 'Tôi sử dụng thành thạo TypeScript',
        explanation_vi:
          'Be comfortable with sth dùng để diễn tả sự thành thạo với một kỹ năng.',
      },
      {
        slug: 'excited-about-project',
        phrase_en: "I'm excited about this project",
        phrase_vi: 'Tôi rất hào hứng với dự án này',
        explanation_vi: 'Thể hiện thái độ tích cực khi khởi đầu công việc mới.',
      },
      {
        slug: 'look-forward-working',
        phrase_en: 'I look forward to working with everyone',
        phrase_vi: 'Tôi rất mong được làm việc cùng mọi người',
        explanation_vi: 'Cụm từ khép lại phần giới thiệu rất chuyên nghiệp.',
      },
    ],
  },
  {
    slug: 'team-onboarding',
    unit_slug: 'introduction',
    unit_title_vi: 'Giới thiệu bản thân & Công nghệ',
    stage: 1,
    level: 'A1',
    title_en: 'Team Onboarding & Project Setup',
    title_vi: 'Hội nhập nhóm & Thiết lập dự án',
    blurb_vi:
      'Học các câu hỏi và câu nói cần thiết trong ngày đầu tiên hội nhập dự án phần mềm.',
    objective_vi:
      'Hỏi và trả lời về quy trình onboarding, mã nguồn và tài liệu dự án.',
    situation_vi:
      'Ngày đầu tiên nhận tài liệu và cài đặt môi trường phát triển.',
    learner_role_vi: 'Kỹ sư phần mềm mới nhận nhiệm vụ.',
    prerequisite_lesson_slugs: ['self-introduction'],
    pronunciation_focus_vi:
      'Phát âm đúng các từ thuật ngữ: repository, documentation, setup, access.',
    final_speaking_task_vi:
      'Hỏi nhóm về quyền truy cập mã nguồn và tài liệu hướng dẫn.',
    pass_conditions_vi:
      'Trả lời đúng các câu hỏi thực hành và phát âm chuẩn các thuật ngữ onboarding.',
    chunks: [
      {
        slug: 'where-repo',
        phrase_en: 'Where can I find the repository link?',
        phrase_vi: 'Tôi có thể tìm liên kết mã nguồn ở đâu?',
        explanation_vi: 'Câu hỏi phổ biến nhất khi bắt đầu dự án mới.',
      },
      {
        slug: 'clone-project',
        phrase_en: 'I need access to clone the project',
        phrase_vi: 'Tôi cần quyền truy cập để tải mã nguồn về',
        explanation_vi:
          'Clone the project nghĩa là tải mã nguồn từ Git về máy cá nhân.',
      },
      {
        slug: 'read-readme',
        phrase_en: 'Please check the README file for setup instructions',
        phrase_vi: 'Vui lòng đọc tệp README để xem hướng dẫn cài đặt',
        explanation_vi: 'README là tệp tài liệu hướng dẫn khởi tạo dự án.',
      },
      {
        slug: 'env-variables',
        phrase_en: 'Do we have a template for environment variables?',
        phrase_vi: 'Chúng ta có mẫu cấu hình biến môi trường không?',
        explanation_vi: 'Environment variables là các biến môi trường (.env).',
      },
      {
        slug: 'setting-up-workspace',
        phrase_en: "I'm setting up my local development environment",
        phrase_vi: 'Tôi đang cài đặt môi trường phát triển tại máy',
        explanation_vi:
          'Local development environment là môi trường chạy code trên máy cá nhân.',
      },
      {
        slug: 'need-credentials',
        phrase_en: 'I still need credentials for staging server',
        phrase_vi: 'Tôi vẫn cần thông tin đăng nhập cho máy chủ staging',
        explanation_vi: 'Credentials chỉ tài khoản và mật khẩu truy cập.',
      },
      {
        slug: 'who-to-ask',
        phrase_en: 'Who should I contact regarding DB access?',
        phrase_vi: 'Tôi nên liên hệ ai về việc truy cập cơ sở dữ liệu?',
        explanation_vi:
          'Cấu trúc Who should I contact regarding... dùng để hỏi người hỗ trợ.',
      },
      {
        slug: 'ready-for-first-task',
        phrase_en: "I'm ready for my first sprint task",
        phrase_vi: 'Tôi đã sẵn sàng cho nhiệm vụ đầu tiên trong sprint',
        explanation_vi: 'Sprint task là nhiệm vụ trong chu kỳ làm việc Agile.',
      },
    ],
  },

  // Unit 2: Asking for repetition/clarification
  {
    slug: 'asking-clarification',
    unit_slug: 'clarification',
    unit_title_vi: 'Yêu cầu lặp lại & Làm rõ ý',
    stage: 1,
    level: 'A2',
    title_en: 'Asking for Clarification & Details',
    title_vi: 'Làm rõ yêu cầu & Hỏi lại chi tiết',
    blurb_vi:
      'Nắm vững các mẫu câu lịch sự để yêu cầu đồng nghiệp hoặc khách hàng giải thích lại yêu cầu kỹ thuật.',
    objective_vi:
      'Sử dụng thành thạo 8 mẫu câu yêu cầu giải thích lại khi chưa nghe rõ.',
    situation_vi:
      'Buổi họp trao đổi yêu cầu tính năng nhưng kết nối bị chập chờn hoặc nói quá nhanh.',
    learner_role_vi: 'Lập trình viên đang lắng nghe yêu cầu từ Product Owner.',
    prerequisite_lesson_slugs: ['team-onboarding'],
    pronunciation_focus_vi:
      'Nâng cao ngữ điệu câu hỏi lịch sự (Could you, Would you mind).',
    final_speaking_task_vi:
      'Yêu cầu người nói giải thích lại tiêu chí chấp nhận của tính năng.',
    pass_conditions_vi:
      'Phát âm tự nhiên các câu hỏi làm rõ với tốc độ vừa phải.',
    chunks: [
      {
        slug: 'could-you-repeat',
        phrase_en: 'Could you please repeat that point?',
        phrase_vi: 'Bạn có thể lặp lại điểm đó được không?',
        explanation_vi: 'Câu hỏi lịch sự dùng khi nghe không kịp.',
      },
      {
        slug: 'what-do-you-mean',
        phrase_en: 'What do you mean by edge cases here?',
        phrase_vi: 'Ý bạn là gì khi nói các trường hợp biên ở đây?',
        explanation_vi:
          'Dùng để hỏi rõ định nghĩa hoặc ý nghĩa của từ vừa nói.',
      },
      {
        slug: 'can-you-elaborate',
        phrase_en: 'Can you elaborate on the business logic?',
        phrase_vi: 'Bạn có thể nói rõ hơn về nghiệp vụ này được không?',
        explanation_vi: 'Elaborate on sth nghĩa là giải thích chi tiết hơn.',
      },
      {
        slug: 'did-i-understand',
        phrase_en: 'So if I understand correctly, we need to cache this?',
        phrase_vi:
          'Vậy nếu tôi hiểu đúng thì chúng ta cần lưu bộ nhớ đệm cái này?',
        explanation_vi: 'Cụm từ dùng để xác nhận lại hiểu biết của mình.',
      },
      {
        slug: 'lost-you-there',
        phrase_en: 'I lost you on the database schema part',
        phrase_vi: 'Tôi chưa theo kịp bạn ở phần lược đồ cơ sở dữ liệu',
        explanation_vi: 'Cách nói tự nhiên khi bị ngắt quãng tư duy.',
      },
      {
        slug: 'could-you-speak-slower',
        phrase_en: 'Could you speak a bit slower, please?',
        phrase_vi: 'Bạn có thể nói chậm lại một chút được không?',
        explanation_vi: 'Yêu cầu người đối thoại giảm tốc độ nói.',
      },
      {
        slug: 'write-it-down',
        phrase_en: 'Could you post that requirement in Slack?',
        phrase_vi: 'Bạn có thể nhắn yêu cầu đó lên Slack được không?',
        explanation_vi:
          'Nhờ đối phương ghi lại bằng văn bản để tránh hiểu nhầm.',
      },
      {
        slug: 'makes-sense-now',
        phrase_en: 'That makes total sense now, thank you',
        phrase_vi: 'Bây giờ tôi đã hiểu hoàn toàn rồi, cảm ơn bạn',
        explanation_vi: 'Xác nhận đã hiểu sau khi được giải thích.',
      },
    ],
  },
  {
    slug: 'confirming-requirements',
    unit_slug: 'clarification',
    unit_title_vi: 'Yêu cầu lặp lại & Làm rõ ý',
    stage: 1,
    level: 'A2',
    title_en: 'Confirming Technical Requirements',
    title_vi: 'Xác nhận yêu cầu kỹ thuật',
    blurb_vi:
      'Học cách chốt lại yêu cầu kỹ thuật với nhóm sản xuất để đảm bảo không làm sai tính năng.',
    objective_vi:
      'Tóm tắt và xác nhận lại thông số kỹ thuật với khách hàng hoặc nhóm trưởng.',
    situation_vi: 'Chốt tài liệu kỹ thuật trước khi bắt đầu lập trình.',
    learner_role_vi: 'Developer xác nhận lại các ràng buộc hệ thống.',
    prerequisite_lesson_slugs: ['asking-clarification'],
    pronunciation_focus_vi:
      'Nhấn giọng vào các từ quan trọng: confirm, requirement, expectation, scope.',
    final_speaking_task_vi:
      'Tóm tắt 3 điểm yêu cầu kỹ thuật vừa thảo luận để chốt với PO.',
    pass_conditions_vi: 'Tóm tắt rõ ràng và dùng đúng mẫu câu xác nhận.',
    chunks: [
      {
        slug: 'just-to-confirm',
        phrase_en: 'Just to confirm, the deadline is Thursday?',
        phrase_vi: 'Chỉ để xác nhận lại, hạn chót là thứ Năm đúng không?',
        explanation_vi:
          'Just to confirm... là mẫu câu chốt thông tin cực kỳ phổ biến.',
      },
      {
        slug: 'expected-behavior',
        phrase_en: 'What is the expected behavior when token expires?',
        phrase_vi: 'Hành vi mong đợi là gì khi mã token hết hạn?',
        explanation_vi: 'Expected behavior chỉ kết quả hệ thống cần đạt được.',
      },
      {
        slug: 'in-terms-of-scope',
        phrase_en: 'In terms of scope, is push notification included?',
        phrase_vi: 'Xét về phạm vi, thông báo đẩy có bao gồm không?',
        explanation_vi: 'In terms of scope dùng để khoanh vùng công việc.',
      },
      {
        slug: 'double-check',
        phrase_en: 'Let me double-check the API response format',
        phrase_vi: 'Để tôi kiểm tra kỹ lại định dạng phản hồi API',
        explanation_vi:
          'Double-check nghĩa là kiểm tra lại lần thứ hai cho chắc chắn.',
      },
      {
        slug: 'correct-me-if-wrong',
        phrase_en: 'Correct me if I am wrong, but we need auth first',
        phrase_vi: 'Sửa cho tôi nếu tôi sai, nhưng chúng ta cần xác thực trước',
        explanation_vi: 'Cách diễn đạt lịch sự khi muốn đưa ra nhận định.',
      },
      {
        slug: 'aligned-on-this',
        phrase_en: 'Are we all aligned on this approach?',
        phrase_vi: 'Tất cả chúng ta đã thống nhất về hướng đi này chưa?',
        explanation_vi: 'Aligned on sth nghĩa là đồng thuận cùng mục tiêu.',
      },
      {
        slug: 'put-in-ticket',
        phrase_en: 'I will put these details in the Jira ticket',
        phrase_vi: 'Tôi sẽ đưa các chi tiết này vào thẻ Jira',
        explanation_vi: 'Ghi lại yêu cầu vào hệ thống quản lý công việc.',
      },
      {
        slug: 'clear-to-proceed',
        phrase_en: 'Everything is clear, I can proceed now',
        phrase_vi: 'Mọi thứ đã rõ ràng, tôi có thể bắt đầu làm',
        explanation_vi: 'Thông báo sẵn sàng thực thi nhiệm vụ.',
      },
    ],
  },

  // Unit 3: Team roles
  {
    slug: 'team-roles',
    unit_slug: 'team-roles',
    unit_title_vi: 'Vai trò & Trách nhiệm trong Nhóm',
    stage: 2,
    level: 'A2',
    title_en: 'Discussing Engineering Roles & Responsibilities',
    title_vi: 'Thảo luận vai trò và trách nhiệm kỹ thuật',
    blurb_vi:
      'Mô tả ai làm gì trong dự án (Dev, QA, DevOps, PO, Scrum Master) và phân chia công việc.',
    objective_vi: 'Mô tả nhiệm vụ của các vai trò trong nhóm bằng tiếng Anh.',
    situation_vi: 'Họp phân công công việc đầu dự án.',
    learner_role_vi: 'Thành viên nhóm giải thích sự phân công công việc.',
    prerequisite_lesson_slugs: ['confirming-requirements'],
    pronunciation_focus_vi:
      'Phát âm chuẩn tên các vai trò: Tech Lead, Product Owner, QA Engineer, DevOps.',
    final_speaking_task_vi: 'Giới thiệu phân công vai trò trong sprint mới.',
    pass_conditions_vi: 'Mô tả chính xác trách nhiệm của ít nhất 3 vai trò.',
    chunks: [
      {
        slug: 'qa-handles-testing',
        phrase_en: 'The QA team handles end-to-end testing',
        phrase_vi: 'Đội QA đảm nhận kiểm thử toàn trình',
        explanation_vi: 'End-to-end testing chỉ việc kiểm thử từ đầu đến cuối.',
      },
      {
        slug: 'devops-manages-ci',
        phrase_en: 'DevOps manages our CI/CD deployment pipeline',
        phrase_vi: 'DevOps quản lý quy trình triển khai CI/CD',
        explanation_vi: 'Pipeline triển khai tự động hóa.',
      },
      {
        slug: 'po-prioritizes-backlog',
        phrase_en: 'The Product Owner prioritizes the backlog',
        phrase_vi: 'Product Owner sắp xếp thứ tự ưu tiên backlog',
        explanation_vi:
          'Prioritize backlog nghĩa là quyết định việc nào làm trước.',
      },
      {
        slug: 'tech-lead-reviews-arch',
        phrase_en: 'Our Tech Lead reviews architectural decisions',
        phrase_vi: 'Tech Lead của chúng tôi duyệt các quyết định kiến trúc',
        explanation_vi:
          'Architectural decisions chỉ thiết kế tổng thể hệ thống.',
      },
      {
        slug: 'who-is-owning-this',
        phrase_en: 'Who is owning this feature ticket?',
        phrase_vi: 'Ai đang phụ trách thẻ tính năng này?',
        explanation_vi:
          'Own a ticket nghĩa là chịu trách nhiệm chính cho thẻ đó.',
      },
      {
        slug: 'collaborate-with-designer',
        phrase_en: 'I need to collaborate with the UI/UX designer',
        phrase_vi: 'Tôi cần phối hợp với thiết kế UI/UX',
        explanation_vi:
          'Collaborate with sb nghĩa là hợp tác làm việc cùng ai.',
      },
      {
        slug: 'hand-over-to-qa',
        phrase_en: 'I will hand this over to QA once built',
        phrase_vi: 'Tôi sẽ bàn giao cái này cho QA sau khi làm xong',
        explanation_vi: 'Hand over to sb nghĩa là bàn giao công việc.',
      },
      {
        slug: 'cross-functional-team',
        phrase_en: 'We operate as a cross-functional team',
        phrase_vi: 'Chúng tôi hoạt động như một nhóm đa chức năng',
        explanation_vi: 'Cross-functional team gồm nhiều chuyên môn khác nhau.',
      },
    ],
  },
  {
    slug: 'code-review-handoff',
    unit_slug: 'team-roles',
    unit_title_vi: 'Vai trò & Trách nhiệm trong Nhóm',
    stage: 2,
    level: 'B1',
    title_en: 'Code Review & Task Handoffs',
    title_vi: 'Đánh giá mã nguồn & Bàn giao nhiệm vụ',
    blurb_vi:
      'Học các mẫu câu khi tạo Pull Request, yêu cầu Review Code và phản hồi góp ý từ đồng nghiệp.',
    objective_vi: 'Gửi yêu cầu review PR và giải thích các thay đổi mã nguồn.',
    situation_vi: 'Hoàn thành tính năng và mở Pull Request trên GitHub/GitLab.',
    learner_role_vi: 'Developer yêu cầu đồng nghiệp duyệt PR.',
    prerequisite_lesson_slugs: ['team-roles'],
    pronunciation_focus_vi:
      'Nhấn âm các thuật ngữ Git: pull request, merge conflict, code review, approval.',
    final_speaking_task_vi:
      'Yêu cầu đồng nghiệp review PR và nêu ngắn gọn những gì đã thay đổi.',
    pass_conditions_vi: 'Nói rõ ràng lý do tạo PR và cách thử nghiệm.',
    chunks: [
      {
        slug: 'opened-a-pr',
        phrase_en: 'I have opened a PR for the login feature',
        phrase_vi: 'Tôi đã mở một PR cho tính năng đăng nhập',
        explanation_vi: 'Open a PR là cụm từ chuẩn khi tạo yêu cầu gộp mã.',
      },
      {
        slug: 'please-review-my-code',
        phrase_en: 'Could someone review my code when free?',
        phrase_vi: 'Ai đó có thể duyệt mã giúp tôi khi rảnh được không?',
        explanation_vi: 'Lời nhờ duyệt code trên kênh chat nhóm.',
      },
      {
        slug: 'addressed-your-comments',
        phrase_en: 'I have addressed all your review comments',
        phrase_vi: 'Tôi đã xử lý tất cả các góp ý của bạn',
        explanation_vi: 'Address comments nghĩa là đã sửa theo các nhận xét.',
      },
      {
        slug: 'ready-to-merge',
        phrase_en: 'The PR has passed CI and is ready to merge',
        phrase_vi: 'PR đã qua kiểm tra CI và sẵn sàng gộp mã',
        explanation_vi:
          'Ready to merge nghĩa là mã đã đạt chuẩn để nhập vào nhánh chính.',
      },
      {
        slug: 'facing-merge-conflict',
        phrase_en: "I'm resolving a merge conflict with main branch",
        phrase_vi: 'Tôi đang giải quyết xung đột mã với nhánh main',
        explanation_vi: 'Merge conflict xảy ra khi hai thay đổi đè lên nhau.',
      },
      {
        slug: 'left-some-notes',
        phrase_en: 'I left some inline notes on the PR description',
        phrase_vi: 'Tôi đã để lại một số ghi chú trong phần mô tả PR',
        explanation_vi: 'Ghi chú giải thích logic trong mô tả PR.',
      },
      {
        slug: 'approve-the-changes',
        phrase_en: 'Please approve the PR if it looks good to you',
        phrase_vi: 'Vui lòng nhấn approve PR nếu bạn thấy ổn',
        explanation_vi: 'Approve PR là hành động chấp thuận gộp mã.',
      },
      {
        slug: 'deployed-to-staging',
        phrase_en: "It's automatically deployed to staging environment",
        phrase_vi: 'Nó đã được tự động triển khai lên môi trường staging',
        explanation_vi: 'Môi trường thử nghiệm trước khi phát hành.',
      },
    ],
  },

  // Unit 4: Daily stand-up (Unit 4 Lesson 7 is existing daily-standup.lesson.json!)
  {
    slug: 'standup-blockers',
    unit_slug: 'daily-standup',
    unit_title_vi: 'Họp Đứng Hàng Ngày (Daily Stand-up)',
    stage: 2,
    level: 'A2',
    title_en: 'Raising Stand-up Blockers & Seeking Help',
    title_vi: 'Báo cáo khó khăn & Nêu yêu cầu hỗ trợ',
    blurb_vi:
      'Nâng cao khả năng trình bày rào cản kỹ thuật (blockers) trong họp stand-up và tìm sự giúp đỡ từ đồng nghiệp.',
    objective_vi:
      'Trình bày rõ ràng rào cản công việc và nhờ đồng nghiệp hỗ trợ trong 1 phút.',
    situation_vi:
      'Buổi họp stand-up khi bạn đang gặp sự cố kỹ thuật chưa giải quyết được.',
    learner_role_vi: 'Developer báo cáo tiến độ và nêu rào cản.',
    prerequisite_lesson_slugs: ['daily-standup'],
    pronunciation_focus_vi:
      'Phát âm đúng từ blocker, issue, dependency, stuck.',
    final_speaking_task_vi:
      'Nói báo cáo stand-up gồm 3 phần: Đã làm gì, Đang gặp blocker gì, Cần ai giúp.',
    pass_conditions_vi: 'Nêu rõ ràng vấn đề kỹ thuật và lời đề nghị trợ giúp.',
    chunks: [
      {
        slug: 'currently-blocked-by',
        phrase_en: "I'm currently blocked by the authentication API",
        phrase_vi: 'Tôi hiện đang bị nghẽn bởi API xác thực',
        explanation_vi:
          'Be blocked by sth chỉ việc công việc bị khựng lại do yếu tố bên ngoài.',
      },
      {
        slug: 'stuck-on-bug',
        phrase_en: "I'm stuck on a memory leak issue",
        phrase_vi: 'Tôi đang bị kẹt ở sự cố rò rỉ bộ nhớ',
        explanation_vi:
          'Be stuck on sth nghĩa là gặp bế tắc chưa tìm ra giải pháp.',
      },
      {
        slug: 'need-help-from',
        phrase_en: 'I might need some help from the backend team',
        phrase_vi: 'Có thể tôi cần sự trợ giúp từ đội backend',
        explanation_vi: 'Cách đề nghị hỗ trợ lịch sự trong cuộc họp.',
      },
      {
        slug: 'waiting-for-design',
        phrase_en: "I'm waiting for final UI designs",
        phrase_vi: 'Tôi đang chờ thiết kế UI chính thức',
        explanation_vi: 'Báo cáo phụ thuộc vào công việc của người khác.',
      },
      {
        slug: 'take-it-offline',
        phrase_en: 'Let us take this discussion offline',
        phrase_vi: 'Chúng ta hãy trao đổi riêng việc này sau cuộc họp',
        explanation_vi:
          'Cụm từ họp Agile chuẩn để tránh làm mất thời gian chung.',
      },
      {
        slug: 'pair-programming',
        phrase_en: 'Can we pair program on this for 15 minutes?',
        phrase_vi: 'Chúng ta có thể lập trình đôi trong 15 phút không?',
        explanation_vi:
          'Pair programming là hai người cùng ngồi soi code giải quyết vấn đề.',
      },
      {
        slug: 'impacts-the-timeline',
        phrase_en: 'This blocker impacts our sprint timeline',
        phrase_vi: 'Rào cản này ảnh hưởng tới tiến độ sprint',
        explanation_vi: 'Cảnh báo rủi ro về tiến độ.',
      },
      {
        slug: 'hope-to-resolve-today',
        phrase_en: 'I hope to resolve this by the end of today',
        phrase_vi: 'Tôi hy vọng sẽ xử lý xong việc này trong hôm nay',
        explanation_vi: 'Nêu mục tiêu khắc phục sự cố trong ngày.',
      },
    ],
  },

  // Unit 5: App/system description
  {
    slug: 'app-architecture-overview',
    unit_slug: 'app-description',
    unit_title_vi: 'Mô tả Ứng dụng & Hệ thống',
    stage: 3,
    level: 'B1',
    title_en: 'Explaining System Architecture',
    title_vi: 'Giải thích kiến trúc hệ thống',
    blurb_vi:
      'Học cách thuyết trình và giải thích kiến trúc ứng dụng (Monolith, Microservices, Cloud, DB).',
    objective_vi:
      'Thuyết trình tổng quan về kiến trúc phần mềm đang phát triển.',
    situation_vi: 'Giải thích hệ thống cho nhân sự mới hoặc khách hàng.',
    learner_role_vi: 'Full-stack Developer trình bày sơ đồ hệ thống.',
    prerequisite_lesson_slugs: ['standup-blockers'],
    pronunciation_focus_vi:
      'Nhấn âm chính xác: architecture, microservices, database, frontend, backend.',
    final_speaking_task_vi:
      'Mô tả bức tranh tổng thể kiến trúc ứng dụng của bạn trong 2 phút.',
    pass_conditions_vi:
      'Trình bày trôi chảy các thành phần hệ thống chính và luồng kết nối.',
    chunks: [
      {
        slug: 'app-built-with',
        phrase_en: 'Our application is built with a React frontend',
        phrase_vi: 'Ứng dụng của chúng tôi được xây dựng với frontend React',
        explanation_vi:
          'Cấu trúc Is built with dùng để mô tả công nghệ nền tảng.',
      },
      {
        slug: 'backend-powered-by',
        phrase_en: 'The backend service is powered by Node.js',
        phrase_vi: 'Dịch vụ backend được vận hành bởi Node.js',
        explanation_vi:
          'Is powered by nghĩa là chạy trên nền tảng công nghệ đó.',
      },
      {
        slug: 'uses-postgresql',
        phrase_en: 'We use PostgreSQL for relational data storage',
        phrase_vi: 'Chúng tôi dùng PostgreSQL để lưu trữ dữ liệu quan hệ',
        explanation_vi: 'Relational data storage chỉ cơ sở dữ liệu quan hệ.',
      },
      {
        slug: 'hosted-on-aws',
        phrase_en: 'The entire infrastructure is hosted on AWS',
        phrase_vi: 'Toàn bộ hạ tầng được lưu trữ trên AWS',
        explanation_vi: 'Hosted on chỉ nơi đặt máy chủ hoặc dịch vụ đám mây.',
      },
      {
        slug: 'scalable-architecture',
        phrase_en: 'Designed as a microservice scalable architecture',
        phrase_vi: 'Được thiết kế theo kiến trúc microservice có thể mở rộng',
        explanation_vi:
          'Scalable architecture nghĩa là kiến trúc dễ nâng cấp dung lượng.',
      },
      {
        slug: 'communicates-via-grpc',
        phrase_en: 'Services communicate via gRPC and REST',
        phrase_vi: 'Các dịch vụ giao tiếp qua gRPC và REST',
        explanation_vi: 'Giao thức giao tiếp giữa các thành phần phần mềm.',
      },
      {
        slug: 'handles-high-traffic',
        phrase_en: 'It is optimized to handle high concurrent traffic',
        phrase_vi: 'Nó được tối ưu để xử lý lưu lượng truy cập đồng thời cao',
        explanation_vi:
          'High concurrent traffic chỉ lượng người dùng đông cùng lúc.',
      },
      {
        slug: 'modular-codebase',
        phrase_en: 'We maintain a clean and modular codebase',
        phrase_vi: 'Chúng tôi duy trì mã nguồn sạch và theo mô-đun',
        explanation_vi: 'Modular codebase giúp dễ bảo trì và mở rộng.',
      },
    ],
  },
  {
    slug: 'api-data-flow',
    unit_slug: 'app-description',
    unit_title_vi: 'Mô tả Ứng dụng & Hệ thống',
    stage: 3,
    level: 'B1',
    title_en: 'Describing API & Database Data Flow',
    title_vi: 'Mô tả luồng dữ liệu API & Cơ sở dữ liệu',
    blurb_vi:
      'Giải thích chi tiết luồng xử lý từ Client request -> API -> Database -> Response.',
    objective_vi:
      'Diễn tả từng bước luồng dữ liệu khi một tính năng được kích hoạt.',
    situation_vi:
      'Thảo luận với đồng nghiệp về cách tối ưu hoá luồng xử lý dữ liệu.',
    learner_role_vi: 'Backend Developer giải thích luồng xử lý request.',
    prerequisite_lesson_slugs: ['app-architecture-overview'],
    pronunciation_focus_vi:
      'Nhấn âm rõ ràng các hành động: sends, receives, fetches, transforms, returns.',
    final_speaking_task_vi:
      'Giải thích luồng dữ liệu tính năng đăng nhập từ giao diện xuống CSDL.',
    pass_conditions_vi:
      'Sử dụng đúng các từ nối thứ tự (first, then, after that, finally).',
    chunks: [
      {
        slug: 'client-sends-request',
        phrase_en: 'When the user clicks, the client sends an HTTP request',
        phrase_vi: 'Khi người dùng nhấp chuột, client sẽ gửi một HTTP request',
        explanation_vi: 'Bước đầu tiên trong luồng xử lý trang web.',
      },
      {
        slug: 'api-validates-token',
        phrase_en: 'The API middleware validates the JWT token',
        phrase_vi: 'Middleware của API sẽ xác thực mã token JWT',
        explanation_vi: 'Xác thực người dùng trước khi cho phép vào hệ thống.',
      },
      {
        slug: 'fetches-from-database',
        phrase_en: 'Then it fetches the user profile from database',
        phrase_vi: 'Sau đó nó sẽ lấy hồ sơ người dùng từ cơ sở dữ liệu',
        explanation_vi: 'Fetch data nghĩa là lấy dữ liệu từ DB.',
      },
      {
        slug: 'caches-in-redis',
        phrase_en: 'Frequent query results are cached in Redis',
        phrase_vi: 'Kết quả truy vấn thường xuyên được lưu đệm trong Redis',
        explanation_vi: 'Lưu đệm để tăng tốc độ truy xuất.',
      },
      {
        slug: 'transforms-payload',
        phrase_en: 'The server transforms the data payload into JSON',
        phrase_vi: 'Máy chủ chuyển đổi dữ liệu thành định dạng JSON',
        explanation_vi: 'Transform payload nghĩa là định dạng lại dữ liệu.',
      },
      {
        slug: 'returns-status-200',
        phrase_en: 'It returns a 200 OK status code with response',
        phrase_vi: 'Nó trả về mã trạng thái 200 OK cùng dữ liệu phản hồi',
        explanation_vi: 'Mã thành công tiêu chuẩn của HTTP.',
      },
      {
        slug: 'handles-error-gracefully',
        phrase_en: 'If validation fails, it handles the error gracefully',
        phrase_vi: 'Nếu xác thực thất bại, nó xử lý lỗi một cách êm đẹp',
        explanation_vi:
          'Handle gracefully nghĩa là báo lỗi rõ ràng không làm sập ứng dụng.',
      },
      {
        slug: 'asynchronous-processing',
        phrase_en: 'Heavy tasks use background asynchronous processing',
        phrase_vi: 'Tác vụ nặng sử dụng xử lý bất đồng bộ trong nền',
        explanation_vi: 'Xử lý bất đồng bộ tránh làm đơ giao diện.',
      },
    ],
  },

  // Unit 6: Bug report
  {
    slug: 'reporting-production-bug',
    unit_slug: 'bug-report',
    unit_title_vi: 'Báo lỗi & Sự cố Kỹ thuật (Bug Report)',
    stage: 3,
    level: 'B1',
    title_en: 'Reporting a Production Bug',
    title_vi: 'Báo cáo lỗi trên môi trường Production',
    blurb_vi:
      'Mô tả hiện tượng sự cố, các bước tái hiện lỗi (reproduction steps) và mức độ nghiêm trọng.',
    objective_vi:
      'Trình bày một báo cáo sự cố (bug report) chuẩn cho nhóm phát triển.',
    situation_vi: 'Phát hiện sự cố thanh toán trên hệ thống live.',
    learner_role_vi: 'Developer / Tester phát hiện lỗi nghiêm trọng.',
    prerequisite_lesson_slugs: ['api-data-flow'],
    pronunciation_focus_vi:
      'Phát âm chuẩn từ bug, error, steps to reproduce, severity, critical.',
    final_speaking_task_vi:
      'Trình bày sự cố lỗi thanh toán kèm các bước tái hiện trong 90 giây.',
    pass_conditions_vi:
      'Nêu rõ ràng 3 phần: Lỗi gì, Bước tái hiện, Mức độ ưu tiên.',
    chunks: [
      {
        slug: 'found-critical-bug',
        phrase_en: 'I found a critical bug on production environment',
        phrase_vi: 'Tôi vừa phát hiện một lỗi nghiêm trọng trên production',
        explanation_vi: 'Critical bug chỉ lỗi có mức độ ảnh hưởng lớn nhất.',
      },
      {
        slug: 'steps-to-reproduce',
        phrase_en: 'Here are the steps to reproduce the issue',
        phrase_vi: 'Dưới đây là các bước để tái hiện sự cố này',
        explanation_vi: 'Cụm từ tiêu chuẩn khi báo cáo bug.',
      },
      {
        slug: 'app-crashes-when',
        phrase_en: 'The app crashes when user submits the form',
        phrase_vi: 'Ứng dụng bị sập khi người dùng gửi biểu mẫu',
        explanation_vi: 'Mô tả hiện tượng lỗi đơ / sập app.',
      },
      {
        slug: 'null-pointer-exception',
        phrase_en: 'It throws an unhandled null pointer exception',
        phrase_vi: 'Nó bắn ra ngoại lệ con trỏ null không được xử lý',
        explanation_vi: 'Tên lỗi lập trình rất phổ biến.',
      },
      {
        slug: 'affects-mobile-users',
        phrase_en: 'This bug mainly affects iOS mobile users',
        phrase_vi: 'Lỗi này chủ yếu ảnh hưởng đến người dùng di động iOS',
        explanation_vi: 'Khoanh vùng đối tượng bị ảnh hưởng.',
      },
      {
        slug: 'high-priority-ticket',
        phrase_en: 'I have logged a high priority ticket on Jira',
        phrase_vi: 'Tôi đã tạo một thẻ ưu tiên cao trên Jira',
        explanation_vi: 'Ghi nhận lỗi vào hệ thống quản lý.',
      },
      {
        slug: 'rollback-release',
        phrase_en: 'We might need to rollback the latest release',
        phrase_vi: 'Chúng ta có thể cần khôi phục lại bản phát hành gần nhất',
        explanation_vi: 'Rollback là rút lại phiên bản lỗi.',
      },
      {
        slug: 'hotfix-in-progress',
        phrase_en: 'A hotfix branch is currently in progress',
        phrase_vi: 'Nhánh sửa lỗi khẩn cấp (hotfix) đang được xử lý',
        explanation_vi: 'Hotfix chỉ việc sửa lỗi nhanh trực tiếp.',
      },
    ],
  },
  {
    slug: 'bug-triage-root-cause',
    unit_slug: 'bug-report',
    unit_title_vi: 'Báo lỗi & Sự cố Kỹ thuật (Bug Report)',
    stage: 3,
    level: 'B2',
    title_en: 'Bug Triage & Root Cause Analysis',
    title_vi: 'Phân loại lỗi & Phân tích nguyên nhân gốc rễ',
    blurb_vi:
      'Giải thích nguyên nhân sâu xa (root cause) gây ra sự cố và phương án khắc phục triệt để.',
    objective_vi:
      'Trình bày kết quả phân tích nguyên nhân gốc rễ của sự cố hệ thống.',
    situation_vi: 'Buổi họp post-mortem sau khi đã xử lý xong sự cố kỹ thuật.',
    learner_role_vi: 'Senior Developer báo cáo nguyên nhân sự cố cho nhóm.',
    prerequisite_lesson_slugs: ['reporting-production-bug'],
    pronunciation_focus_vi:
      'Phát âm chuẩn từ root cause, investigation, memory leak, patch, preventive measure.',
    final_speaking_task_vi:
      'Giải thích nguyên nhân rò rỉ bộ nhớ và biện pháp ngăn ngừa.',
    pass_conditions_vi:
      'Nêu chính xác nguyên nhân gốc rễ và kế hoạch phòng ngừa.',
    chunks: [
      {
        slug: 'root-cause-was',
        phrase_en: 'The root cause was an unindexed database query',
        phrase_vi:
          'Nguyên nhân gốc rễ là một truy vấn cơ sở dữ liệu chưa được đánh chỉ mục',
        explanation_vi: 'Root cause chỉ nguyên nhân bản chất gây ra sự cố.',
      },
      {
        slug: 'investigated-the-logs',
        phrase_en: 'We investigated server logs and trace metrics',
        phrase_vi:
          'Chúng tôi đã điều tra nhật ký máy chủ và các chỉ số theo vết',
        explanation_vi: 'Quá trình rà soát dữ liệu tìm lỗi.',
      },
      {
        slug: 'race-condition',
        phrase_en: 'The issue was triggered by a race condition',
        phrase_vi:
          'Sự cố bị kích hoạt bởi tình trạng tranh chấp (race condition)',
        explanation_vi: 'Lỗi xảy ra do xung đột thời gian thực thi.',
      },
      {
        slug: 'memory-leak-identified',
        phrase_en: 'A memory leak was identified in event listener',
        phrase_vi:
          'Sự cố rò rỉ bộ nhớ được phát hiện ở trình lắng nghe sự kiện',
        explanation_vi: 'Rò rỉ bộ nhớ làm tràn RAM máy chủ.',
      },
      {
        slug: 'applied-a-patch',
        phrase_en: 'We applied a temporary patch to stabilize system',
        phrase_vi: 'Chúng tôi đã áp dụng bản vá tạm thời để ổn định hệ thống',
        explanation_vi: 'Patch là bản sửa lỗi nhanh.',
      },
      {
        slug: 'preventive-measures',
        phrase_en: 'We added preventive measures including automated tests',
        phrase_vi:
          'Chúng tôi đã thêm các biện pháp phòng ngừa gồm kiểm thử tự động',
        explanation_vi: 'Preventive measures nghĩa là biện pháp ngăn tái diễn.',
      },
      {
        slug: 'post-mortem-report',
        phrase_en: 'I will publish the post-mortem report today',
        phrase_vi: 'Tôi sẽ xuất bản báo cáo phân tích sau sự cố trong hôm nay',
        explanation_vi: 'Post-mortem report là báo cáo tổng kết sự cố.',
      },
      {
        slug: 'system-fully-recovered',
        phrase_en: 'The system is now fully recovered and stable',
        phrase_vi: 'Hệ thống hiện đã phục hồi hoàn toàn và ổn định',
        explanation_vi: 'Thông báo hoàn tất xử lý sự cố.',
      },
    ],
  },

  // Unit 7: Career profile
  {
    slug: 'technical-skills-profile',
    unit_slug: 'career-profile',
    unit_title_vi: 'Hồ sơ Nghề nghiệp & Kỹ năng (Career Profile)',
    stage: 4,
    level: 'B1',
    title_en: 'Highlighting Technical Skills & Experience',
    title_vi: 'Nổi bật kỹ năng kỹ thuật và kinh nghiệm',
    blurb_vi:
      'Tự tin trình bày hồ sơ năng lực cá nhân, điểm mạnh công nghệ và số năm kinh nghiệm.',
    objective_vi:
      'Trình bày hồ sơ kỹ năng lập trình trong bài phỏng vấn hoặc giới thiệu chuyên môn.',
    situation_vi:
      'Giới thiệu hồ sơ với nhà tuyển dụng hoặc đối tác nước ngoài.',
    learner_role_vi: 'Ứng viên lập trình viên giới thiệu bản thân.',
    prerequisite_lesson_slugs: ['bug-triage-root-cause'],
    pronunciation_focus_vi:
      'Phát âm tự nhiên các từ chỉ kỹ năng: specialized in, proficient in, experience, stack.',
    final_speaking_task_vi:
      'Trình bày tóm tắt 2 phút về kinh nghiệm và điểm mạnh công nghệ của bạn.',
    pass_conditions_vi:
      'Trình bày tự tin, mạch lạc với đầy đủ từ vựng chuyên môn.',
    chunks: [
      {
        slug: 'specialize-in-fullstack',
        phrase_en: 'I specialize in full-stack web development',
        phrase_vi: 'Tôi chuyên về phát triển web full-stack',
        explanation_vi:
          'Specialize in sth nghĩa là có chuyên môn sâu về lĩnh vực đó.',
      },
      {
        slug: 'over-three-years',
        phrase_en: 'I have over three years of commercial experience',
        phrase_vi: 'Tôi có hơn ba năm kinh nghiệm làm dự án thương mại',
        explanation_vi:
          'Commercial experience chỉ kinh nghiệm làm sản phẩm thật.',
      },
      {
        slug: 'proficient-in-ts',
        phrase_en: 'I am proficient in TypeScript and React Native',
        phrase_vi: 'Tôi thành thạo TypeScript và React Native',
        explanation_vi: 'Proficient in sth chỉ mức độ thành thạo cao.',
      },
      {
        slug: 'hands-on-experience',
        phrase_en: 'I have hands-on experience with Docker and CI',
        phrase_vi: 'Tôi có kinh nghiệm thực chiến với Docker và CI',
        explanation_vi: 'Hands-on experience nghĩa là kinh nghiệm làm thực tế.',
      },
      {
        slug: 'building-scalable-apps',
        phrase_en: 'My core strength is building scalable applications',
        phrase_vi:
          'Điểm mạnh cốt lõi của tôi là xây dựng ứng dụng có khả năng mở rộng',
        explanation_vi: 'Cụm từ nhấn mạnh thế mạnh bản thân.',
      },
      {
        slug: 'agile-scrum-background',
        phrase_en: 'I have worked extensively in Agile Scrum environments',
        phrase_vi: 'Tôi đã làm việc nhiều trong môi trường Agile Scrum',
        explanation_vi: 'Kinh nghiệm làm việc theo phương pháp Agile.',
      },
      {
        slug: 'continuous-learning',
        phrase_en: 'I am passionate about continuous technical learning',
        phrase_vi: 'Tôi đam mê học hỏi kỹ thuật liên tục',
        explanation_vi: 'Thể hiện tinh thần học hỏi phấn đấu.',
      },
      {
        slug: 'strong-problem-solving',
        phrase_en: 'I possess strong problem-solving capabilities',
        phrase_vi: 'Tôi sở hữu khả năng giải quyết vấn đề tốt',
        explanation_vi: 'Problem-solving skill là kỹ năng mềm quan trọng.',
      },
    ],
  },
  {
    slug: 'project-impact-summary',
    unit_slug: 'career-profile',
    unit_title_vi: 'Hồ sơ Nghề nghiệp & Kỹ năng (Career Profile)',
    stage: 4,
    level: 'B2',
    title_en: 'Describing Past Project Impact & Wins',
    title_vi: 'Mô tả tác động và thành tựu dự án quá khứ',
    blurb_vi:
      'Diễn tả các thành tích kỹ thuật (tăng tốc độ nạp trang, giảm chi phí server, cải thiện retention).',
    objective_vi:
      'Trình bày các kết quả và tác động định lượng (metrics) bạn đạt được trong dự án cũ.',
    situation_vi: 'Trả lời câu hỏi phỏng vấn về thành tựu đáng nhớ nhất.',
    learner_role_vi: 'Lập trình viên thuyết minh kết quả công việc.',
    prerequisite_lesson_slugs: ['technical-skills-profile'],
    pronunciation_focus_vi:
      'Nhấn giọng các con số và chỉ số tác động: reduced, improved, optimized, increased.',
    final_speaking_task_vi:
      'Kể lại một dự án bạn đã cải thiện hiệu năng thành công.',
    pass_conditions_vi:
      'Sử dụng mô hình STAR (Situation, Task, Action, Result) và số liệu cụ thể.',
    chunks: [
      {
        slug: 'reduced-load-time',
        phrase_en: 'I reduced initial page load time by 40 percent',
        phrase_vi: 'Tôi đã giảm 40% thời gian nạp trang ban đầu',
        explanation_vi: 'Cách dùng con số định lượng thành tích.',
      },
      {
        slug: 'refactored-legacy-code',
        phrase_en: 'I refactored legacy codebase to improve maintainability',
        phrase_vi: 'Tôi đã viết lại mã nguồn cũ để tăng khả năng bảo trì',
        explanation_vi: 'Refactor code nghĩa là tối ưu cấu trúc code cũ.',
      },
      {
        slug: 'optimized-db-queries',
        phrase_en: 'I optimized SQL queries for high-volume transactions',
        phrase_vi:
          'Tôi đã tối ưu các truy vấn SQL cho giao dịch dung lượng lớn',
        explanation_vi: 'Tối ưu hóa DB mang lại hiệu quả cao.',
      },
      {
        slug: 'led-a-team-of-four',
        phrase_en: 'I led a team of four developers on migration',
        phrase_vi: 'Tôi đã dẫn dắt nhóm 4 lập trình viên chuyển đổi hệ thống',
        explanation_vi: 'Thể hiện kỹ năng lãnh đạo / nhóm.',
      },
      {
        slug: 'zero-downtime-deployment',
        phrase_en: 'Achieved zero downtime during major system migration',
        phrase_vi:
          'Đạt chỉ số không có thời gian chết khi chuyển đổi hệ thống lớn',
        explanation_vi: 'Zero downtime là thành tựu kỹ thuật xuất sắc.',
      },
      {
        slug: 'improved-user-retention',
        phrase_en: 'This optimization directly improved user retention',
        phrase_vi:
          'Sự tối ưu này trực tiếp cải thiện tỷ lệ giữ chân người dùng',
        explanation_vi: 'Liên kết tác động kỹ thuật với giá trị kinh doanh.',
      },
      {
        slug: 'delivered-on-schedule',
        phrase_en: 'Delivered the core project features ahead of schedule',
        phrase_vi: 'Bàn giao các tính năng dự án cốt lõi vượt tiến độ',
        explanation_vi: 'Đảm bảo uy tín tiến độ.',
      },
      {
        slug: 'recognized-by-leadership',
        phrase_en: 'My contribution was recognized by engineering leadership',
        phrase_vi: 'Đóng góp của tôi được ban lãnh đạo kỹ thuật ghi nhận',
        explanation_vi: 'Được đánh giá cao trong tổ chức.',
      },
    ],
  },

  // Unit 8: Project/interview practice
  {
    slug: 'mock-interview-system-design',
    unit_slug: 'interview-practice',
    unit_title_vi: 'Luyện tập Phỏng vấn & Dự án (Interview Practice)',
    stage: 4,
    level: 'B2',
    title_en: 'Mock Technical Interview: System Design',
    title_vi: 'Phỏng vấn kỹ thuật thử nghiệm: Thiết kế hệ thống',
    blurb_vi:
      'Luyện tập câu hỏi phỏng vấn thiết kế hệ thống (System Design Interview) quy mô lớn.',
    objective_vi:
      'Trả lời câu hỏi phỏng vấn thiết kế ứng dụng chat hoặc ứng dụng đặt xe.',
    situation_vi:
      'Vòng phỏng vấn kỹ thuật trực tiếp với Senior Technical Interviewer.',
    learner_role_vi: 'Ứng viên trả lời bài toán thiết kế hệ thống.',
    prerequisite_lesson_slugs: ['project-impact-summary'],
    pronunciation_focus_vi:
      'Phát âm chuẩn từ load balancer, message queue, caching, redundancy, bottleneck.',
    final_speaking_task_vi:
      'Trình bày giải pháp thiết kế hệ thống thông báo đẩy cho 1 triệu người dùng.',
    pass_conditions_vi:
      'Phân tích trôi chảy các thành phần và rủi ro nghẽn cổ chai.',
    chunks: [
      {
        slug: 'start-with-requirements',
        phrase_en: 'Let us start by clarifying functional requirements',
        phrase_vi: 'Hãy bắt đầu bằng việc làm rõ các yêu cầu chức năng',
        explanation_vi: 'Bước 1 chuẩn trong phỏng vấn System Design.',
      },
      {
        slug: 'estimate-traffic-storage',
        phrase_en: 'I will estimate daily active users and storage needs',
        phrase_vi:
          'Tôi sẽ ước tính lượng người dùng hàng ngày và dung lượng lưu trữ',
        explanation_vi: 'Tính toán quy mô dữ liệu.',
      },
      {
        slug: 'use-load-balancer',
        phrase_en: 'We should place a load balancer in front of API',
        phrase_vi: 'Chúng ta nên đặt bộ cân bằng tải phía trước API',
        explanation_vi: 'Cân bằng tải để chia đều request.',
      },
      {
        slug: 'message-queue-decoupling',
        phrase_en: 'Use a message queue like Kafka for decoupling',
        phrase_vi: 'Sử dụng hàng đợi tin nhắn như Kafka để tách biệt dịch vụ',
        explanation_vi: 'Decoupling giúp các dịch vụ độc lập.',
      },
      {
        slug: 'database-sharding',
        phrase_en: 'We can apply database sharding to handle scale',
        phrase_vi: 'Chúng ta có thể áp dụng phân mảnh DB để xử lý quy mô lớn',
        explanation_vi: 'Database sharding là kỹ thuật chia nhỏ CSDL.',
      },
      {
        slug: 'single-point-of-failure',
        phrase_en: 'We must eliminate any single point of failure',
        phrase_vi: 'Chúng ta phải loại bỏ bất kỳ điểm lỗi đơn lẻ nào',
        explanation_vi:
          'Single point of failure khiến cả hệ thống sập khi 1 nút chết.',
      },
      {
        slug: 'trade-offs-between-dbs',
        phrase_en: 'There is a trade-off between SQL and NoSQL here',
        phrase_vi: 'Có sự đánh đổi giữa SQL và NoSQL ở đây',
        explanation_vi: 'Phân tích sự đánh đổi kỹ thuật (trade-offs).',
      },
      {
        slug: 'summary-of-architecture',
        phrase_en: 'That concludes my high-level architecture design',
        phrase_vi: 'Đó là toàn bộ phần thiết kế kiến trúc mức cao của tôi',
        explanation_vi: 'Chốt lại câu trả lời phỏng vấn.',
      },
    ],
  },
  {
    slug: 'mock-interview-behavioral',
    unit_slug: 'interview-practice',
    unit_title_vi: 'Luyện tập Phỏng vấn & Dự án (Interview Practice)',
    stage: 4,
    level: 'B2',
    title_en: 'Mock Technical Interview: Behavioral Q&A',
    title_vi: 'Phỏng vấn kỹ thuật thử nghiệm: Trả lời tình huống (Behavioral)',
    blurb_vi:
      'Luyện trả lời các câu hỏi tình huống khi bất đồng ý kiến với Tech Lead hoặc giải quyết mâu thuẫn.',
    objective_vi:
      'Trả lời trôi chảy các câu hỏi phỏng vấn ứng xử tình huống kỹ thuật.',
    situation_vi:
      'Vòng phỏng vấn văn hóa và cách làm việc với Engineering Manager.',
    learner_role_vi: 'Ứng viên thể hiện kỹ năng giao tiếp và làm việc nhóm.',
    prerequisite_lesson_slugs: ['mock-interview-system-design'],
    pronunciation_focus_vi:
      'Nhấn âm tự nhiên, thể hiện sự chuyên nghiệp và thiện chí hợp tác.',
    final_speaking_task_vi:
      'Kể lại tình huống bạn bất đồng quan điểm kỹ thuật với đồng nghiệp và cách xử lý.',
    pass_conditions_vi:
      'Cấu trúc câu trả lời mạch lạc, mang tính xây dựng cao.',
    chunks: [
      {
        slug: 'disagreed-on-approach',
        phrase_en: 'When we disagreed on technical approach',
        phrase_vi: 'Khi chúng tôi không thống nhất về hướng tiếp cận kỹ thuật',
        explanation_vi: 'Mở đầu mô tả mâu thuẫn quan điểm.',
      },
      {
        slug: 'listened-to-perspective',
        phrase_en: 'I first listened to their perspective carefully',
        phrase_vi: 'Đầu tiên tôi lắng nghe góc nhìn của họ một cách cẩn thận',
        explanation_vi: 'Thể hiện thái độ tôn trọng đồng nghiệp.',
      },
      {
        slug: 'proposed-a-poc',
        phrase_en: 'I proposed building a quick Proof of Concept',
        phrase_vi: 'Tôi đề xuất làm một bản thử nghiệm PoC nhanh',
        explanation_vi: 'PoC giúp dùng thực tế chứng minh lý thuyết.',
      },
      {
        slug: 'data-driven-decision',
        phrase_en: 'We made a data-driven decision based on benchmarks',
        phrase_vi: 'Chúng tôi đưa ra quyết định dựa trên dữ liệu chuẩn đo kiểm',
        explanation_vi: 'Quyết định dựa trên số liệu khách quan.',
      },
      {
        slug: 'handled-tight-deadline',
        phrase_en: 'How I handled a tight deadline under pressure',
        phrase_vi: 'Cách tôi xử lý áp lực thời hạn gấp',
        explanation_vi: 'Kỹ năng quản lý áp lực.',
      },
      {
        slug: 'communicated-proactively',
        phrase_en: 'I communicated proactively with stakeholders',
        phrase_vi: 'Tôi đã chủ động giao tiếp với các bên liên quan',
        explanation_vi: 'Giao tiếp chủ động tránh hiểu lầm.',
      },
      {
        slug: 'learned-from-failure',
        phrase_en: 'What I learned from that project mistake',
        phrase_vi: 'Những gì tôi đã rút ra được từ sai lầm dự án đó',
        explanation_vi: 'Thể hiện tinh thần học hỏi từ thất bại.',
      },
      {
        slug: 'positive-outcome-achieved',
        phrase_en: 'In the end, we achieved a very positive outcome',
        phrase_vi: 'Cuối cùng, chúng tôi đã đạt được kết quả rất tích cực',
        explanation_vi: 'Kết thúc bằng kết quả tốt đẹp.',
      },
    ],
  },
];

// Helper to create SRS, Vocab, Grammar, Audio, Activity arrays for a lesson
function buildLessonJson(l) {
  const lessonId = makeId(`lesson:${l.slug}`);

  const chunks = l.chunks.map((c, i) => {
    const chunkId = makeId(`chunk:${l.slug}:${c.slug}`);
    const audioId = makeId(`audio:${l.slug}:aud-${c.slug}`);
    const srsId = makeId(`srs:${l.slug}:srs-${c.slug}`);
    const qaId = makeId(`qa:${l.slug}:qa-${c.slug}`);
    const turn1Id = makeId(`turn:${l.slug}:turn1-${c.slug}`);
    const turn2Id = makeId(`turn:${l.slug}:turn2-${c.slug}`);

    return {
      id: chunkId,
      slug: c.slug,
      order: i,
      phrase_en: c.phrase_en,
      phrase_vi: c.phrase_vi,
      explanation_vi: c.explanation_vi,
      context_sentence_en: `In our daily work: "${c.phrase_en}".`,
      context_sentence_vi: `Trong công việc hàng ngày: "${c.phrase_vi}".`,
      grammar_ref_ids: [],
      vocab_ref_ids: [],
      audio_ref_ids: [audioId],
      srs_ref_ids: [srsId],
      dialogue_turns: [
        {
          id: turn1Id,
          slug: `turn1-${c.slug}`,
          speaker: 'A',
          text_en: c.phrase_en + '?',
          text_vi: c.phrase_vi + '?',
        },
        {
          id: turn2Id,
          slug: `turn2-${c.slug}`,
          speaker: 'B',
          text_en: 'Yes, exactly.',
          text_vi: 'Đúng vậy, chính xác.',
        },
      ],
      qa_items: [
        {
          id: qaId,
          slug: `qa-${c.slug}`,
          type: 'multiple_choice',
          question: `Choose the correct meaning of "${c.phrase_en}":`,
          options: [c.phrase_vi, 'Một nghĩa khác không chính xác'],
          answer: c.phrase_vi,
          explanation_vi: `Dịch đúng là: ${c.phrase_vi}`,
        },
      ],
      remediation: {
        trigger: 'wrong_answer',
        re_present_refs: [srsId],
        tip_vi: `Hãy nhớ cụm từ "${c.phrase_en}" nghĩa là "${c.phrase_vi}".`,
      },
    };
  });

  const grammarPatterns = [
    {
      id: makeId(`grammar:${l.slug}:gp-1`),
      slug: `gp-1`,
      name_en: `Pattern for ${l.title_en}`,
      name_vi: `Mẫu câu chính bài ${l.title_vi}`,
      pattern: 'S + V + O',
      explanation_vi: `Mẫu câu cơ bản được sử dụng trong bài học này để trình bày ý kiến rõ ràng.`,
      tied_to_actions: ['speaking', 'listening'],
      examples: [
        {en: chunks[0].phrase_en, vi: chunks[0].phrase_vi},
        {en: chunks[1].phrase_en, vi: chunks[1].phrase_vi},
      ],
    },
  ];

  const vocabulary = chunks.slice(0, 3).map((c, idx) => ({
    id: makeId(`vocab:${l.slug}:v-${c.slug}`),
    slug: `v-${c.slug}`,
    word: c.phrase_en.split(' ')[0] || 'term',
    word_type: 'noun',
    meaning_vi: c.phrase_vi,
    pronunciation_guide_vi: 'phát âm chuẩn',
    ipa: '/təʊkən/',
    cefr_level: l.level,
    example_en: c.phrase_en,
    example_vi: c.phrase_vi,
  }));

  const activities = [
    {
      id: makeId(`activity:${l.slug}:shadowing-drill`),
      slug: 'shadowing-drill',
      type: 'listen_and_repeat',
      title_vi: 'Luyện nhại giọng (Shadowing)',
      chunk_ref_ids: chunks.map(c => c.id),
      qa_ref_ids: [],
      instructions_vi: 'Nghe từng câu mẫu và lặp lại thật rõ ràng.',
    },
    {
      id: makeId(`activity:${l.slug}:roleplay-drill`),
      slug: 'roleplay-drill',
      type: 'role_play',
      title_vi: 'Đóng vai tình huống (Role-play)',
      chunk_ref_ids: chunks.slice(0, 4).map(c => c.id),
      qa_ref_ids: [],
      instructions_vi: 'Thực hành đối thoại theo vai lập trình viên.',
    },
    {
      id: makeId(`activity:${l.slug}:quiz-drill`),
      slug: 'quiz-drill',
      type: 'multiple_choice',
      title_vi: 'Kiểm tra phản xạ chủ động',
      chunk_ref_ids: chunks.map(c => c.id),
      qa_ref_ids: chunks.map(c => c.qa_items[0].id),
      instructions_vi: 'Chọn đáp án đúng nhất cho từng câu hỏi.',
    },
  ];

  const audioAssets = chunks.map(c => ({
    id: makeId(`audio:${l.slug}:aud-${c.slug}`),
    slug: `aud-${c.slug}`,
    url: `https://assets.lingobites.app/audio/${l.slug}/${c.slug}.mp3`,
    checksum: 'sha256:placeholder',
    locale: 'en-US',
    transcript: c.phrase_en,
  }));

  const srsItems = chunks.map(c => ({
    id: makeId(`srs:${l.slug}:srs-${c.slug}`),
    slug: `srs-${c.slug}`,
    item_type: 'vocabulary',
    source_ref_id: c.id,
    front: c.phrase_en,
    back: c.phrase_vi,
    hint_vi: `Gợi ý: ${c.explanation_vi}`,
  }));

  const expectedErrors = [
    {
      category: 'vocabulary',
      trigger_condition: 'Quên từ vựng chuyên ngành',
      remediation_ref_id: srsItems[0].id,
      tip_vi: `Ôn tập lại cụm từ "${chunks[0].phrase_en}".`,
    },
    {
      category: 'pronunciation_affecting_meaning',
      trigger_condition: 'Phát âm sai tên công nghệ',
      remediation_ref_id: srsItems[1].id,
      tip_vi: `Luyện nghe lại audio câu mẫu "${chunks[1].phrase_en}".`,
    },
  ];

  return {
    id: lessonId,
    slug: l.slug,
    schema_version: '0.1.0',
    title_en: l.title_en,
    title_vi: l.title_vi,
    blurb_vi: l.blurb_vi,
    level: l.level,
    target_skills: ['speaking', 'listening'],
    estimated_duration_minutes: 15,
    objective_vi: l.objective_vi,
    situation_vi: l.situation_vi,
    learner_role_vi: l.learner_role_vi,
    prerequisite_lesson_slugs: l.prerequisite_lesson_slugs,
    pronunciation_focus_vi: l.pronunciation_focus_vi,
    final_speaking_task_vi: l.final_speaking_task_vi,
    pass_conditions_vi: l.pass_conditions_vi,
    unit_slug: l.unit_slug,
    unit_title_vi: l.unit_title_vi,
    stage: l.stage,
    expected_errors: expectedErrors,
    chunks,
    grammar_patterns: grammarPatterns,
    vocabulary,
    activities,
    audio_assets: audioAssets,
    srs_items: srsItems,
  };
}

// Generate all files
const createdFiles = [];

for (const lData of lessonsData) {
  const jsonObj = buildLessonJson(lData);
  const fileName = `${lData.slug}.lesson.json`;
  const filePath = path.join(pkgDir, fileName);
  fs.writeFileSync(filePath, JSON.stringify(jsonObj, null, 2), 'utf8');
  createdFiles.push({
    lesson_id: jsonObj.id,
    lesson_slug: jsonObj.slug,
    file: fileName,
  });
}

// Ensure existing daily-standup is also in manifest list
const dailyStandupPath = path.join(pkgDir, 'daily-standup.lesson.json');
const dailyStandupJson = JSON.parse(fs.readFileSync(dailyStandupPath, 'utf8'));

const allManifestLessons = [
  ...createdFiles.slice(0, 6), // Unit 1, 2, 3
  {
    lesson_id: dailyStandupJson.id,
    lesson_slug: dailyStandupJson.slug,
    file: 'daily-standup.lesson.json',
  },
  ...createdFiles.slice(6), // Unit 4 (lesson 8) to Unit 8
];

// Sort lesson entries deterministically or by stage/slug
const manifestSlug = 'daily-standup'; // preserve original package slug
const packageId = makeId(`package:${manifestSlug}`); // 732eebf68ad6d6ea

const checks = [
  {
    id: makeId('check:weekly-check-unit1'),
    slug: 'weekly-check-unit1',
    type: 'weekly_check',
    stage: 1,
    unit_slug: 'introduction',
    title_en: 'Weekly Check: Introduction & Onboarding',
    title_vi: 'Kiểm tra tuần: Giới thiệu & Hội nhập',
    instructions_vi:
      'Đánh giá khả năng giới thiệu bản thân và môi trường công nghệ.',
    covered_lesson_slugs: ['self-introduction', 'team-onboarding'],
    items: [
      {
        id: makeId('checkitem:wk1-item1'),
        slug: 'wk1-item1',
        prompt_en:
          'Introduce your role as a full-stack developer working with React and Node.js.',
        prompt_vi:
          'Giới thiệu vai trò lập trình viên full-stack của bạn với React và Node.js.',
        rubric_vi:
          'Phát âm rõ ràng các công nghệ và sử dụng đúng mẫu câu giới thiệu.',
        target_chunk_ids: [makeId('chunk:self-introduction:hi-im-dev')],
      },
    ],
  },
  {
    id: makeId('check:stage-check-stage1'),
    slug: 'stage-check-stage1',
    type: 'stage_check',
    stage: 1,
    title_en: 'Stage 1 Check: Foundations & Communication',
    title_vi: 'Kiểm tra Giai đoạn 1: Nền tảng & Giao tiếp',
    instructions_vi:
      'Bài kiểm tra cột mốc giai đoạn 1 với tình huống thực hành chưa từng gặp.',
    covered_lesson_slugs: [
      'self-introduction',
      'team-onboarding',
      'asking-clarification',
      'confirming-requirements',
    ],
    items: [
      {
        id: makeId('checkitem:stg1-item1'),
        slug: 'stg1-item1',
        prompt_en:
          'Ask a colleague to repeat and clarify their requirements on Slack.',
        prompt_vi: 'Nhờ đồng nghiệp lặp lại và làm rõ yêu cầu trên Slack.',
        unseen_prompt_en:
          'Your Tech Lead explained a complex caching policy rapidly. Politely request them to slow down and post the details in Slack.',
        unseen_prompt_vi:
          'Tech Lead giải thích chính sách lưu đệm nhanh. Hãy lịch sự nhờ họ nói chậm lại và đăng chi tiết lên Slack.',
        rubric_vi: 'Sử dụng cấu trúc câu hỏi lịch sự chưa học vẹt.',
        target_chunk_ids: [
          makeId('chunk:asking-clarification:could-you-repeat'),
        ],
      },
    ],
  },
];

const progressionGraph = {
  stages: [
    {
      stage: 1,
      name_vi: 'Nền tảng & Giao tiếp ban đầu',
      unit_slugs: ['introduction', 'clarification'],
    },
    {
      stage: 2,
      name_vi: 'Làm việc nhóm & Họp hàng ngày',
      unit_slugs: ['team-roles', 'daily-standup'],
    },
    {
      stage: 3,
      name_vi: 'Mô tả hệ thống & Báo cáo sự cố',
      unit_slugs: ['app-description', 'bug-report'],
    },
    {
      stage: 4,
      name_vi: 'Hồ sơ cá nhân & Phỏng vấn kỹ thuật',
      unit_slugs: ['career-profile', 'interview-practice'],
    },
  ],
};

const manifestJson = {
  schema_version: '0.1.0',
  package_id: packageId,
  slug: manifestSlug,
  format: 'hybrid-zip',
  exported_at: '2026-09-06T23:15:00.000Z',
  lessons: allManifestLessons,
  audio_base_url: 'https://assets.lingobites.app/audio/daily-standup/',
  tool_version: '0.1.0',
  checks,
  progression_graph: progressionGraph,
};

fs.writeFileSync(
  path.join(pkgDir, 'manifest.json'),
  JSON.stringify(manifestJson, null, 2),
  'utf8',
);
console.log(
  `Successfully generated ${allManifestLessons.length} lessons in ${pkgDir}`,
);

// Build stored ZIP and bundled asset for mobile app bootstrap
const CRC_TABLE = (function () {
  const t = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = (CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)) >>> 0;
  }
  return (c ^ 0xffffffff) >>> 0;
}

function concatBytes(chunks) {
  const total = chunks.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(total);
  let p = 0;
  for (const c of chunks) {
    out.set(c, p);
    p += c.length;
  }
  return out;
}

function buildStoredZip(entries) {
  const builtEntries = entries.map(([name, data]) => {
    const nameBytes = Buffer.from(name, 'utf8');
    const crc = crc32(data);
    const local = new Uint8Array(30 + nameBytes.length + data.length);
    const dv = new DataView(local.buffer);
    dv.setUint32(0, 0x04034b50, true);
    dv.setUint16(4, 20, true);
    dv.setUint16(6, 0, true);
    dv.setUint16(8, 0, true);
    dv.setUint16(10, 0, true);
    dv.setUint16(12, 0, true);
    dv.setUint32(14, crc, true);
    dv.setUint32(18, data.length, true);
    dv.setUint32(22, data.length, true);
    dv.setUint16(26, nameBytes.length, true);
    dv.setUint16(28, 0, true);
    local.set(nameBytes, 30);
    local.set(data, 30 + nameBytes.length);
    return {
      local,
      central: {
        name: nameBytes,
        crc32: crc,
        compressedSize: data.length,
        uncompressedSize: data.length,
        localHeaderOffset: 0,
      },
    };
  });

  let localOffset = 0;
  const localChunks = [];
  for (const e of builtEntries) {
    e.central.localHeaderOffset = localOffset;
    localChunks.push(e.local);
    localOffset += e.local.length;
  }

  let cdSize = 0;
  for (const e of builtEntries) {
    cdSize += 46 + e.central.name.length;
  }

  const local = concatBytes(localChunks);
  const cd = new Uint8Array(cdSize);
  const cdDv = new DataView(cd.buffer);
  let cdOffset = 0;
  for (const e of builtEntries) {
    cdDv.setUint32(cdOffset + 0, 0x02014b50, true);
    cdDv.setUint16(cdOffset + 4, 20, true);
    cdDv.setUint16(cdOffset + 6, 20, true);
    cdDv.setUint16(cdOffset + 8, 0, true);
    cdDv.setUint16(cdOffset + 10, 0, true);
    cdDv.setUint16(cdOffset + 12, 0, true);
    cdDv.setUint16(cdOffset + 14, 0, true);
    cdDv.setUint32(cdOffset + 16, e.central.crc32, true);
    cdDv.setUint32(cdOffset + 20, e.central.compressedSize, true);
    cdDv.setUint32(cdOffset + 24, e.central.uncompressedSize, true);
    cdDv.setUint16(cdOffset + 28, e.central.name.length, true);
    cdDv.setUint16(cdOffset + 30, 0, true);
    cdDv.setUint16(cdOffset + 32, 0, true);
    cdDv.setUint16(cdOffset + 34, 0, true);
    cdDv.setUint16(cdOffset + 36, 0, true);
    cdDv.setUint32(cdOffset + 38, 0, true);
    cdDv.setUint32(cdOffset + 42, e.central.localHeaderOffset, true);
    cd.set(e.central.name, cdOffset + 46);
    cdOffset += 46 + e.central.name.length;
  }

  const eocd = new Uint8Array(22);
  const eocdDv = new DataView(eocd.buffer);
  eocdDv.setUint32(0, 0x06054b50, true);
  eocdDv.setUint16(4, 0, true);
  eocdDv.setUint16(6, 0, true);
  eocdDv.setUint16(8, builtEntries.length, true);
  eocdDv.setUint16(10, builtEntries.length, true);
  eocdDv.setUint32(12, cdSize, true);
  eocdDv.setUint32(16, local.length, true);
  eocdDv.setUint16(20, 0, true);

  return concatBytes([local, cd, eocd]);
}

const zipEntries = [];
const manifestBytes = fs.readFileSync(path.join(pkgDir, 'manifest.json'));
zipEntries.push(['manifest.json', manifestBytes]);

for (const lessonEntry of allManifestLessons) {
  const lessonBytes = fs.readFileSync(path.join(pkgDir, lessonEntry.file));
  zipEntries.push([lessonEntry.file, lessonBytes]);
}

const zipBytes = buildStoredZip(zipEntries);
const zipBuffer = Buffer.from(zipBytes);
const sha256 = createHash('sha256').update(zipBuffer).digest('hex');
const base64 = zipBuffer.toString('base64');

// Write daily-standup.zip
const zipPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  'packages',
  'daily-standup.zip',
);
fs.writeFileSync(zipPath, zipBuffer);

// Write src/features/lesson/packages/logic/bootstrap/bundledPackageData.ts
const bootstrapDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'src',
  'features',
  'lesson',
  'packages',
  'logic',
  'bootstrap',
);
fs.mkdirSync(bootstrapDir, {recursive: true});
const tsContent = `/**
 * Auto-generated by tools/content-lint/build-mvp-package.mjs.
 * Do not edit manually.
 */

export const BUNDLED_PACKAGE_SLUG = '${manifestSlug}';
export const BUNDLED_PACKAGE_VERSION = '0.1.0';
export const BUNDLED_PACKAGE_SHA256 = '${sha256}';
export const BUNDLED_PACKAGE_ZIP_BASE64 = '${base64}';
`;

fs.writeFileSync(
  path.join(bootstrapDir, 'bundledPackageData.ts'),
  tsContent,
  'utf8',
);
console.log(
  `Successfully generated bundled package zip (${zipBuffer.length} bytes, SHA-256: ${sha256}) and updated bundledPackageData.ts`,
);
