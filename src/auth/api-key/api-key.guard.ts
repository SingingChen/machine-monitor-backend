import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    // 從 HTTP Header 取得自定義的欄位 x-api-key
    const clientKey = request.headers['x-api-key'];

    // 從環境變數取得我們設定的正確答案
    const serverKey = process.env.API_KEY;

    // 比對金鑰，若不符則拋出 401 錯誤
    if (clientKey !== serverKey) {
      throw new UnauthorizedException('無效的 API Key，拒絕存取');
    }
    return true;
  }
}
