import {momentFailureMessage} from '../momentMessages';

const t = (key: string, options?: Record<string, unknown>) =>
  options ? `${key}:${JSON.stringify(options)}` : key;

describe('momentFailureMessage', () => {
  it('names the daily limit when the server refuses for quota', () => {
    expect(momentFailureMessage('COMPOSE_LIMIT_REACHED', t, 10)).toBe(
      'moment.limit_reached:{"limit":10}',
    );
    expect(momentFailureMessage('COMPOSE_LIMIT_REACHED', t)).toBe(
      'moment.limit_reached_plain',
    );
  });

  it('explains refusals that used to read as a generic failure', () => {
    expect(momentFailureMessage('MOMENT_RUNNING', t)).toBe('moment.running');
    expect(momentFailureMessage('MOMENT_DISABLED', t)).toBe('moment.disabled');
    expect(momentFailureMessage('STORE_UNAVAILABLE', t)).toBe(
      'moment.unavailable',
    );
    expect(momentFailureMessage('HTTP_500', t)).toBe('moment.generic_failed');
  });
});
