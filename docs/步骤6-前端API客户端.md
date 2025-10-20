# 步骤6: 前端API客户端

## 概述
在AxiosClient中添加浏览器相关的API方法，封装与后端的数据交互逻辑。

## 目标文件
`skyvern-frontend/src/api/AxiosClient.ts`

## 实施内容

### 6.1 基础API客户端方法
```typescript
import {
  AdsPowerStatus,
  ChromePathValidation,
  ChromePathValidationDetailed,
  BrowserConfigSuggestions
} from './types';
import { BROWSER_API_PATHS } from './browser-types';

// 在现有的AxiosClient类中添加以下方法
export class AxiosClient {
  // ... 现有方法保持不变 ...

  /**
   * 获取AdsPower服务状态
   * @returns AdsPower状态信息
   */
  async getAdsPowerStatus(): Promise<AdsPowerStatus> {
    try {
      const response = await this.client.get<AdsPowerStatus>(BROWSER_API_PATHS.adspowerStatus);
      return response.data;
    } catch (error) {
      console.error('获取AdsPower状态失败:', error);
      throw this.handleError(error, '获取AdsPower状态失败');
    }
  }

  /**
   * 验证Chrome路径是否有效
   * @param chromePath Chrome执行文件路径
   * @returns 验证结果
   */
  async validateChromePath(chromePath: string): Promise<ChromePathValidation> {
    try {
      const response = await this.client.post(BROWSER_API_PATHS.validateChromePath, {
        chrome_path: chromePath
      });
      return response.data;
    } catch (error) {
      console.error('Chrome路径验证失败:', error);
      throw this.handleError(error, 'Chrome路径验证失败');
    }
  }

  /**
   * 详细验证Chrome路径
   * @param chromePath Chrome执行文件路径
   * @returns 详细验证结果
   */
  async validateChromePathDetailed(chromePath: string): Promise<ChromePathValidationDetailed> {
    try {
      const response = await this.client.post(BROWSER_API_PATHS.validateChromePathDetailed, {
        chrome_path: chromePath
      });
      return response.data;
    } catch (error) {
      console.error('Chrome路径详细验证失败:', error);
      throw this.handleError(error, 'Chrome路径详细验证失败');
    }
  }

  /**
   * 获取浏览器配置建议
   * @returns 配置建议信息
   */
  async getBrowserConfigSuggestions(): Promise<BrowserConfigSuggestions> {
    try {
      const response = await this.client.get<BrowserConfigSuggestions>(BROWSER_API_PATHS.browserConfigSuggestions);
      return response.data;
    } catch (error) {
      console.error('获取浏览器配置建议失败:', error);
      throw this.handleError(error, '获取浏览器配置建议失败');
    }
  }
}
```

### 6.2 增强的错误处理
```typescript
// 增强的错误处理类型
interface BrowserAPIError extends Error {
  code?: string;
  details?: unknown;
  statusCode?: number;
}

// 在AxiosClient中添加专门的错误处理方法
private handleBrowserAPIError(error: unknown, defaultMessage: string): BrowserAPIError {
  const browserError: BrowserAPIError = new Error(defaultMessage);

  if (axios.isAxiosError(error)) {
    const { response } = error;

    if (response) {
      browserError.statusCode = response.status;
      browserError.message = response.data?.detail || response.data?.message || defaultMessage;
      browserError.code = response.data?.code;
      browserError.details = response.data;

      // 特殊处理特定的HTTP状态码
      switch (response.status) {
        case 401:
          browserError.message = 'API密钥无效或已过期';
          break;
        case 403:
          browserError.message = '没有权限访问此资源';
          break;
        case 404:
          browserError.message = '请求的浏览器API不存在';
          break;
        case 500:
          browserError.message = '服务器内部错误，请稍后重试';
          break;
        case 503:
          browserError.message = 'AdsPower服务不可用，请检查客户端是否运行';
          break;
        default:
          browserError.message = response.data?.detail || defaultMessage;
      }
    } else if (error.request) {
      browserError.message = '无法连接到服务器，请检查网络连接';
      browserError.code = 'NETWORK_ERROR';
    } else {
      browserError.message = error.message || defaultMessage;
    }
  } else if (error instanceof Error) {
    browserError.message = error.message || defaultMessage;
  }

  return browserError;
}
```

### 6.3 带重试机制的API客户端
```typescript
// 带重试机制的API调用
async function apiCallWithRetry<T>(
  apiCall: () => Promise<T>,
  maxRetries: number = 3,
  retryDelay: number = 1000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await apiCall();
    } catch (error) {
      lastError = error as Error;

      // 只在特定错误下重试
      if (attempt < maxRetries && this.shouldRetry(error)) {
        console.warn(`API调用失败，${retryDelay}ms后重试 (尝试 ${attempt + 1}/${maxRetries}):`, error);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        retryDelay *= 2; // 指数退避
        continue;
      }

      throw error;
    }
  }

  throw lastError!;
}

// 判断是否应该重试
private shouldRetry(error: unknown): boolean {
  if (!axios.isAxiosError(error)) {
    return false;
  }

  const { response } = error;

  // 只在网络错误或特定服务器错误时重试
  if (!response) {
    return true; // 网络错误
  }

  // 5xx服务器错误可以重试
  if (response.status >= 500 && response.status < 600) {
    return true;
  }

  // 429 Too Many Requests 可以重试
  if (response.status === 429) {
    return true;
  }

  return false;
}
```

### 6.4 带缓存的API客户端
```typescript
// 简单的内存缓存实现
class SimpleCache<T> {
  private cache = new Map<string, { data: T; expiry: number }>();
  private defaultTTL: number;

  constructor(defaultTTL: number = 5 * 60 * 1000) { // 默认5分钟
    this.defaultTTL = defaultTTL;
  }

  set(key: string, data: T, ttl?: number): void {
    const expiry = Date.now() + (ttl || this.defaultTTL);
    this.cache.set(key, { data, expiry });
  }

  get(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) {
      return null;
    }

    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }

    return item.data;
  }

  clear(): void {
    this.cache.clear();
  }

  delete(key: string): void {
    this.cache.delete(key);
  }
}

// 在AxiosClient中添加缓存机制
export class AxiosClient {
  private adsPowerStatusCache = new SimpleCache<AdsPowerStatus>(30000); // 30秒缓存
  private chromePathValidationCache = new SimpleCache<ChromePathValidation>(60000); // 1分钟缓存

  /**
   * 获取AdsPower服务状态（带缓存）
   */
  async getAdsPowerStatus(useCache: boolean = true): Promise<AdsPowerStatus> {
    const cacheKey = 'adspower_status';

    if (useCache) {
      const cached = this.adsPowerStatusCache.get(cacheKey);
      if (cached) {
        console.log('使用缓存的AdsPower状态');
        return cached;
      }
    }

    const status = await apiCallWithRetry(async () => {
      const response = await this.client.get<AdsPowerStatus>(BROWSER_API_PATHS.adspowerStatus);
      return response.data;
    });

    this.adsPowerStatusCache.set(cacheKey, status);
    return status;
  }

  /**
   * 验证Chrome路径（带缓存）
   */
  async validateChromePath(chromePath: string, useCache: boolean = true): Promise<ChromePathValidation> {
    const cacheKey = `chrome_path_${chromePath}`;

    if (useCache && chromePath.length > 5) { // 只有路径长度足够才使用缓存
      const cached = this.chromePathValidationCache.get(cacheKey);
      if (cached) {
        console.log('使用缓存的Chrome路径验证结果');
        return cached;
      }
    }

    const validation = await apiCallWithRetry(async () => {
      const response = await this.client.post(BROWSER_API_PATHS.validateChromePath, {
        chrome_path: chromePath
      });
      return response.data;
    });

    this.chromePathValidationCache.set(cacheKey, validation);
    return validation;
  }

  /**
   * 清除浏览器相关缓存
   */
  clearBrowserCache(): void {
    this.adsPowerStatusCache.clear();
    this.chromePathValidationCache.clear();
  }
}
```

### 6.5 React Query集成
```typescript
// 创建专门的React Query hooks
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Query Keys
export const BROWSER_QUERY_KEYS = {
  adspowerStatus: ['browser', 'adspower', 'status'] as const,
  chromePathValidation: (path: string) => ['browser', 'chrome', 'validation', path] as const,
  browserSuggestions: ['browser', 'suggestions'] as const
};

// Hook: 获取AdsPower状态
export function useAdsPowerStatus(enabled: boolean = true) {
  return useQuery({
    queryKey: BROWSER_QUERY_KEYS.adspowerStatus,
    queryFn: () => axiosClient.getAdsPowerStatus(),
    enabled,
    staleTime: 30000, // 30秒
    refetchInterval: 60000, // 1分钟自动刷新
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000)
  });
}

// Hook: 验证Chrome路径
export function useChromePathValidation(chromePath: string, enabled: boolean = true) {
  return useQuery({
    queryKey: BROWSER_QUERY_KEYS.chromePathValidation(chromePath),
    queryFn: () => axiosClient.validateChromePath(chromePath),
    enabled: enabled && chromePath.length > 5, // 路径长度足够才启用
    staleTime: 60000, // 1分钟
    retry: 1
  });
}

// Hook: 获取浏览器配置建议
export function useBrowserConfigSuggestions() {
  return useQuery({
    queryKey: BROWSER_QUERY_KEYS.browserSuggestions,
    queryFn: () => axiosClient.getBrowserConfigSuggestions(),
    staleTime: 5 * 60 * 1000, // 5分钟
    retry: 2
  });
}

// Hook: 清除浏览器缓存
export function useClearBrowserCache() {
  const queryClient = useQueryClient();

  return () => {
    queryClient.removeQueries({ queryKey: ['browser'] });
    axiosClient.clearBrowserCache();
  };
}
```

### 6.6 高级错误恢复机制
```typescript
// 连接状态管理
class ConnectionStateManager {
  private connectionStates = new Map<string, 'online' | 'offline'>();
  private reconnectAttempts = new Map<string, number>();
  private maxReconnectAttempts = 5;

  setConnectionState(service: string, state: 'online' | 'offline'): void {
    this.connectionStates.set(service, state);
    if (state === 'online') {
      this.reconnectAttempts.delete(service);
    }
  }

  getConnectionState(service: string): 'online' | 'offline' {
    return this.connectionStates.get(service) || 'offline';
  }

  incrementReconnectAttempts(service: string): number {
    const attempts = (this.reconnectAttempts.get(service) || 0) + 1;
    this.reconnectAttempts.set(service, attempts);
    return attempts;
  }

  shouldAttemptReconnect(service: string): boolean {
    const attempts = this.reconnectAttempts.get(service) || 0;
    return attempts < this.maxReconnectAttempts;
  }

  resetReconnectAttempts(service: string): void {
    this.reconnectAttempts.delete(service);
  }
}

// AdsPower连接管理器
export class AdsPowerConnectionManager {
  private connectionState = new ConnectionStateManager();

  async checkConnectionWithRecovery(): Promise<AdsPowerStatus> {
    const service = 'adspower';

    try {
      // 尝试获取状态
      const status = await axiosClient.getAdsPowerStatus(false); // 不使用缓存

      if (status.available) {
        this.connectionState.setConnectionState(service, 'online');
        this.connectionState.resetReconnectAttempts(service);
        return status;
      } else {
        throw new Error(status.message);
      }
    } catch (error) {
      this.connectionState.setConnectionState(service, 'offline');

      if (this.connectionState.shouldAttemptReconnect(service)) {
        const attempts = this.connectionState.incrementReconnectAttempts(service);
        const delay = Math.min(1000 * 2 ** attempts, 30000);

        console.warn(`AdsPower连接失败，${delay}ms后重试 (尝试 ${attempts}/${this.connectionState.maxReconnectAttempts})`);

        await new Promise(resolve => setTimeout(resolve, delay));

        // 递归重试
        return this.checkConnectionWithRecovery();
      } else {
        throw new Error(`AdsPower连接失败，已达到最大重试次数: ${error}`);
      }
    }
  }
}
```

## 技术要点

1. **错误处理**: 完善的异常捕获和分类处理
2. **重试机制**: 智能的重试策略，避免无效重试
3. **缓存优化**: 合理的缓存策略减少API调用
4. **React Query集成**: 现代化的数据获取和管理
5. **连接恢复**: 自动重连和状态恢复机制

## API使用示例

### 基本使用
```typescript
// 获取AdsPower状态
const adsPowerStatus = await axiosClient.getAdsPowerStatus();
console.log('AdsPower状态:', adsPowerStatus);

// 验证Chrome路径
const validation = await axiosClient.validateChromePath('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe');
if (validation.valid) {
  console.log('Chrome路径有效:', validation.path);
} else {
  console.error('Chrome路径无效:', validation.message);
}
```

### React组件中使用
```typescript
import { useAdsPowerStatus, useChromePathValidation } from '../api/AxiosClient';

function BrowserConfigComponent() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

  // 使用React Query hooks
  const { data: adsPowerStatus, isLoading: isCheckingAdsPower } = useAdsPowerStatus();
  const { data: chromeValidation, isLoading: isValidatingChrome } = useChromePathValidation(chromePath);

  if (isCheckingAdsPower) {
    return <div>检查AdsPower状态...</div>;
  }

  return (
    <div>
      <h3>AdsPower状态</h3>
      <p>可用: {adsPowerStatus?.available ? '是' : '否'}</p>
      <p>消息: {adsPowerStatus?.message}</p>

      <h3>Chrome路径验证</h3>
      {isValidatingChrome ? (
        <p>验证中...</p>
      ) : (
        <p>有效: {chromeValidation?.valid ? '是' : '否'}</p>
      )}
    </div>
  );
}
```

## 验证方法

1. **API调用测试**: 验证各个端点的正确调用
2. **错误处理**: 测试各种异常情况的处理
3. **缓存机制**: 验证缓存的命中和过期逻辑
4. **重试策略**: 测试重试机制和退避算法
5. **React集成**: 验证hooks在组件中的使用

## 下一步
完成前端API客户端后，进入步骤7：浏览器选择器组件