import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { PlanGuardService } from './plan-guard.service';

describe('PlanGuardService.requireApprovedAccount (spec 002 AC11, AC12)', () => {
  const findUnique = jest.fn();
  const guard = new PlanGuardService({
    user: { findUnique },
  } as unknown as PrismaService);

  afterEach(() => findUnique.mockReset());

  it('passes for an ACTIVE owner', async () => {
    findUnique.mockResolvedValue({ accountStatus: 'ACTIVE' });
    await expect(guard.requireApprovedAccount('o1')).resolves.toBeUndefined();
  });

  it.each(['PENDING', 'SUSPENDED'])(
    'rejects a %s owner with ACCOUNT_NOT_APPROVED',
    async (status) => {
      findUnique.mockResolvedValue({ accountStatus: status });
      await expect(guard.requireApprovedAccount('o1')).rejects.toMatchObject({
        code: 'ACCOUNT_NOT_APPROVED',
        statusCode: 403,
      });
    },
  );

  it('rejects an unknown owner', async () => {
    findUnique.mockResolvedValue(null);
    await expect(guard.requireApprovedAccount('missing')).rejects.toMatchObject(
      {
        code: 'ACCOUNT_NOT_APPROVED',
      },
    );
  });
});
