import { Global, Module } from "@nestjs/common";
import { JwtModule, type JwtSignOptions } from "@nestjs/jwt";
import { loadEnv } from "../config/env";
import { AuthContextService } from "./auth-context.service";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: () => {
        const env = loadEnv();
        return {
          secret: env.JWT_SECRET,
          // `expiresIn` is typed as a template-literal union by @types/ms; our
          // value is validated as a non-empty string, so widen it here.
          signOptions: { expiresIn: env.JWT_EXPIRES_IN as JwtSignOptions["expiresIn"] },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthContextService],
  exports: [AuthService, AuthContextService, JwtModule],
})
export class AuthModule {}
