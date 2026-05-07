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
    const serverKey = process.env.API_KEY?.trim();

    // 💡 抓蟲專用 Log (推上雲端看一眼 Log 就知道為什麼不通了)
    // 測試完請務必刪除，避免金鑰洩漏在日誌中
    console.log(
      `[Auth Check] ClientKey: ${clientKey}, ServerKey: ${serverKey}`,
    );

    if (!serverKey) {
      console.error('❌ 警告：雲端環境變數 API_KEY 未設定或讀取失敗');
    }
    // 比對金鑰，若不符則拋出 401 錯誤
    if (clientKey !== serverKey) {
      throw new UnauthorizedException('無效的 API Key，拒絕存取');
    }
    return true;
  }
}
