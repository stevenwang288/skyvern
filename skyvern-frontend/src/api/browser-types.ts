// 6. 前端类型定义 (skyvern-frontend/src/api/types.ts)
// 在现有types.ts文件中添加以下类型定义：

export enum BrowserType {
  SkyvernDefault = "skyvern_default",
  LocalCustom = "local_custom",
  AdsPower = "adspower"
}

export interface BrowserConfig {
  type: BrowserType;
  chrome_path?: string;
  chrome_args?: string[];
  adspower_user_id?: string;
  adspower_group_id?: string;
}

export interface AdsPowerBrowserInfo {
  user_id: string;
  name: string;
  serial_number: string;
  remark?: string;
  group_id?: string;
  status: string;
}

export interface AdsPowerStatus {
  available: boolean;
  message: string;
  browsers: AdsPowerBrowserInfo[];
}

// 扩展CreateTaskRequest接口
export interface CreateTaskRequest {
  // ... 现有字段保持不变 ...
  browser_config?: BrowserConfig;
}