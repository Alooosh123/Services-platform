import { IsString } from 'class-validator';
import { createGlobalValidationPipe } from './main';

class ValidationFixtureDto {
  @IsString()
  name!: string;
}

describe('createGlobalValidationPipe', () => {
  const metadata = {
    type: 'body' as const,
    metatype: ValidationFixtureDto,
    data: undefined,
  };

  it('rejects properties not declared by the DTO', async () => {
    const pipe = createGlobalValidationPipe();

    await expect(
      pipe.transform({ name: 'valid', unexpected: true }, metadata),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('rejects values that violate DTO validators', async () => {
    const pipe = createGlobalValidationPipe();

    await expect(pipe.transform({ name: null }, metadata)).rejects.toMatchObject({
      status: 400,
    });
  });

  it('transforms valid payloads to DTO instances', async () => {
    const pipe = createGlobalValidationPipe();

    await expect(pipe.transform({ name: 'valid' }, metadata)).resolves.toBeInstanceOf(
      ValidationFixtureDto,
    );
  });
});
