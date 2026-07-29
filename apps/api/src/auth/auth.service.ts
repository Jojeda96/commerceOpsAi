import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  async login(email: string, pass: string) {
    const demoEmail = process.env.DEMO_USER_EMAIL || 'demo@commerceops.ai';
    const demoPass = process.env.DEMO_USER_PASSWORD || 'demo123';

    if (email !== demoEmail || pass !== demoPass) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const payload = { sub: 'user-demo-1', email, role: 'admin' };
    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: 'user-demo-1',
        email,
        name: 'Demo User',
        role: 'admin',
      },
    };
  }
}
