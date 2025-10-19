// 8. 前端浏览器选择器组件 (skyvern-frontend/src/components/BrowserSelector.tsx)
import { useState, useEffect } from 'react';
import { useQuery } from "@tanstack/react-query";
import { Control, useWatch } from 'react-hook-form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Alert, AlertDescription } from "./ui/alert";
import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "./ui/form";
import { BrowserType, BrowserConfig } from "../api/browser-types";
import { getAdsPowerStatus, validateChromePath } from "../api/browser-api";
import { useCredentialGetter } from "@/hooks/useCredentialGetter";
import { ChromeIcon, ShieldIcon, ZapIcon, CheckCircleIcon, XCircleIcon, RefreshCwIcon, ExternalLinkIcon } from "./icons/BrowserIcons";

interface BrowserSelectorProps {
  control: Control<any>;
  name?: string;
}

export function BrowserSelector({ control, name = "browser_config" }: BrowserSelectorProps) {
  const credentialGetter = useCredentialGetter();
  const [hasError, setHasError] = useState(false);

  // 组件卸载时清理状态
  useEffect(() => {
    return () => {
      // 清理任何可能的状态
      setHasError(false);
    };
  }, []);

  // 错误边界处理
  if (hasError) {
    return (
      <div className="text-red-500 text-sm p-2 bg-red-50 rounded border border-red-200">
        Browser selector encountered an error. Please refresh the page.
      </div>
    );
  }

  // 监听表单字段变化
  const watchedConfig = useWatch({
    control,
    name,
    defaultValue: { type: BrowserType.SkyvernDefault }
  }) as BrowserConfig;

  const browserType = watchedConfig?.type || BrowserType.SkyvernDefault;
  const chromePath = watchedConfig?.chrome_path || "";

  // AdsPower状态查询
  const {
    data: adsPowerStatus,
    isLoading: isCheckingAdsPower,
    refetch: refetchAdsPower
  } = useQuery({
    queryKey: ["adspower-status"],
    queryFn: async () => {
      if (!credentialGetter) {
        return { available: false, message: 'No credentials available', browsers: [] };
      }
      try {
        const token = await credentialGetter();
        if (!token) {
          return { available: false, message: 'No credentials available', browsers: [] };
        }
        return await getAdsPowerStatus(() => Promise.resolve(token));
      } catch {
        return { available: false, message: 'Failed to get credentials', browsers: [] };
      }
    },
    enabled: browserType === BrowserType.AdsPower,
    refetchInterval: 15000, // 15秒自动刷新
    staleTime: 10000,
    retry: 1
  });

  // Chrome路径验证查询
  const {
    data: chromeValidation
  } = useQuery({
    queryKey: ["chrome-path-validation", chromePath],
    queryFn: async () => {
      if (!credentialGetter) {
        return { valid: false, message: 'No credentials available' };
      }
      try {
        const token = await credentialGetter();
        if (!token) {
          return { valid: false, message: 'No credentials available' };
        }
        return await validateChromePath(chromePath, () => Promise.resolve(token));
      } catch {
        return { valid: false, message: 'Failed to get credentials' };
      }
    },
    enabled: browserType === BrowserType.LocalCustom && chromePath.length > 5,
    staleTime: 30000
  });

  // 打开AdsPower客户端
  const openAdsPowerClient = () => {
    try {
      // 尝试使用自定义协议打开
      window.open('adspower://', '_blank');
    } catch {
      // 降级到官网下载页面
      window.open('https://www.adspower.com/download', '_blank');
    }
  };

  // 浏览器类型选项配置
  const browserTypeOptions = [
    {
      value: BrowserType.SkyvernDefault,
      label: "🤖 Skyvern默认浏览器",
      description: "推荐选项，稳定可靠，自动管理",
      icon: <ZapIcon className="w-4 h-4" />
    },
    {
      value: BrowserType.LocalCustom,
      label: "🌐 本地自定义Chrome",
      description: "使用本地Chrome，支持大窗口和自定义参数",
      icon: <ChromeIcon className="w-4 h-4" />
    },
    {
      value: BrowserType.AdsPower,
      label: "🛡️ AdsPower防关联浏览器",
      description: "企业级反检测，适合敏感业务场景",
      icon: <ShieldIcon className="w-4 h-4" />
    }
  ];

  return (
    <div className="space-y-6">
      {/* 浏览器类型选择 */}
      <FormField
        control={control}
        name={`${name}.type`}
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              <div className="flex flex-col space-y-1">
                <h3 className="text-lg font-medium">浏览器类型</h3>
                <p className="text-sm text-muted-foreground">
                  选择任务执行时使用的浏览器环境
                </p>
              </div>
            </FormLabel>
            <FormControl>
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="选择浏览器类型" />
                </SelectTrigger>
                <SelectContent>
                  {browserTypeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-start space-x-3 py-2">
                        {option.icon}
                        <div className="flex flex-col">
                          <span className="font-medium">{option.label}</span>
                          <span className="text-xs text-muted-foreground">
                            {option.description}
                          </span>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* 本地Chrome配置面板 */}
      {browserType === BrowserType.LocalCustom && (
        <div className="border rounded-lg p-4 bg-blue-50/50 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <ChromeIcon className="w-5 h-5 text-blue-600" />
              <h4 className="text-lg font-medium">本地Chrome配置</h4>
            </div>
            {chromeValidation && (
              <div className="flex items-center space-x-1">
                {chromeValidation.valid ? (
                  <>
                    <CheckCircleIcon className="w-4 h-4 text-green-500" />
                    <span className="text-sm text-green-600">路径有效</span>
                  </>
                ) : (
                  <>
                    <XCircleIcon className="w-4 h-4 text-red-500" />
                    <span className="text-sm text-red-600">路径无效</span>
                  </>
                )}
              </div>
            )}
          </div>

          <FormField
            control={control}
            name={`${name}.chrome_path`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Chrome执行文件路径 *</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="C:\Program Files\Google\Chrome\Application\chrome.exe"
                    className={chromeValidation?.valid === false ? "border-red-300" : ""}
                  />
                </FormControl>
                <FormDescription>
                  <div className="text-sm space-y-1">
                    <p>常见路径参考：</p>
                    <ul className="list-disc list-inside space-y-0.5 text-xs">
                      <li><strong>Windows:</strong> C:\Program Files\Google\Chrome\Application\chrome.exe</li>
                      <li><strong>macOS:</strong> /Applications/Google Chrome.app/Contents/MacOS/Google Chrome</li>
                      <li><strong>Linux:</strong> /usr/bin/google-chrome</li>
                    </ul>
                  </div>
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name={`${name}.chrome_args`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Chrome启动参数（可选）</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    value={Array.isArray(field.value) ? field.value.join(' ') : field.value || ''}
                    onChange={(e) => {
                      const args = e.target.value ? e.target.value.split(' ').filter(Boolean) : [];
                      field.onChange(args);
                    }}
                    placeholder="--window-size=1920,1080 --start-maximized"
                  />
                </FormControl>
                <FormDescription>
                  用空格分隔多个参数，例如: --window-size=1920,1080 --start-maximized
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      )}

      {/* AdsPower配置面板 */}
      {browserType === BrowserType.AdsPower && (
        <div className="border rounded-lg p-4 bg-green-50/50 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <ShieldIcon className="w-5 h-5 text-green-600" />
              <h4 className="text-lg font-medium">AdsPower防关联浏览器</h4>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => refetchAdsPower()}
                disabled={isCheckingAdsPower}
              >
                <RefreshCwIcon className={`w-4 h-4 mr-1 ${isCheckingAdsPower ? 'animate-spin' : ''}`} />
                刷新
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={openAdsPowerClient}
              >
                <ExternalLinkIcon className="w-4 h-4 mr-1" />
                打开AdsPower
              </Button>
            </div>
          </div>

          {/* AdsPower服务状态 */}
          {adsPowerStatus && (
            <Alert className={`${
              adsPowerStatus.available
                ? 'border-green-200 bg-green-50'
                : 'border-red-200 bg-red-50'
            }`}>
              <div className="flex items-start space-x-2">
                {adsPowerStatus.available ? (
                  <CheckCircleIcon className="w-4 h-4 text-green-500 mt-0.5" />
                ) : (
                  <XCircleIcon className="w-4 h-4 text-red-500 mt-0.5" />
                )}
                <div className="flex-1">
                  <AlertDescription className={
                    adsPowerStatus.available ? 'text-green-700' : 'text-red-700'
                  }>
                    {adsPowerStatus.message}
                    {!adsPowerStatus.available && (
                      <div className="text-sm mt-2 space-y-1">
                        <p>请确保：</p>
                        <ul className="list-disc list-inside text-xs space-y-0.5">
                          <li>AdsPower客户端已启动并登录</li>
                          <li>API接口端口50325未被占用</li>
                          <li>防火墙允许本地连接</li>
                        </ul>
                      </div>
                    )}
                  </AlertDescription>
                </div>
              </div>
            </Alert>
          )}

          {/* 浏览器选择 */}
          {isCheckingAdsPower ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
              <p className="text-sm text-muted-foreground mt-3">正在检测AdsPower连接状态...</p>
            </div>
          ) : adsPowerStatus?.available ? (
            <FormField
              control={control}
              name={`${name}.adspower_user_id`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>选择AdsPower浏览器 *</FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            adsPowerStatus.browsers?.length === 0
                              ? "未找到可用浏览器，请先在AdsPower中创建"
                              : "选择一个浏览器配置"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {adsPowerStatus.browsers?.map((browser) => (
                          <SelectItem key={browser.user_id} value={browser.user_id}>
                            <div className="flex flex-col py-1">
                              <div className="flex items-center space-x-2">
                                <ShieldIcon className="w-3 h-3 text-green-500" />
                                <span className="font-medium">{browser.name}</span>
                                <span className={`text-xs px-1.5 py-0.5 rounded ${
                                  browser.status === 'Active'
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-gray-100 text-gray-600'
                                }`}>
                                  {browser.status}
                                </span>
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                ID: {browser.user_id} | 序列号: {browser.serial_number}
                                {browser.remark && ` | ${browser.remark}`}
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormDescription>
                    {adsPowerStatus.browsers?.length === 0 ? (
                      <span className="text-amber-600">
                        请先在AdsPower客户端中创建浏览器配置
                      </span>
                    ) : (
                      `找到 ${adsPowerStatus.browsers?.length} 个可用浏览器配置`
                    )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          ) : (
            <div className="text-center py-8">
              <ShieldIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-muted-foreground">请启动AdsPower客户端后重试</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={openAdsPowerClient}
                className="mt-3"
              >
                <ExternalLinkIcon className="w-4 h-4 mr-1" />
                下载AdsPower
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}