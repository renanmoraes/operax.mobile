import { MOBILE_CLIENT_HEADER } from '@/src/shared/config';

describe('mobile client header', () => {
  it('usa X-Client canônico', () => {
    expect(MOBILE_CLIENT_HEADER).toBe('operax-mobile');
  });
});
