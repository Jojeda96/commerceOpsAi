import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            login: jest.fn().mockImplementation((email, password) => {
              if (email === 'demo@commerceops.ai' && password === 'demo1234') {
                return {
                  accessToken: 'mock-jwt-token',
                  user: { id: 'usr-1', email },
                };
              }
              throw new Error('Credenciales inválidas');
            }),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
  });

  it('debe estar definido', () => {
    expect(controller).toBeDefined();
  });

  it('debe autenticar credenciales válidas y devolver un JWT', async () => {
    const result = await controller.login({
      email: 'demo@commerceops.ai',
      password: 'demo1234',
    });
    expect(result).toHaveProperty('accessToken');
    expect(result.accessToken).toBe('mock-jwt-token');
  });

  it('debe fallar ante credenciales incorrectas', async () => {
    await expect(
      controller.login({
        email: 'wrong@commerceops.ai',
        password: 'badpassword',
      }),
    ).rejects.toThrow();
  });
});
